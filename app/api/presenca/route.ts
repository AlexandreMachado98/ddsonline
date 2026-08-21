 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

// =========================================================================
// 1. GET: Consulta de Status da Sala de Espera (Anti-Cache Total)
// =========================================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const attendanceId = searchParams.get('attendanceId');
    const cpf = searchParams.get('cpf');
    const meetingId = searchParams.get('meetingId');

    let attendance = null;

    // Busca 1: Por ID Direto
    if (attendanceId && attendanceId !== 'null' && attendanceId !== 'undefined' && attendanceId.trim() !== '') {
      attendance = await (prisma as any).attendance.findUnique({
        where: { id: attendanceId.trim() }
      });
    }

    // Busca 2: Redundância por CPF
    if (!attendance && cpf) {
      const cleanCpf = String(cpf).replace(/\D/g, '');
      const attendances = await (prisma as any).attendance.findMany({
        where: {
          ...(meetingId && meetingId !== 'undefined' ? { meetingId } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      attendance = attendances.find((a: any) => a.cpf.replace(/\D/g, '') === cleanCpf);
    }

    if (attendance) {
      return NextResponse.json(
        {
          success: true,
          status: attendance.status || 'PENDING',
          attendanceId: attendance.id
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          }
        }
      );
    }

    return NextResponse.json({ success: false, status: 'PENDING' });
  } catch (error) {
    return NextResponse.json({ success: false, status: 'PENDING' });
  }
}

// =========================================================================
// 2. POST: Registro de Presença, Admissão pelo Técnico e Saída
// =========================================================================
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, attendanceId, actionType, name, cpf, savedSelfie, savedSignature, meetingId, exitReason, exitSignature } = body;

    // --- AÇÃO A: O TÉCNICO AUTORIZA OU RECUSA ENTRADA (ADMIT / REJECT) ---
    if (action === 'admit_user') {
      const newStatus = actionType === 'ADMIT' ? 'ADMITTED' : 'REJECTED';
      const updated = await (prisma as any).attendance.update({
        where: { id: String(attendanceId).trim() },
        data: { status: newStatus }
      });
      return NextResponse.json({ success: true, data: updated, status: newStatus });
    }

    // --- AÇÃO B: REGISTRO DE SAÍDA ANTECIPADA ---
    if (action === 'register_exit') {
      const cleanCpf = String(cpf || '').replace(/\D/g, '');
      const attendances = await (prisma as any).attendance.findMany({
        where: { meetingId: meetingId },
        orderBy: { createdAt: 'desc' }
      });

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
    }

    // --- AÇÃO C: REGISTRO DE PRESENÇA INICIAL DO COLABORADOR ---
    let meeting = null;

    if (meetingId && meetingId !== 'dds-principal') {
      meeting = await (prisma as any).meeting.findUnique({
        where: { id: meetingId }
      });
    }

    if (!meeting) {
      meeting = await (prisma as any).meeting.findFirst({
        where: { status: 'LIVE' },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!meeting) {
      meeting = await (prisma as any).meeting.create({
        data: {
          topic: 'DDS Diário',
          farm: 'Fazenda Geral',
          type: 'PRESENTIAL',
          status: 'LIVE'
        }
      });
    }

    // Se for presencial (no campo), libera direto como ADMITTED. Se for remoto com vídeo, entra como PENDING
    const initialStatus = meeting.type === 'PRESENTIAL' ? 'ADMITTED' : 'PENDING';

    const attendance = await (prisma as any).attendance.create({
      data: {
        name: String(name).trim(),
        cpf: String(cpf).trim(),
        selfie: savedSelfie,
        signature: savedSignature,
        status: initialStatus,
        meetingId: meeting.id
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: attendance, 
      attendanceId: attendance.id,
      status: initialStatus 
    });

  } catch (error: any) {
    console.error("Erro na API Central de Presença:", error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro no servidor' }, { status: 500 });
  }
}