// app/api/dds-semanal/route.ts
// DDS Semanal (link fixo): gestão pelo organizador.
//
// GET                         → programações visíveis ao usuário, com semanas e temas
// GET ?quizOptions=1           → questionários que podem ser usados nos temas (modelos e avulsos)
// GET ?summary=<weekId>        → resumo da semana (assinaturas e notas por matrícula)
// POST  { action: 'create_schedule', name, farm, slug }
// POST  { action: 'create_week', scheduleId, startsAt, themes: [7 × { topic, objective, programmaticContent, durationHours }] }
// PATCH { action: 'update_schedule', id, name?, farm?, slug?, active? }
// PATCH { action: 'update_week', weekId, startsAt?, themes: [7 × { id, topic, objective, programmaticContent, durationHours }] }
// PATCH { action: 'reopen_theme', themeId, hours }
// PATCH { action: 'close_theme', themeId }        (encerra uma reabertura)
// DELETE { weekId }                               (só semanas que ainda não começaram)

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { ensureDdsScheduleTables } from '@/lib/ddsScheduleTables';
import { syncScheduleThemes } from '@/lib/ddsScheduleSync';
import {
  THEMES_PER_WEEK, MAX_REOPEN_HOURS, buildThemeWindows, validateDurations, getThemeState,
  overlapsAnyWeek, normalizeSlug, isValidSlug, buildWeekSummary
} from '@/lib/ddsSchedule';

export const dynamic = 'force-dynamic';

const json = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

function canManage(user: any, schedule: { organizerId: string; companyId: string | null }) {
  return user.role === 'SUPER_ADMIN' ||
    schedule.organizerId === user.id ||
    (user.role === 'COMPANY_ADMIN' && !!user.companyId && user.companyId === schedule.companyId);
}

function visibleWhere(user: any) {
  if (user.role === 'SUPER_ADMIN') return {};
  if (user.role === 'COMPANY_ADMIN' && user.companyId) return { OR: [{ organizerId: user.id }, { companyId: user.companyId }] };
  return { organizerId: user.id };
}

async function readBody(req: Request) {
  try { return await req.json(); } catch { return null; }
}

type ThemeInput = { topic: string; objective: string | null; programmaticContent: string | null; durationHours: number; quizSourceId: string | null };

function parseThemes(raw: unknown): { themes?: ThemeInput[]; error?: string } {
  if (!Array.isArray(raw) || raw.length !== THEMES_PER_WEEK) return { error: `Informe exatamente ${THEMES_PER_WEEK} temas.` };
  const durationError = validateDurations(raw.map((t: any) => t?.durationHours));
  if (durationError) return { error: durationError };
  const themes: ThemeInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t: any = raw[i] || {};
    const topic = text(t.topic, 200);
    if (!topic) return { error: `Informe o tema do dia ${i + 1}.` };
    themes.push({
      topic,
      objective: text(t.objective, 1000) || null,
      programmaticContent: text(t.programmaticContent, 3000) || null,
      durationHours: Number(t.durationHours),
      quizSourceId: typeof t.quizSourceId === 'string' && t.quizSourceId.trim() ? t.quizSourceId.trim() : null
    });
  }
  return { themes };
}

/** Questionários que o usuário pode usar como origem: modelos e avulsos (sem DDS), com perguntas. */
function quizSourceWhere(user: any) {
  const source = { OR: [{ isTemplate: true }, { meetingId: null }], questions: { some: {} } };
  if (user.role === 'SUPER_ADMIN') return source;
  return {
    AND: [source, {
      OR: [
        { meetingId: null }, { creatorId: user.id }, { creatorId: null },
        { meeting: { organizerId: user.id } },
        ...(user.companyId ? [{ meeting: { companyId: user.companyId } }] : [])
      ]
    }]
  };
}

