 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, cpf, savedSelfie, savedSignature, meetingId } = body;

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
          status: 'LIVE'
        }
      });
    }

    // Cria a presença com status PENDING (Aguardando no lobby para o técnico permitir a entrada)
    const attendance = await (prisma as any).attendance.create({
      data: {
        name: String(name).trim(),
        cpf: String(cpf).trim(),
        selfie: savedSelfie,
        signature: savedSignature,
        status: 'PENDING',
        meetingId: meeting.id
      }
    });

    return NextResponse.json({ success: true, data: attendance, attendanceId: attendance.id });
  } catch (error: any) {
    console.error("Erro no POST /api/presenca:", error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao salvar presença' }, { status: 500 });
  }
}