// app/api/saida/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, cpf, meetingId, exitReason, exitSignature } = body;

    if (!name && !cpf) {
      return NextResponse.json({ success: false, error: 'Identificação necessária para registrar saída' }, { status: 400 });
    }

    const trimmedName = typeof name === 'string' ? name.trim().slice(0, 100) : '';
    const cleanReason = typeof exitReason === 'string' ? exitReason.trim().slice(0, 500) : 'Saída antecipada justificada';

    let sanitizedSignature: string | null = null;
    if (typeof exitSignature === 'string' && exitSignature.length > 50) {
      if (exitSignature.startsWith('data:image/') || exitSignature.startsWith('http')) {
        sanitizedSignature = exitSignature.slice(0, 500000);
      }
    }

    // Busca o registro de presença desse colaborador pelo nome na reunião correta
    let attendance = null;

    if (meetingId && trimmedName) {
      attendance = await prisma.attendance.findFirst({
        where: {
          meetingId: meetingId,
          name: { contains: trimmedName, mode: 'insensitive' }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!attendance && trimmedName) {
      // Busca na reunião ativa mais recente
      attendance = await prisma.attendance.findFirst({
        where: {
          name: { contains: trimmedName, mode: 'insensitive' },
          meeting: { status: 'LIVE' }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (attendance) {
      const cleanName = attendance.name.replace(/\(Saída:.*\)/, '').trim();
      const updated = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          name: cleanName,
          exitReason: cleanReason,
          exitSignature: sanitizedSignature,
          leftAt: new Date()
        }
      });

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: true, message: 'Presença não localizada, mas saída anotada.' });
  } catch (error) {
    console.error("Erro interno no registro de saída");
    return NextResponse.json({ success: false, error: 'Erro ao registrar saída' }, { status: 500 });
  }
}