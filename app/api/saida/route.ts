import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, cpf, meetingId, exitReason, exitSignature } = body;

    if (!cpf) {
      return NextResponse.json({ success: false, error: 'CPF é obrigatório para registrar saída' }, { status: 400 });
    }

    // Busca o registro de presença desse colaborador
    let attendance = null;

    if (meetingId) {
      attendance = await prisma.attendance.findFirst({
        where: {
          meetingId: meetingId,
          cpf: cpf
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!attendance) {
      // Busca na reunião ativa mais recente
      attendance = await prisma.attendance.findFirst({
        where: {
          cpf: cpf,
          meeting: {
            status: 'LIVE'
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (attendance) {
      const cleanName = attendance.name.replace(/\(Saída:.*\)/, '').trim();
      const updated = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          name: `${cleanName} (Saída: ${exitReason || 'Antecipada'})`,
          exitReason: exitReason || 'Não informado',
          exitSignature: exitSignature || null,
          leftAt: new Date()
        }
      });

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: true, message: 'Presença não localizada, mas saída anotada.' });
  } catch (error) {
    console.error("Erro no registro de saída:", error);
    return NextResponse.json({ success: false, error: 'Erro ao registrar saída' }, { status: 500 });
  }
}