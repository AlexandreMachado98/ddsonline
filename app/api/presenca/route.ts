 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, cpf, meetingId, exitReason, exitSignature } = body;

    const cleanCpf = String(cpf || '').replace(/\D/g, '');

    // 1. Busca as presenças desta reunião
    const attendances = await (prisma as any).attendance.findMany({
      where: {
        meetingId: meetingId
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Localiza o registro do colaborador por CPF ou Nome
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
  } catch (error: any) {
    console.error("Erro no registro de saída:", error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao registrar saída' }, { status: 500 });
  }
}