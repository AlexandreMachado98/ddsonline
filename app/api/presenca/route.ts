import { randomBytes, createHash } from 'node:crypto';
// app/api/presenca/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';
import { validateBase64Image } from '@/lib/fileValidation';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, cpf, registration, savedSelfie, savedSignature, meetingId } = body;

    // 1. Validação estrita de tipos e presença dos campos
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'O nome completo é obrigatório (mínimo 2 caracteres).' }, { status: 400 });
    }

    if (!cpf || typeof cpf !== 'string' || cpf.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'A função/cargo é obrigatória.' }, { status: 400 });
    }

    if (typeof registration !== 'string' || !/^\d{4}$/.test(registration.trim())) {
      return NextResponse.json({ success: false, error: 'Informe sua matrícula com 4 dígitos.' }, { status: 400 });
    }

    if (!meetingId || typeof meetingId !== 'string') {
      return NextResponse.json({ success: false, error: 'Identificador do DDS não informado ou inválido.' }, { status: 400 });
    }

    const trimmedName = name.trim().slice(0, 100);
    const trimmedCpf = cpf.trim().slice(0, 80);
    const trimmedRegistration = registration.trim();

    // 2. Busca a reunião específica para vincular com precisão
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId }
    });

    if (!meeting) {
      return NextResponse.json({ success: false, error: 'Reunião não encontrada ou link inexistente.' }, { status: 404 });
    }

    // 3. Regra de Segurança: Reunião precisa estar ativa ('LIVE')
    if (meeting.status !== 'LIVE' && !meeting.attendanceCollectionOpen) {
      logSecurityEvent('FORBIDDEN_ACCESS', {
        path: 'POST /api/presenca',
        reason: `ATTEMPT_ATTENDANCE_ON_CLOSED_MEETING (${meeting.id})`
      });
      return NextResponse.json({ 
        success: false, 
        error: '⛔ Este Diálogo Diário de Segurança já foi encerrado pelo organizador e não aceita mais novas presenças.' 
      }, { status: 403 });
    }

    // 4. Verificação de expiração temporal do convite
    if (meeting.inviteExpiresAt && new Date() > new Date(meeting.inviteExpiresAt)) {
      return NextResponse.json({ success: false, error: 'O link deste DDS expirou.' }, { status: 403 });
    }

    // 5. Validação de formato e tamanho de imagens por Magic Bytes (Selfie e Assinatura)
    let sanitizedSelfie = '';
    if (typeof savedSelfie === 'string' && savedSelfie.trim().length > 0) {
      const selfieValidation = validateBase64Image(savedSelfie, 1.5 * 1024 * 1024); // Máximo 1.5MB
      if (!selfieValidation.valid) {
        return NextResponse.json({ success: false, error: selfieValidation.error || 'Formato de foto inválido.' }, { status: 400 });
      }
      sanitizedSelfie = savedSelfie;
    }

    let sanitizedSignature = '';
    if (typeof savedSignature === 'string' && savedSignature.trim().length > 0) {
      const sigValidation = validateBase64Image(savedSignature, 1 * 1024 * 1024); // Máximo 1MB
      if (!sigValidation.valid) {
        return NextResponse.json({ success: false, error: sigValidation.error || 'Formato de assinatura inválido.' }, { status: 400 });
      }
      sanitizedSignature = savedSignature;
    }

    // Serializa a gravação com o encerramento da coleta para impedir assinaturas após o fechamento.
    const saved = await prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', meeting.id);
      const currentMeeting = await tx.meeting.findUnique({
        where: { id: meeting.id },
        select: { id: true, status: true, attendanceCollectionOpen: true }
      });
      if (!currentMeeting || (currentMeeting.status !== 'LIVE' && !currentMeeting.attendanceCollectionOpen)) {
        return { error: 'CLOSED' as const };
      }

      const existing = await tx.attendance.findFirst({
        where: {
          meetingId: meeting.id,
          OR: [
            { registration: trimmedRegistration },
            { name: { equals: trimmedName, mode: 'insensitive' }, cpf: { equals: trimmedCpf, mode: 'insensitive' } }
          ]
        }
      });

      // Em coleta complementar, nunca sobrescreve uma assinatura anterior.
      if (existing && currentMeeting.status === 'ENDED') return { error: 'DUPLICATE' as const };
      if (existing) {
        const updated = await tx.attendance.update({
          where: { id: existing.id },
          data: {
            name: trimmedName, cpf: trimmedCpf, registration: trimmedRegistration,
            selfie: sanitizedSelfie || existing.selfie,
            signature: sanitizedSignature || existing.signature
          }
        });
        return { attendance: updated, updated: true, quizProof: null as string | null };
      }

      const quizProof = randomBytes(32).toString('hex');
      const attendance = await tx.attendance.create({
        data: {
          name: trimmedName, cpf: trimmedCpf, registration: trimmedRegistration,
          selfie: sanitizedSelfie, signature: sanitizedSignature,
          quizProofHash: createHash('sha256').update(quizProof).digest('hex'),
          meetingId: meeting.id
        }
      });
      return { attendance, quizProof, updated: false };
    });

    if ('error' in saved) {
      const duplicate = saved.error === 'DUPLICATE';
      return NextResponse.json({
        success: false,
        error: duplicate ? 'Esta matrícula já possui presença registrada nesta lista.' : 'A coleta de presença foi encerrada pelo organizador.'
      }, { status: duplicate ? 409 : 403 });
    }

    const { quizProofHash: _privateProof, ...safeAttendance } = saved.attendance;
    return NextResponse.json({
      success: true, data: safeAttendance, meetingId: meeting.id,
      ...(saved.quizProof ? { quizProof: saved.quizProof } : {}),
      updated: saved.updated
    });
  } catch (error) {
    console.error("Erro interno no POST /api/presenca");
    return NextResponse.json({ success: false, error: 'Erro interno ao salvar presença' }, { status: 500 });
  }
}