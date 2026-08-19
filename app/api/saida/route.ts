import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, cpf, meetingId, exitReason, exitSignature } = body;

    // Busca a presença desse colaborador na reunião
    const attendance = await prisma.attendance.findFirst({
      where: {
        meetingId: meetingId,
        cpf: cpf
      }
    });

    if (attendance) {
      // Atualiza o registro com o motivo e assinatura de saída
      // (Salvamos na assinatura combinada ou campo de log)
      const updated = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          name: `${name} (Saída: ${exitReason})`
        }
      });

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no registro de saída:", error);
    return NextResponse.json({ success: false, error: 'Erro ao registrar saída' }, { status: 500 });
  }
}