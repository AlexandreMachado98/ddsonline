import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, cpf, savedSelfie, savedSignature, meetingId } = body;

    if (!name || !cpf) {
      return NextResponse.json({ success: false, error: 'Nome e CPF são obrigatórios' }, { status: 400 });
    }

    if (!meetingId) {
      return NextResponse.json({ success: false, error: 'Identificador da reunião não informado' }, { status: 400 });
    }

    // Busca a reunião específica para vincular com precisão
    let meeting = await prisma.meeting.findUnique({
      where: { id: meetingId }
    });

    if (!meeting) {
      return NextResponse.json({ success: false, error: 'Reunião não encontrada ou link expirado' }, { status: 404 });
    }

    // Evita duplicidade de presença para o mesmo CPF na mesma reunião
    const existing = await prisma.attendance.findFirst({
      where: {
        meetingId: meeting.id,
        cpf: cpf.trim()
      }
    });

    if (existing) {
      // Atualiza os dados biométricos e assinatura
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          name: name.trim(),
          selfie: savedSelfie || existing.selfie,
          signature: savedSignature || existing.signature
        }
      });
      return NextResponse.json({ success: true, data: updated, meetingId: meeting.id });
    }

    // Salva a presença atrelada estritamente à reunião correta
    const attendance = await prisma.attendance.create({
      data: {
        name: name.trim(),
        cpf: cpf.trim(),
        selfie: savedSelfie || '',
        signature: savedSignature || '',
        meetingId: meeting.id
      }
    });

    return NextResponse.json({ success: true, data: attendance, meetingId: meeting.id });
  } catch (error) {
    console.error("Erro no POST /api/presenca:", error);
    return NextResponse.json({ success: false, error: 'Erro interno ao salvar presença' }, { status: 500 });
  }
}