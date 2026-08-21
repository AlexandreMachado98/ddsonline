 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, name, cpf, savedSelfie, savedSignature, meetingId, exitReason, exitSignature } = body;

    // --- 1. AÇÃO DE SAÍDA ANTECIPADA ---
    if (action === 'register_exit') {
      const cleanCpf = String(cpf || '').replace(/\D/g, '');
      const attendances = await prisma.attendance.findMany({
        where: { meetingId: meetingId },
        orderBy: { createdAt: 'desc' }
      });

      const target = attendances.find((a) => 
        a.cpf.replace(/\D/g, '') === cleanCpf ||
        a.name.toLowerCase().trim() === String(name || '').toLowerCase().trim()
      );

      if (target) {
        const updated = await prisma.attendance.update({
          where: { id: target.id },
          data: {
            exitReason: String(exitReason || 'Não informado').trim(),
            exitSignature: exitSignature || null,
            leftAt: new Date()
          }
        });
        return NextResponse.json({ success: true, data: updated });
      }

      return NextResponse.json({ success: false, error: 'Presença não localizada' }, { status: 404 });
    }

    // --- 2. REGISTRO DE PRESENÇA DIRETO ---
    let meeting = null;

    if (meetingId && meetingId !== 'dds-principal') {
      meeting = await prisma.meeting.findUnique({
        where: { id: meetingId }
      });
    }

    if (!meeting) {
      meeting = await prisma.meeting.findFirst({
        where: { status: 'LIVE' },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!meeting) {
      meeting = await prisma.meeting.create({
        data: {
          topic: 'DDS Diário',
          farm: 'Fazenda Geral',
          status: 'LIVE'
        }
      });
    }

    // Cria a presença com status ADMITTED
    const attendance = await prisma.attendance.create({
      data: {
        name: String(name).trim(),
        cpf: String(cpf).trim(),
        selfie: savedSelfie,
        signature: savedSignature,
        status: 'ADMITTED',
        meetingId: meeting.id
      }
    });

    // Leitura segura do campo "type" para evitar erros de tipagem no VS Code
    const safeMeeting = meeting as { type?: string };
    const resolvedType = safeMeeting.type || 'PRESENTIAL';

    return NextResponse.json({ 
      success: true, 
      data: attendance, 
      attendanceId: attendance.id,
      status: 'ADMITTED',
      meetingType: resolvedType
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no servidor';
    console.error("Erro na API Central de Presença:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}