 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, name, cpf, savedSelfie, savedSignature, meetingId, exitReason, exitSignature } = body;

    // --- 1. AÇÃO DE SAÍDA ANTECIPADA ---
    if (action === 'register_exit') {
      const cleanCpf = String(cpf || '').replace(/\D/g, '');
      const attendances = await (prisma as any).attendance.findMany({
        where: { meetingId: meetingId },
        orderBy: { createdAt: 'desc' }
      });

      const target = attendances.find((a: any) => 
        a.cpf.replace(/\D/g, '') === cleanCpf ||
        a.name.toLowerCase().trim() === String(name || '').toLowerCase().trim()
      );

      if (target) {
        const updated = await (prisma as any).attendance.update({
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

    // --- 2. REGISTRO DE PRESENÇA DIRETO (LIBERAÇÃO INSTANTÂNEA) ---
    let meeting = null;

    if (meetingId && meetingId !== 'dds-principal') {
      meeting = await (prisma as any).meeting.findUnique({
        where: { id: meetingId }
      });
    }

    if (!meeting) {
      meeting = await (prisma as any).meeting.findFirst({
        where: { status: 'LIVE' },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!meeting) {
      meeting = await (prisma as any).meeting.create({
        data: {
          topic: 'DDS Diário',
          farm: 'Fazenda Geral',
          type: 'PRESENTIAL',
          status: 'LIVE'
        }
      });
    }

    const attendance = await (prisma as any).attendance.create({
      data: {
        name: String(name).trim(),
        cpf: String(cpf).trim(),
        selfie: savedSelfie,
        signature: savedSignature,
        status: 'ADMITTED', // LIBERAÇÃO DIRETA SEM TRAVA
        meetingId: meeting.id
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: attendance, 
      attendanceId: attendance.id,
      status: 'ADMITTED' 
    });

  } catch (error: any) {
    console.error("Erro na API de Presença:", error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao gravar presença' }, { status: 500 });
  }
}