async function validateQuizSources(user: any, themes: ThemeInput[]): Promise<string | null> {
  const ids = [...new Set(themes.map(t => t.quizSourceId).filter(Boolean) as string[])];
  if (!ids.length) return null;
  const found = await prisma.quiz.findMany({ where: { AND: [{ id: { in: ids } }, quizSourceWhere(user)] }, select: { id: true } });
  if (found.length !== ids.length) return 'Um dos questionários escolhidos não está disponível (precisa ser modelo ou avulso e ter perguntas).';
  return null;
}

function serializeSchedule(schedule: any, now: Date, quizTitles: Map<string, string>) {
  return {
    id: schedule.id, slug: schedule.slug, name: schedule.name, farm: schedule.farm, active: schedule.active,
    organizerId: schedule.organizerId, organizerName: schedule.organizer?.name || null,
    weeks: schedule.weeks.map((week: any) => ({
      id: week.id, startsAt: week.startsAt, endsAt: week.endsAt,
      themes: week.themes.map((theme: any) => {
        const { state, availableUntil } = getThemeState(theme, now);
        return {
          id: theme.id, order: theme.order, topic: theme.topic, objective: theme.objective,
          programmaticContent: theme.programmaticContent, durationHours: theme.durationHours,
          opensAt: theme.opensAt, closesAt: theme.closesAt, reopenUntil: theme.reopenUntil,
          state, availableUntil, meetingId: theme.meetingId,
          signatures: theme.meeting?._count?.attendees ?? 0,
          quizSourceId: theme.quizSourceId,
          quizTitle: theme.meeting?.quizzes?.[0]?.title || (theme.quizSourceId ? quizTitles.get(theme.quizSourceId) || null : null),
          quizToken: theme.meeting?.quizzes?.[0]?.shareToken || null,
          quizResponses: theme.meeting?.quizzes?.[0]?._count?.attempts ?? 0
        };
      })
    }))
  };
}

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  await ensureDdsScheduleTables();
  const params = new URL(req.url).searchParams;
  try {
    if (params.get('quizOptions')) {
      const quizzes = await prisma.quiz.findMany({
        where: quizSourceWhere(user),
        orderBy: [{ isTemplate: 'desc' }, { createdAt: 'desc' }],
        take: 200,
        select: { id: true, title: true, isTemplate: true, status: true, _count: { select: { questions: true } } }
      });
      return NextResponse.json({ success: true, quizzes: quizzes.map(q => ({ id: q.id, title: q.title, isTemplate: q.isTemplate, questions: q._count.questions })) });
    }

    const summaryWeekId = params.get('summary');
    if (summaryWeekId) {
      const week = await prisma.ddsScheduleWeek.findUnique({
        where: { id: summaryWeekId },
        include: {
          schedule: true,
          themes: {
            orderBy: { order: 'asc' },
            include: {
              meeting: {
                select: {
                  attendees: { select: { registration: true, name: true }, orderBy: { createdAt: 'asc' } },
                  quizzes: { select: { attempts: { select: { participantRegistration: true, participantName: true, score: true } } } }
                }
              }
            }
          }
        }
      });
      if (!week) return json('Semana não encontrada.', 404);
      if (!canManage(user, week.schedule)) return json('Acesso negado a esta programação.', 403);
      const now = new Date();
      const summary = buildWeekSummary(week.themes.map(t => ({
        order: t.order,
        state: getThemeState(t, now).state,
        attendees: t.meeting?.attendees || [],
        attempts: (t.meeting?.quizzes || []).flatMap(q => q.attempts.map(a => ({ registration: a.participantRegistration, name: a.participantName, score: a.score })))
      })));
      return NextResponse.json({
        success: true,
        week: { id: week.id, startsAt: week.startsAt, endsAt: week.endsAt, scheduleName: week.schedule.name },
        themes: week.themes.map(t => ({ order: t.order, topic: t.topic, opensAt: t.opensAt, state: getThemeState(t, now).state, hasQuiz: Boolean(t.meeting?.quizzes?.length) })),
        ...summary
      });
    }

    const where = visibleWhere(user);
    await syncScheduleThemes({ week: { schedule: where } });
    const now = new Date();
    const schedules = await prisma.ddsSchedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        organizer: { select: { name: true } },
        weeks: {
          orderBy: { startsAt: 'desc' },
          take: 12,
          include: {
            themes: {
              orderBy: { order: 'asc' },
              include: {
                meeting: {
                  select: {
                    _count: { select: { attendees: true } },
                    quizzes: { orderBy: { createdAt: 'desc' }, take: 1, select: { title: true, shareToken: true, _count: { select: { attempts: true } } } }
                  }
                }
              }
            }
          }
        }
      }
    });
    const sourceIds = [...new Set(schedules.flatMap(s => s.weeks.flatMap(w => w.themes.map(t => t.quizSourceId))).filter(Boolean) as string[])];
    const sources = sourceIds.length ? await prisma.quiz.findMany({ where: { id: { in: sourceIds } }, select: { id: true, title: true } }) : [];
    const quizTitles = new Map(sources.map(q => [q.id, q.title]));
    return NextResponse.json({ success: true, now, schedules: schedules.map(s => serializeSchedule(s, now, quizTitles)) });
  } catch (error) {
    console.error('Erro ao carregar o DDS Semanal:', error);
    return json('Não foi possível carregar o DDS Semanal.', 500);
  }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  if (!['SUPER_ADMIN', 'COMPANY_ADMIN', 'ORGANIZER'].includes(user.role)) return json('Acesso negado.', 403);
  await ensureDdsScheduleTables();
  const body = await readBody(req);
  if (!body) return json('Solicitação inválida.', 400);

  try {
    if (body.action === 'create_schedule') {
      const name = text(body.name, 120);
      const farm = text(body.farm, 150);
      const slug = normalizeSlug(text(body.slug, 80) || name);
      if (!name) return json('Informe o nome da equipe ou programação.', 400);
      if (!farm) return json('Informe a unidade ou local.', 400);
      if (!isValidSlug(slug)) return json('O link deve ter de 3 a 60 caracteres: letras minúsculas, números e hífen.', 400);
      if (await prisma.ddsSchedule.findUnique({ where: { slug } })) return json('Este link já está em uso. Escolha outro.', 409);
      const schedule = await prisma.ddsSchedule.create({
        data: { name, farm, slug, organizerId: user.id, companyId: user.companyId || null }
      });
      return NextResponse.json({ success: true, schedule }, { status: 201 });
    }

    if (body.action === 'create_week') {
      const schedule = await prisma.ddsSchedule.findUnique({
        where: { id: String(body.scheduleId || '') },
        include: { weeks: { select: { id: true, startsAt: true, endsAt: true } } }
      });
      if (!schedule) return json('Programação não encontrada.', 404);
      if (!canManage(user, schedule)) return json('Acesso negado a esta programação.', 403);
      const startsAt = new Date(body.startsAt);
      if (Number.isNaN(startsAt.getTime())) return json('Informe a data e o horário de início da semana.', 400);
      const { themes, error } = parseThemes(body.themes);
      if (error || !themes) return json(error || 'Temas inválidos.', 400);
      const quizError = await validateQuizSources(user, themes);
      if (quizError) return json(quizError, 400);
      const windows = buildThemeWindows(startsAt, themes.map(t => t.durationHours));
      const now = new Date();
      if (windows[0].closesAt.getTime() <= now.getTime()) return json('O primeiro tema já estaria encerrado. Escolha um início mais recente.', 400);
      const endsAt = windows[THEMES_PER_WEEK - 1].closesAt;
      if (overlapsAnyWeek(startsAt, endsAt, schedule.weeks)) return json('Esta semana se sobrepõe a outra semana já cadastrada nesta programação.', 409);
      const week = await prisma.ddsScheduleWeek.create({
        data: {
          scheduleId: schedule.id, startsAt, endsAt,
          themes: { create: themes.map((t, i) => ({ ...t, order: i, opensAt: windows[i].opensAt, closesAt: windows[i].closesAt })) }
        }
      });
      await syncScheduleThemes({ weekId: week.id });
      return NextResponse.json({ success: true, week }, { status: 201 });
    }

    return json('Ação inválida.', 400);
  } catch (error: any) {
    if (error?.code === 'P2002') return json('Este link já está em uso. Escolha outro.', 409);
    console.error('Erro ao salvar o DDS Semanal:', error);
    return json('Não foi possível salvar.', 500);
  }
}

