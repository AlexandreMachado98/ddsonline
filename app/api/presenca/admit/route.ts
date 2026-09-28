import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';
import { POST as handleSaida } from '@/app/api/saida/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, name, cpf, savedSelfie, savedSignature, meetingId, exitReason, exitSignature } = body;

    // --- 1. DELEGAÇÃO SEGURA PARA SAÍDA ---
    if (action === 'register_exit') {
      const forwardedReq = new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify({
          name,
          cpf,
          meetingId,
          exitReason,
          exitSignature
        })
      });
      return handleSaida(forwardedReq);
    }

    // --- 2. VALIDAÇÃO ESTRITA DE ENTRADA DO DDS ---
    if (!meetingId || typeof meetingId !== 'string' || meetingId === 'dds-principal' || meetingId.trim().length < 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Identificador do DDS inválido ou não informado. Acesse através do link oficial do DDS.' 
      }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'O nome completo é obrigatório (mínimo 2 caracteres).' }, { status: 400 });
    }

    if (!cpf || typeof cpf !== 'string' || cpf.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'A função/cargo é obrigatória.' }, { status: 400 });
    }

    const cleanMeetingId = meetingId.trim();
    const cleanName = name.trim().slice(0, 100);
    const cleanCpf = cpf.trim().slice(0, 80);

    // 3. Busca estritamente a reunião vinculada
    const meeting = await prisma.meeting.findUnique({
      where: { id: cleanMeetingId },
      include: {
        company: true,
        organizer: {
          include: { companyRel: true }
        }
      }
    });

    if (!meeting) {
      return NextResponse.json({ 
        success: false, 
        error: 'Reunião de DDS não encontrada. Verifique o link ou solicite um novo ao organizador.' 
      }, { status: 404 });
    }

    // 4. Verificação de status da reunião
    if (meeting.status !== 'LIVE') {
      logSecurityEvent('FORBIDDEN_ACCESS', {
        path: 'POST /api/presenca/admit',
        reason: `ATTEMPT_ATTENDANCE_ON_CLOSED_MEETING (${meeting.id})`
      });
      return NextResponse.json({ 
        success: false, 
        error: '⛔ Este DDS já foi finalizado e não aceita mais novas presenças.' 
      }, { status: 403 });
    }

    // 5. Kill-Switch da Empresa
    const companyStatus = meeting.company?.status || meeting.organizer?.companyRel?.status;
    if (companyStatus === 'SUSPENDED' || companyStatus === 'BLOCKED') {
      return NextResponse.json({ 
        success: false, 
        error: '⛔ O acesso para a empresa responsável por este DDS está suspenso.' 
      }, { status: 403 });
    }

    // 6. Sanitização de mídias
    let sanitizedSelfie = '';
    if (typeof savedSelfie === 'string' && savedSelfie.length > 50) {
      if (savedSelfie.startsWith('data:image/') || savedSelfie.startsWith('http')) {
        sanitizedSelfie = savedSelfie.slice(0, 850000);
      }
    }

    let sanitizedSignature = '';
    if (typeof savedSignature === 'string' && savedSignature.length > 50) {
      if (savedSignature.startsWith('data:image/') || savedSignature.startsWith('http')) {
        sanitizedSignature = savedSignature.slice(0, 500000);
      }
    }

    // 7. Evita duplicatas do mesmo colaborador na mesma reunião
    const existing = await prisma.attendance.findFirst({
      where: {
        meetingId: meeting.id,
        name: { equals: cleanName, mode: 'insensitive' },
        cpf: { equals: cleanCpf, mode: 'insensitive' }
      }
    });

    if (existing) {
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          name: cleanName,
          cpf: cleanCpf,
          selfie: sanitizedSelfie || existing.selfie,
          signature: sanitizedSignature || existing.signature
        }
      });

      return NextResponse.json({ 
        success: true, 
        data: updated, 
        attendanceId: updated.id,
        status: 'ADMITTED',
        meetingType: meeting.type || 'PRESENTIAL',
        updated: true
      });
    }

    // 8. Registra presença vinculada
    const attendance = await prisma.attendance.create({
      data: {
        name: cleanName,
        cpf: cleanCpf,
        selfie: sanitizedSelfie,
        signature: sanitizedSignature,
        meetingId: meeting.id
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: attendance, 
      attendanceId: attendance.id,
      status: 'ADMITTED',
      meetingType: meeting.type || 'PRESENTIAL'
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no servidor';
    console.error("Erro na API Central de Presença:", message);
    return NextResponse.json({ success: false, error: 'Falha ao processar presença' }, { status: 500 });
  }
}