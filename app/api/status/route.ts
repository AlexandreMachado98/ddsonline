import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const attendanceId = searchParams.get('attendanceId');

    if (!attendanceId) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    const attendance = await (prisma as any).attendance.findUnique({
      where: { id: attendanceId }
    });

    return NextResponse.json({
      success: true,
      status: attendance?.status || 'PENDING'
    });
  } catch {
    return NextResponse.json({ success: false, status: 'PENDING' });
  }
}