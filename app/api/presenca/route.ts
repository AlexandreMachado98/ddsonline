import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, cpf, savedSelfie, savedSignature, meetingId } = body;

    let meeting = null;

    // Se veio com o ID da reunião (link do Meet), vincula nela
    if (meetingId) {
      meeting = await prisma.meeting.findUnique({
        where: { id: meetingId }
      });
    }

    // Se não veio ID, pega a reunião ao vivo
    if (!meeting) {
      meeting = await prisma.meeting.findFirst({
        where: { status: 'LIVE' }
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

    // Salva a presença atrelada à reunião correta
    const attendance = await prisma.attendance.create({
      data: {
        name,
        cpf,
        selfie: savedSelfie,
        signature: savedSignature,
        meetingId: meeting.id
      }
    });

    return NextResponse.json({ success: true, data: attendance, meetingId: meeting.id });
  } catch (error) {
    console.error("Erro no POST /api/presenca:", error);
    return NextResponse.json({ success: false, error: 'Erro interno ao salvar' }, { status: 500 });
  }
}