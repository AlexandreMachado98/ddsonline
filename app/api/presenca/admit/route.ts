 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { attendanceId, action } = body;

    if (!attendanceId) {
      return NextResponse.json({ success: false, error: 'ID de presença ausente' }, { status: 400 });
    }

    const newStatus = action === 'ADMIT' ? 'ADMITTED' : 'REJECTED';

    const updated = await (prisma as any).attendance.update({
      where: { id: String(attendanceId).trim() },
      data: {
        status: newStatus
      }
    });

    return NextResponse.json({ success: true, data: updated, status: newStatus });
  } catch (error: any) {
    console.error("Erro no POST /api/presenca/admit:", error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao processar admissão' }, { status: 500 });
  }
}