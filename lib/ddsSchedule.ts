// lib/ddsSchedule.ts
// Regras do DDS Semanal (link fixo). Funções puras, sem acesso a banco,
// para serem testadas isoladamente (tests/ddsSchedule.test.cjs).
//
// Todos os horários são instantes absolutos (Date/ISO em UTC). A conversão para
// o horário de Brasília acontece só na tela, no navegador do usuário.

export const THEMES_PER_WEEK = 7;
export const MIN_DURATION_HOURS = 24;
export const MAX_DURATION_HOURS = 168;
export const MAX_REOPEN_HOURS = 168;

const HOUR_MS = 60 * 60 * 1000;

export type ThemeState = 'LOCKED' | 'OPEN' | 'REOPENED' | 'CLOSED';

export interface ThemeWindow { opensAt: Date; closesAt: Date }

export interface ThemeTiming {
  opensAt: Date | string;
  closesAt: Date | string;
  reopenUntil?: Date | string | null;
}

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

/**
 * Encadeia os temas: o 1º abre em `startsAt` e cada tema seguinte abre
 * exatamente quando o anterior encerra.
 */
export function buildThemeWindows(startsAt: Date, durationsHours: number[]): ThemeWindow[] {
  let cursor = startsAt.getTime();
  return durationsHours.map(hours => {
    const opensAt = new Date(cursor);
    cursor += hours * HOUR_MS;
    return { opensAt, closesAt: new Date(cursor) };
  });
}

/** Valida as durações dos 7 temas. Retorna a mensagem de erro ou null. */
export function validateDurations(durationsHours: unknown[]): string | null {
  if (!Array.isArray(durationsHours) || durationsHours.length !== THEMES_PER_WEEK) {
    return `A semana precisa ter exatamente ${THEMES_PER_WEEK} temas.`;
  }
  for (let i = 0; i < durationsHours.length; i++) {
    const hours = Number(durationsHours[i]);
    if (!Number.isInteger(hours) || hours < MIN_DURATION_HOURS || hours > MAX_DURATION_HOURS) {
      return `O tema ${i + 1} deve ficar aberto entre ${MIN_DURATION_HOURS} e ${MAX_DURATION_HOURS} horas (número inteiro).`;
    }
  }
  return null;
}

/**
 * Situação de um tema num instante.
 * - LOCKED: ainda não abriu.
 * - OPEN: entre a abertura e o encerramento.
 * - REOPENED: já encerrou, mas o organizador reabriu até `reopenUntil`.
 * - CLOSED: encerrado.
 * `availableUntil` é até quando aceita assinaturas (null quando não aceita).
 */
export function getThemeState(theme: ThemeTiming, now: Date): { state: ThemeState; availableUntil: Date | null } {
  const opensAt = toDate(theme.opensAt);
  const closesAt = toDate(theme.closesAt);
  const reopenUntil = theme.reopenUntil ? toDate(theme.reopenUntil) : null;
  const t = now.getTime();
  if (t < opensAt.getTime()) return { state: 'LOCKED', availableUntil: null };
  if (t < closesAt.getTime()) {
    // Uma reabertura que vai além do encerramento normal estende o prazo.
    const until = reopenUntil && reopenUntil.getTime() > closesAt.getTime() ? reopenUntil : closesAt;
    return { state: 'OPEN', availableUntil: until };
  }
  if (reopenUntil && t < reopenUntil.getTime()) return { state: 'REOPENED', availableUntil: reopenUntil };
  return { state: 'CLOSED', availableUntil: null };
}

export function isAvailable(state: ThemeState) {
  return state === 'OPEN' || state === 'REOPENED';
}

/**
 * Escolhe a semana exibida no link fixo: a que está em andamento; senão a
 * próxima agendada; senão a mais recente já encerrada. Retorna o índice ou -1.
 */
