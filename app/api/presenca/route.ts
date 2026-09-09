// app/api/presenca/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, cpf, savedSelfie, savedSignature, meetingId } = body;

    // 1. Validação estrita de tipos e presença dos campos
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'O nome completo é obrigatório (mínimo 2 caracteres).' }, { status: 400 });
    }

    if (!cpf || typeof cpf !== 'string' || cpf.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'A função/cargo é obrigatória.' }, { status: 400 });
    }

    if (!meetingId || typeof meetingId !== 'string') {
      return NextResponse.json({ success: false, error: 'Identificador do DDS não informado ou inválido.' }, { status: 400 });
    }

    const trimmedName = name.trim().slice(0, 100);
    const trimmedCpf = cpf.trim().slice(0, 80);

    // 2. Busca a reunião específica para vincular com precisão
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId }
    });

    if (!meeting) {
      return NextResponse.json({ success: false, error: 'Reunião não encontrada ou link inexistente.' }, { status: 404 });
    }

    // 3. Regra de Segurança: Reunião precisa estar ativa ('LIVE')
    if (meeting.status !== 'LIVE') {
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

    // 5. Validação de formato e tamanho de imagens (Selfie e Assinatura)
    let sanitizedSelfie = '';
    if (typeof savedSelfie === 'string' && savedSelfie.length > 50) {
      if (!savedSelfie.startsWith('data:image/') && !savedSelfie.startsWith('http')) {
        return NextResponse.json({ success: false, error: 'Formato de foto inválido.' }, { status: 400 });
      }
      // Limite máximo de segurança: 800KB em Base64
      if (savedSelfie.length > 850000) {
        return NextResponse.json({ success: false, error: 'A foto é muito grande. Tente novamente.' }, { status: 400 });
      }
      sanitizedSelfie = savedSelfie;
    }

    let sanitizedSignature = '';
    if (typeof savedSignature === 'string' && savedSignature.length > 50) {
      if (!savedSignature.startsWith('data:image/') && !savedSignature.startsWith('http')) {
        return NextResponse.json({ success: false, error: 'Formato de assinatura inválido.' }, { status: 400 });
      }
      if (savedSignature.length > 500000) {
        return NextResponse.json({ success: false, error: 'A assinatura excedeu o tamanho permitido.' }, { status: 400 });
      }
      sanitizedSignature = savedSignature;
    }

    // 6. Evita duplicatas/sobrescritas indevidas de homônimos
    const existing = await prisma.attendance.findFirst({
      where: {
        meetingId: meeting.id,
        name: { equals: trimmedName, mode: 'insensitive' },
        cpf: { equals: trimmedCpf, mode: 'insensitive' }
      }
    });

    if (existing) {
      // Se for o mesmo colaborador atualizando seus dados na mesma sessão ativa
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          name: trimmedName,
          cpf: trimmedCpf,
          selfie: sanitizedSelfie || existing.selfie,
          signature: sanitizedSignature || existing.signature
        }
      });
      return NextResponse.json({ success: true, data: updated, meetingId: meeting.id, updated: true });
    }

    // 7. Salva a presença atrelada estritamente à reunião correta
    const attendance = await prisma.attendance.create({
      data: {
        name: trimmedName,
        cpf: trimmedCpf,
        selfie: sanitizedSelfie,
        signature: sanitizedSignature,
        meetingId: meeting.id
      }
    });

    return NextResponse.json({ success: true, data: attendance, meetingId: meeting.id });

  } catch (error) {
    console.error("Erro interno no POST /api/presenca");
    return NextResponse.json({ success: false, error: 'Erro interno ao salvar presença' }, { status: 500 });
  }
}