import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';
import { validateBase64Image } from '@/lib/fileValidation';
import { createHash, timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, attendanceId, attendanceProof, registration, meetingId, exitReason, exitSignature } = body;

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
    const trimmedRegistration = typeof registration === 'string' ? registration.trim() : '';
    const cleanReason = typeof exitReason === 'string' && exitReason.trim().length > 0 
      ? exitReason.trim().slice(0, 500) 
      : 'Saída antecipada justificada';

    if (!attendanceId && !(trimmedName && /^\d{4}$/.test(trimmedRegistration))) {
      return NextResponse.json({ 
        success: false, 
        error: 'Informe seu nome e sua matrícula para registrar a saída.' 
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

    // 4. Localiza o registro de presença DENTRO desta reunião e confirma que quem pede a
    // saída é o próprio colaborador: credencial gerada no celular dele na assinatura,
    // ou nome + matrícula conferindo. Só o nome não basta (qualquer um poderia registrar
    // a saída de outra pessoa).
    const proofMatches = (hash: string | null | undefined) => {
      if (!hash || typeof attendanceProof !== 'string' || attendanceProof.length < 16) return false;
      const a = Buffer.from(hash);
      const b = Buffer.from(createHash('sha256').update(attendanceProof).digest('hex'));
      return a.length === b.length && timingSafeEqual(a, b);
    };
    const sameName = (stored: string) => stored.replace(/\(Saída:.*\)/, '').trim().toLocaleLowerCase('pt-BR') === trimmedName.toLocaleLowerCase('pt-BR');

    let attendance = null;
    if (attendanceId && typeof attendanceId === 'string') {
      const candidate = await prisma.attendance.findFirst({ where: { id: attendanceId.trim(), meetingId: cleanMeetingId } });
      if (candidate && (proofMatches(candidate.quizProofHash) ||
          (/^\d{4}$/.test(trimmedRegistration) && candidate.registration === trimmedRegistration && sameName(candidate.name)))) {
        attendance = candidate;
      }
    }
    if (!attendance && trimmedName && /^\d{4}$/.test(trimmedRegistration)) {
      const candidates = await prisma.attendance.findMany({
        where: { meetingId: cleanMeetingId, registration: trimmedRegistration },
        orderBy: { createdAt: 'desc' }
      });
      attendance = candidates.find(c => sameName(c.name)) || null;
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

    // Devolve só o necessário: nunca foto, assinatura ou credencial.
    return NextResponse.json({ success: true, data: { id: updated.id, name: updated.name, leftAt: updated.leftAt } });

  } catch (error) {
    console.error("Erro interno no registro de saída");
    return NextResponse.json({ success: false, error: 'Erro interno ao processar saída' }, { status: 500 });
  }
}