export async function PATCH(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  await ensureDdsScheduleTables();
  const body = await readBody(req);
  if (!body) return json('Solicitação inválida.', 400);
  const now = new Date();

  try {
    if (body.action === 'update_schedule') {
      const schedule = await prisma.ddsSchedule.findUnique({ where: { id: String(body.id || '') } });
      if (!schedule) return json('Programação não encontrada.', 404);
      if (!canManage(user, schedule)) return json('Acesso negado a esta programação.', 403);
      const data: { name?: string; farm?: string; slug?: string; active?: boolean } = {};
      if (body.name !== undefined) { data.name = text(body.name, 120); if (!data.name) return json('Informe o nome.', 400); }
      if (body.farm !== undefined) { data.farm = text(body.farm, 150); if (!data.farm) return json('Informe a unidade ou local.', 400); }
      if (body.slug !== undefined) {
        const slug = normalizeSlug(text(body.slug, 80));
        if (!isValidSlug(slug)) return json('O link deve ter de 3 a 60 caracteres: letras minúsculas, números e hífen.', 400);
        if (slug !== schedule.slug && await prisma.ddsSchedule.findUnique({ where: { slug } })) return json('Este link já está em uso. Escolha outro.', 409);
        data.slug = slug;
      }
      if (body.active !== undefined) data.active = Boolean(body.active);
      const updated = await prisma.ddsSchedule.update({ where: { id: schedule.id }, data });
      return NextResponse.json({ success: true, schedule: updated });
    }

    if (body.action === 'update_week') {
      const week = await prisma.ddsScheduleWeek.findUnique({
        where: { id: String(body.weekId || '') },
        include: {
          themes: { orderBy: { order: 'asc' } },
          schedule: { include: { weeks: { select: { id: true, startsAt: true, endsAt: true } } } }
        }
      });
      if (!week) return json('Semana não encontrada.', 404);
      if (!canManage(user, week.schedule)) return json('Acesso negado a esta programação.', 403);
      const { themes, error } = parseThemes(body.themes);
      if (error || !themes) return json(error || 'Temas inválidos.', 400);
      const states = week.themes.map(t => getThemeState(t, now).state);
      const quizError = await validateQuizSources(user, themes.filter((_, i) => states[i] === 'LOCKED' && themes[i].quizSourceId !== week.themes[i].quizSourceId));
      if (quizError) return json(quizError, 400);

      let startsAt = week.startsAt;
      if (states[0] === 'LOCKED' && body.startsAt) {
        startsAt = new Date(body.startsAt);
        if (Number.isNaN(startsAt.getTime())) return json('Data de início inválida.', 400);
      }
      const durations = themes.map((t, i) => (states[i] === 'CLOSED' || states[i] === 'REOPENED') ? week.themes[i].durationHours : t.durationHours);
      const windows = buildThemeWindows(startsAt, durations);
      for (let i = 0; i < THEMES_PER_WEEK; i++) {
        if (states[i] !== 'LOCKED' && windows[i].opensAt.getTime() !== week.themes[i].opensAt.getTime()) {
          return json('Não é possível alterar o horário de temas que já começaram.', 400);
        }
        if (states[i] === 'OPEN' && windows[i].closesAt.getTime() <= now.getTime()) {
          return json(`O tema ${i + 1} está aberto: o novo encerramento precisa ser depois de agora.`, 400);
        }
      }
      if (states[0] === 'LOCKED' && windows[0].closesAt.getTime() <= now.getTime()) return json('O primeiro tema já estaria encerrado. Escolha um início mais recente.', 400);
      const endsAt = windows[THEMES_PER_WEEK - 1].closesAt;
      if (overlapsAnyWeek(startsAt, endsAt, week.schedule.weeks, week.id)) return json('Com essas durações a semana passa a se sobrepor a outra semana já cadastrada.', 409);

      await prisma.$transaction([
        prisma.ddsScheduleWeek.update({ where: { id: week.id }, data: { startsAt, endsAt } }),
        ...week.themes.map((stored, i) => prisma.ddsScheduleTheme.update({
          where: { id: stored.id },
          data: {
            // Conteúdo só muda em temas que ainda não abriram (o DDS já criado preserva o registro).
            ...(states[i] === 'LOCKED' ? { topic: themes[i].topic, objective: themes[i].objective, programmaticContent: themes[i].programmaticContent, quizSourceId: themes[i].quizSourceId } : {}),
            durationHours: durations[i], opensAt: windows[i].opensAt, closesAt: windows[i].closesAt
          }
        }))
      ]);
      await syncScheduleThemes({ weekId: week.id });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'reopen_theme' || body.action === 'close_theme') {
      const theme = await prisma.ddsScheduleTheme.findUnique({
        where: { id: String(body.themeId || '') },
        include: { week: { include: { schedule: true } } }
      });
      if (!theme) return json('Tema não encontrado.', 404);
      if (!canManage(user, theme.week.schedule)) return json('Acesso negado a esta programação.', 403);
      const { state } = getThemeState(theme, now);

      if (body.action === 'reopen_theme') {
        const hours = Number(body.hours);
        if (!Number.isInteger(hours) || hours < 1 || hours > MAX_REOPEN_HOURS) return json(`Informe por quantas horas reabrir (1 a ${MAX_REOPEN_HOURS}).`, 400);
        if (state !== 'CLOSED' && state !== 'REOPENED') return json('Só é possível reabrir um tema encerrado.', 400);
        await prisma.ddsScheduleTheme.update({ where: { id: theme.id }, data: { reopenUntil: new Date(now.getTime() + hours * 3600 * 1000) } });
      } else {
        if (state !== 'REOPENED') return json('Este tema não está reaberto.', 400);
        await prisma.ddsScheduleTheme.update({ where: { id: theme.id }, data: { reopenUntil: now } });
      }
      await syncScheduleThemes({ id: theme.id }, new Date(now.getTime() + 1));
      return NextResponse.json({ success: true });
    }

    return json('Ação inválida.', 400);
  } catch (error: any) {
    if (error?.code === 'P2002') return json('Este link já está em uso. Escolha outro.', 409);
    console.error('Erro ao atualizar o DDS Semanal:', error);
    return json('Não foi possível salvar as alterações.', 500);
  }
}

export async function DELETE(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  await ensureDdsScheduleTables();
  const body = await readBody(req);
  if (!body || typeof body.weekId !== 'string') return json('Solicitação inválida.', 400);
  try {
    const week = await prisma.ddsScheduleWeek.findUnique({ where: { id: body.weekId }, include: { schedule: true, themes: true } });
    if (!week) return json('Semana não encontrada.', 404);
    if (!canManage(user, week.schedule)) return json('Acesso negado a esta programação.', 403);
    const now = new Date();
    if (week.themes.some(t => t.meetingId || getThemeState(t, now).state !== 'LOCKED')) {
      return json('Esta semana já começou e não pode ser excluída. Os DDS realizados ficam no Histórico.', 400);
    }
    await prisma.ddsScheduleWeek.delete({ where: { id: week.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir semana do DDS Semanal:', error);
    return json('Não foi possível excluir a semana.', 500);
  }
}