export function pickVisibleWeekIndex(weeks: { startsAt: Date | string; endsAt: Date | string }[], now: Date): number {
  const t = now.getTime();
  let current = -1, next = -1, last = -1;
  weeks.forEach((week, i) => {
    const start = toDate(week.startsAt).getTime();
    const end = toDate(week.endsAt).getTime();
    if (start <= t && t < end) current = i;
    else if (start > t && (next === -1 || start < toDate(weeks[next].startsAt).getTime())) next = i;
    else if (end <= t && (last === -1 || end > toDate(weeks[last].endsAt).getTime())) last = i;
  });
  return current !== -1 ? current : next !== -1 ? next : last;
}

/** Verifica se o intervalo [start, end) cruza alguma semana existente. */
export function overlapsAnyWeek(
  start: Date, end: Date,
  weeks: { id?: string; startsAt: Date | string; endsAt: Date | string }[],
  ignoreWeekId?: string
): boolean {
  return weeks.some(week => (ignoreWeekId === undefined || week.id !== ignoreWeekId) &&
    start.getTime() < toDate(week.endsAt).getTime() && toDate(week.startsAt).getTime() < end.getTime());
}

/** Gera o identificador do link fixo a partir de um texto: "Equipe Campo" → "equipe-campo". */
export function normalizeSlug(value: string): string {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/.test(slug) && !slug.includes('--');
}

// ---------------------------------------------------------------------------
// Resumo da semana: quem assinou cada tema, quem faltou e a nota do questionário.

export interface SummaryThemeInput {
  order: number;
  state: ThemeState;
  attendees: { registration: string | null; name: string }[];
  attempts: { registration: string | null; name: string | null; score: number }[];
}

export interface SummaryCell { signed: boolean; score: number | null }
export interface SummaryRow { key: string; registration: string | null; name: string; cells: SummaryCell[]; signedCount: number; missedCount: number }

const personKey = (registration: string | null, name: string | null) =>
  registration && registration.trim() ? 'r:' + registration.trim() : 'n:' + String(name || '').trim().toLocaleLowerCase('pt-BR');

/**
 * Monta a matriz colaborador × tema. Considera quem assinou ao menos um tema da
 * semana. "Faltou" só conta temas que já começaram (não bloqueados).
 */
export function buildWeekSummary(themes: SummaryThemeInput[]): { rows: SummaryRow[]; signedPerTheme: number[] } {
  const sorted = [...themes].sort((a, b) => a.order - b.order);
  const rows = new Map<string, SummaryRow>();
  const ensure = (registration: string | null, name: string) => {
    const key = personKey(registration, name);
    let row = rows.get(key);
    if (!row) {
      row = { key, registration: registration?.trim() || null, name: name.trim(), cells: sorted.map(() => ({ signed: false, score: null })), signedCount: 0, missedCount: 0 };
      rows.set(key, row);
    }
    if (name.trim()) row.name = name.trim();
    return row;
  };

  sorted.forEach((theme, i) => {
    for (const a of theme.attendees) ensure(a.registration, a.name).cells[i].signed = true;
  });
  sorted.forEach((theme, i) => {
    for (const attempt of theme.attempts) {
      const row = rows.get(personKey(attempt.registration, attempt.name));
      if (!row) continue; // respondeu sem assinatura: não entra na matriz de presença
      const cell = row.cells[i];
      if (cell.score === null || attempt.score > cell.score) cell.score = attempt.score;
    }
  });

  const result = [...rows.values()].map(row => {
    row.signedCount = row.cells.filter(c => c.signed).length;
    row.missedCount = row.cells.filter((c, i) => !c.signed && sorted[i].state !== 'LOCKED').length;
    return row;
  }).sort((a, b) => b.missedCount - a.missedCount || a.name.localeCompare(b.name, 'pt-BR'));

  return { rows: result, signedPerTheme: sorted.map((_, i) => result.filter(r => r.cells[i].signed).length) };
}
