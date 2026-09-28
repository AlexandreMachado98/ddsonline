import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';
import { validateBase64Image } from '@/lib/fileValidation';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, cpf, attendanceId, meetingId, exitReason, exitSignature } = body;

    // 1. Validação estrita de identificador do DDS
    if (!meetingId || typeof meetingId !== 'string' || meetingId.trim().length < 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Identificador do DDS inválido ou não informado.' 
      }, { status: 400 });
    }

    const cleanMeetingId = meetingId.trim();

    // 2. Validação da Reunião
    const meeting = await prisma.meeting.findUnique({
      where: { id: cleanMeetingId },
      select: { id: true, status: true, topic: true }
    });

    if (!meeting) {
      return NextResponse.json({ 
        success: false, 
        error: 'Reunião não encontrada.' 
      }, { status: 404 });
    }

    if (meeting.status !== 'LIVE') {
      return NextResponse.json({ 
        success: false, 
        error: 'Não é possível registrar saída de uma reunião já encerrada.' 
      }, { status: 403 });
    }

    // 3. Validação dos dados do participante
    const trimmedName = typeof name === 'string' ? name.trim().slice(0, 100) : '';
    const trimmedCpf = typeof cpf === 'string' ? cpf.trim().slice(0, 80) : '';
    const cleanReason = typeof exitReason === 'string' && exitReason.trim().length > 0 
      ? exitReason.trim().slice(0, 500) 
      : 'Saída antecipada justificada';

    if (!attendanceId && !trimmedName) {
      return NextResponse.json({ 
        success: false, 
        error: 'Identificação do colaborador necessária para registrar saída.' 
      }, { status: 400 });
    }

    let sanitizedSignature: string | null = null;
    if (typeof exitSignature === 'string' && exitSignature.trim().length > 0) {
      const sigValidation = validateBase64Image(exitSignature, 1 * 1024 * 1024);
      if (!sigValidation.valid) {
        return NextResponse.json({ success: false, error: sigValidation.error || 'Formato de assinatura inválido.' }, { status: 400 });
      }
      sanitizedSignature = exitSignature;
    }

    // 4. Localiza o registro de presença estritamente DENTRO desta reunião
    let attendance = null;

    if (attendanceId && typeof attendanceId === 'string') {
      attendance = await prisma.attendance.findFirst({
        where: {
          id: attendanceId.trim(),
          meetingId: cleanMeetingId
        }
      });
    }

    if (!attendance && trimmedName) {
      attendance = await prisma.attendance.findFirst({
        where: {
          meetingId: cleanMeetingId,
          name: { equals: trimmedName, mode: 'insensitive' },
          ...(trimmedCpf ? { cpf: { equals: trimmedCpf, mode: 'insensitive' } } : {})
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!attendance) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', {
        path: 'POST /api/saida',
        reason: `ATTENDANCE_NOT_FOUND_IN_MEETING (${cleanMeetingId})`
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Registro de presença não localizado neste DDS.' 
      }, { status: 404 });
    }

    // 5. Atualiza a saída do colaborador com data e assinatura
    const cleanName = attendance.name.replace(/\(Saída:.*\)/, '').trim();
    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        name: cleanName,
        exitReason: cleanReason,
        exitSignature: sanitizedSignature || attendance.exitSignature,
        leftAt: new Date()
      }
    });

    logSecurityEvent('ADMIN_ACTION', {
      reason: `EXIT_REGISTERED: Attendance ${attendance.id} in Meeting ${cleanMeetingId}`
    });

    return NextResponse.json({ success: true, data: updated });

  } catch (error) {
    console.error("Erro interno no registro de saída");
    return NextResponse.json({ success: false, error: 'Erro interno ao processar saída' }, { status: 500 });
  }
}