// lib/ddsScheduleSync.ts
// Mantém o DDS (Meeting) de cada tema do DDS Semanal coerente com o horário.
// Não há tarefa agendada: esta sincronização roda quando alguém acessa o link
// fixo, a tela do organizador ou o painel. Mesmo sem acesso, a rota de presença
// recusa assinaturas fora do prazo porque o DDS sai com inviteExpiresAt = prazo.

import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getThemeState, isAvailable } from '@/lib/ddsSchedule';

type ThemeWhere = Record<string, unknown>;

/**
 * Mesmo cálculo de hash usado ao encerrar um DDS em /api/reuniao, para que a
 * ata de um tema semanal tenha a mesma verificação de integridade.
 */
function computeDocumentHash(meeting: {
  id: string; topic: string | null; createdAt: Date;
  attendees: { id: string; name: string; cpf: string }[];
  attachments: { id: string; fileName: string }[];
}, endedAt: Date) {
  const digest = [
    meeting.id,
    meeting.topic || '',
    meeting.createdAt?.toISOString() || '',
    endedAt.toISOString(),
    meeting.attendees.map(a => [a.id, a.name, a.cpf].join(':')).join(';'),
    meeting.attachments.map(att => [att.id, att.fileName].join(':')).join(';')
  ].join('|');
  return crypto.createHash('sha256').update(digest).digest('hex');
}

const sameTime = (a: Date | null | undefined, b: Date | null | undefined) =>
  (a ? a.getTime() : null) === (b ? b.getTime() : null);

/**
 * Sincroniza os temas que podem precisar de ajuste (já abertos e com DDS ao vivo,
 * reaberto ou ainda sem DDS). `where` restringe a busca, ex.: { week: { scheduleId } }.
 */
export async function syncScheduleThemes(where: ThemeWhere = {}, now = new Date()) {
  const candidates = await prisma.ddsScheduleTheme.findMany({
    where: {
      ...where,
      opensAt: { lte: now },
      OR: [
        { meetingId: null, closesAt: { gt: now } },
        { reopenUntil: { gt: now } },
        { meeting: { status: 'LIVE' } },
        { meeting: { attendanceCollectionOpen: true } }
      ]
    },
    include: {
      week: { select: { schedule: { select: { farm: true, organizerId: true, companyId: true, active: true } } } },
      meeting: { select: { id: true, status: true, attendanceCollectionOpen: true, inviteExpiresAt: true, endedAt: true } }
    }
  });

  for (const theme of candidates) {
    try {
      await syncOne(theme, now);
    } catch (error) {
      console.error(`Falha ao sincronizar o tema ${theme.id} do DDS Semanal:`, error);
    }
  }
}

async function syncOne(theme: any, now: Date) {
  const { state, availableUntil } = getThemeState(theme, now);

  if (isAvailable(state)) {
    if (!theme.meeting) {
      if (!theme.week.schedule.active) return; // link desativado: não abre novos DDS
      // Cria o DDS do tema uma única vez, mesmo com acessos simultâneos.
      await prisma.$transaction(async tx => {
        await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))', theme.id);
        const fresh = await tx.ddsScheduleTheme.findUnique({ where: { id: theme.id }, select: { meetingId: true } });
        if (fresh?.meetingId) return;
        const schedule = theme.week.schedule;
        const meeting = await tx.meeting.create({
          data: {
            topic: theme.topic.slice(0, 200),
            farm: schedule.farm.slice(0, 150),
            type: 'PRESENTIAL',
            classification: 'DDS',
            objective: theme.objective,
            programmaticContent: theme.programmaticContent,
            status: 'LIVE',
            organizerId: schedule.organizerId,
            companyId: schedule.companyId,
            inviteExpiresAt: availableUntil,
            createdAt: theme.opensAt
          }
        });
        await tx.ddsScheduleTheme.update({ where: { id: theme.id }, data: { meetingId: meeting.id } });
      });
      return;
    }

    const meeting = theme.meeting;
    if (meeting.status === 'LIVE') {
      if (!sameTime(meeting.inviteExpiresAt, availableUntil)) {
        await prisma.meeting.update({ where: { id: meeting.id }, data: { inviteExpiresAt: availableUntil } });
      }
      return;
    }
    // DDS já encerrado e tema reaberto: usa a coleta complementar que já existe.
    if (!meeting.attendanceCollectionOpen || !sameTime(meeting.inviteExpiresAt, availableUntil)) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { attendanceCollectionOpen: true, documentHash: null, inviteExpiresAt: availableUntil }
      });
    }
    return;
  }

  if (state === 'CLOSED' && theme.meeting && (theme.meeting.status === 'LIVE' || theme.meeting.attendanceCollectionOpen)) {
    await finalizeMeeting(theme.meeting.id, theme.closesAt);
  }
}

/** Encerra o DDS do tema e gera a ata com hash, como o botão "Encerrar" do painel. */
async function finalizeMeeting(meetingId: string, scheduledEnd: Date) {
  await prisma.$transaction(async tx => {
    // Mesmo bloqueio da rota de presença: nenhuma assinatura entra durante o fechamento.
    await tx.$queryRawUnsafe('SELECT 1 AS lock_acquired FROM pg_advisory_xact_lock(hashtext($1))', meetingId);
    const current = await tx.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true, status: true, topic: true, createdAt: true, endedAt: true, attendanceCollectionOpen: true,
        attendees: { select: { id: true, name: true, cpf: true }, orderBy: { createdAt: 'asc' } },
        attachments: { select: { id: true, fileName: true }, orderBy: { order: 'asc' } }
      }
    });
    if (!current || (current.status === 'ENDED' && !current.attendanceCollectionOpen)) return;
    const endedAt = current.endedAt ?? scheduledEnd;
    await tx.meeting.update({
      where: { id: meetingId },
      data: { status: 'ENDED', endedAt, attendanceCollectionOpen: false, documentHash: computeDocumentHash(current, endedAt) }
    });
  });
}
