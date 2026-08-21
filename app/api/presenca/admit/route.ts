import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { attendanceId, action } = body; // action: 'ADMIT' ou 'REJECT'

    const updated = await (prisma as any).attendance.update({
      where: { id: attendanceId },
      data: {
        status: action === 'ADMIT' ? 'ADMITTED' : 'REJECTED'
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao processar' }, { status: 500 });
  }
}