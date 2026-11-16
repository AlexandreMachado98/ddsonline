// app/api/dds-semanal/publico/route.ts
// Dados públicos do link fixo (/dds/<slug>): temas da semana e situação de cada um.
// O conteúdo de temas bloqueados não é enviado.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureDdsScheduleTables } from '@/lib/ddsScheduleTables';
import { syncScheduleThemes } from '@/lib/ddsScheduleSync';
import { getThemeState, isAvailable, pickVisibleWeekIndex } from '@/lib/ddsSchedule';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug')?.trim().toLowerCase() || '';
  if (!slug || slug.length > 80) {
    return NextResponse.json({ success: false, error: 'Link inválido.' }, { status: 400, headers: noStore });
  }
  await ensureDdsScheduleTables();

  try {
    const schedule = await prisma.ddsSchedule.findUnique({
      where: { slug },
      select: { id: true, name: true, farm: true, active: true, company: { select: { name: true } } }
    });
    if (!schedule || !schedule.active) {
      return NextResponse.json({ success: false, error: 'Este link de DDS não existe ou foi desativado pelo organizador.' }, { status: 404, headers: noStore });
    }

    await syncScheduleThemes({ week: { scheduleId: schedule.id } });
    const now = new Date();

    const weeks = await prisma.ddsScheduleWeek.findMany({
      where: { scheduleId: schedule.id },
      orderBy: { startsAt: 'asc' },
      include: {
        themes: {
          orderBy: { order: 'asc' },
          include: { meeting: { select: { quizzes: { where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { shareToken: true } } } } }
        }
      }
    });

    const toPublic = (theme: any) => {
      const { state, availableUntil } = getThemeState(theme, now);
      const available = isAvailable(state);
      return {
        id: theme.id, order: theme.order, state,
        opensAt: theme.opensAt, closesAt: theme.closesAt, availableUntil,
        topic: state === 'LOCKED' ? null : theme.topic,
        objective: available ? theme.objective : null,
        meetingId: available ? theme.meetingId : null,
        quizToken: available ? theme.meeting?.quizzes?.[0]?.shareToken || null : null
      };
    };

    const index = pickVisibleWeekIndex(weeks, now);
    const week = index >= 0 ? weeks[index] : null;
    // Temas reabertos de outras semanas também aparecem enquanto aceitam assinatura.
    const reopenedElsewhere = weeks
      .filter(w => w !== week)
      .flatMap(w => w.themes)
      .filter(t => isAvailable(getThemeState(t, now).state))
      .map(toPublic);

    return NextResponse.json({
      success: true,
      now,
      schedule: { name: schedule.name, farm: schedule.farm, company: schedule.company?.name || null },
      week: week ? { startsAt: week.startsAt, endsAt: week.endsAt, themes: week.themes.map(toPublic) } : null,
      reopenedElsewhere
    }, { headers: noStore });
  } catch (error) {
    console.error('Erro ao carregar o link fixo do DDS Semanal:', error);
    return NextResponse.json({ success: false, error: 'Não foi possível carregar os temas agora. Tente novamente em instantes.' }, { status: 500, headers: noStore });
  }
}
