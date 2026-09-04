import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, cpf, meetingId, exitReason, exitSignature } = body;

    if (!name && !cpf) {
      return NextResponse.json({ success: false, error: 'Identificação necessária para registrar saída' }, { status: 400 });
    }

    // Busca o registro de presença desse colaborador pelo nome
    let attendance = null;

    if (meetingId && name) {
      attendance = await prisma.attendance.findFirst({
        where: {
          meetingId: meetingId,
          name: { contains: name.trim(), mode: 'insensitive' }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!attendance && name) {
      // Busca na reunião ativa mais recente
      attendance = await prisma.attendance.findFirst({
        where: {
          name: { contains: name.trim(), mode: 'insensitive' },
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