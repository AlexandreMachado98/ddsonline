 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const attendanceId = searchParams.get('attendanceId');
    const cpf = searchParams.get('cpf');
    const meetingId = searchParams.get('meetingId');

    let attendance = null;

    // 1. Busca direta por ID
    if (attendanceId && attendanceId !== 'null' && attendanceId !== 'undefined') {
      attendance = await (prisma as any).attendance.findUnique({
        where: { id: attendanceId }
      });
    }

    // 2. Busca de redundância por CPF e Reunião (garantia de não travar)
    if (!attendance && cpf && meetingId) {
      const cleanCpf = String(cpf).replace(/\D/g, '');
      const attendances = await (prisma as any).attendance.findMany({
        where: { meetingId: meetingId },
        orderBy: { createdAt: 'desc' }
      });

      attendance = attendances.find((a: any) => a.cpf.replace(/\D/g, '') === cleanCpf);
    }

    return NextResponse.json(
      {
        success: true,
        status: attendance?.status || 'PENDING',
        attendanceId: attendance?.id
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch {
    return NextResponse.json({ success: false, status: 'PENDING' });
  }
}