'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Check, ChevronDown, ChevronRight, Copy, ExternalLink, Link2, Loader2, Lock, Pencil,
  Plus, Power, RefreshCw, RotateCcw, Trash2, Users, X
} from 'lucide-react';
import {
  THEMES_PER_WEEK, MIN_DURATION_HOURS, MAX_DURATION_HOURS, buildThemeWindows, normalizeSlug,
  pickVisibleWeekIndex, type ThemeState
} from '@/lib/ddsSchedule';

type Theme = {
  id: string; order: number; topic: string; objective: string | null; programmaticContent: string | null;
  durationHours: number; opensAt: string; closesAt: string; reopenUntil: string | null;
  state: ThemeState; availableUntil: string | null; meetingId: string | null; signatures: number;
};
type Week = { id: string; startsAt: string; endsAt: string; themes: Theme[] };
type Schedule = {
  id: string; slug: string; name: string; farm: string; active: boolean;
  organizerName: string | null; weeks: Week[];
};
type ThemeDraft = { id?: string; topic: string; objective: string; programmaticContent: string; durationHours: number; locked?: boolean; state?: ThemeState };
type WeekDraft = { mode: 'create' | 'edit'; scheduleId: string; weekId?: string; date: string; time: string; startLocked: boolean; themes: ThemeDraft[] };

const API = '/api/dds-semanal';
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-500';

async function callApi(method: string, body?: unknown) {
  const response = await fetch(API, {
    method, cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtShort = (value: string | Date) => {
  const d = new Date(value);
  return `${WEEKDAYS[d.getDay()].slice(0, 3).toLowerCase()} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtRange = (a: string, b: string) => {
  const s = new Date(a), e = new Date(b);
  return `${pad(s.getDate())}/${pad(s.getMonth() + 1)} a ${pad(e.getDate())}/${pad(e.getMonth() + 1)}/${e.getFullYear()}`;
};
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function nextMondayAt6() {
  const d = new Date();
  d.setHours(6, 0, 0, 0);
  const add = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d;
}

const STATE_UI: Record<ThemeState, { label: string; cls: string }> = {
  LOCKED: { label: 'Bloqueado', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  OPEN: { label: 'Aberto', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REOPENED: { label: 'Reaberto', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  CLOSED: { label: 'Encerrado', cls: 'bg-slate-100 text-slate-400 border-slate-200' }
};

function StatePill({ state }: { state: ThemeState }) {
  const ui = STATE_UI[state];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${ui.cls}`}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{ui.label}</span>;
}

export default function WeeklyDdsManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await callApi('GET');
      setSchedules(data.schedules || []);
      setError('');
    } catch (e: any) { setError(e.message || 'Erro ao carregar.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Atualiza sozinho para refletir aberturas, encerramentos e novas assinaturas.
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) load(true); }, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 3500); };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <CalendarDays size={18} className="text-emerald-600 shrink-0 mt-0.5"/>
          <p className="text-sm text-slate-600"><span className="font-extrabold text-slate-800">Um link fixo por equipe.</span> Monte os 7 temas da semana: cada tema abre sozinho no horário, fica disponível por no mínimo 24 h e encerra quando o próximo começa.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => load()} className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs inline-flex items-center gap-1.5"><RefreshCw size={13}/> Atualizar</button>
          <button type="button" onClick={() => setShowNew(v => !v)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5"><Plus size={14}/> Nova programação</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

      {showNew && <NewScheduleForm onCancel={() => setShowNew(false)} onError={setError} onCreated={async () => { setShowNew(false); await load(true); flash('Programação criada. Agora monte a primeira semana.'); }}/>}

      {loading ? <div className="py-14 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/>Carregando...</div> :
        schedules.length === 0 && !showNew ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <CalendarDays size={34} className="mx-auto text-slate-300"/>
            <h3 className="mt-3 font-black text-slate-800">Nenhuma programação semanal</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Crie uma programação para ter um link fixo de DDS. Você divulga o link uma vez no grupo e cadastra os temas de cada semana.</p>
            <button type="button" onClick={() => setShowNew(true)} className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white font-extrabold text-sm inline-flex items-center gap-1.5"><Plus size={15}/> Nova programação</button>
          </div>
        ) : (
          <div className="space-y-5">
            {schedules.map(s => <ScheduleCard key={s.id} schedule={s} reload={() => load(true)} onError={setError} flash={flash}/>)}
          </div>
        )}
    </div>
  );
}

function NewScheduleForm({ onCancel, onCreated, onError }: { onCancel: () => void; onCreated: () => Promise<void>; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [farm, setFarm] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const effectiveSlug = slugTouched ? slug : normalizeSlug(name);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); onError('');
    try {
      await callApi('POST', { action: 'create_schedule', name, farm, slug: effectiveSlug });
      await onCreated();
    } catch (err: any) { onError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
      <div>
        <h3 className="font-black text-slate-900 text-lg">Nova programação semanal</h3>
        <p className="text-sm text-slate-500">Uma programação é uma equipe ou frente de trabalho. Ela tem um link fixo que não muda de uma semana para outra.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs font-bold text-slate-700">Nome da equipe ou programação
          <input id="ws-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Equipe de Campo" className={`mt-1 ${inputCls}`}/>
        </label>
        <label className="text-xs font-bold text-slate-700">Unidade ou local
          <input id="ws-farm" required maxLength={150} value={farm} onChange={e => setFarm(e.target.value)} placeholder="Ex.: Fazenda Santa Clara" className={`mt-1 ${inputCls}`}/>
        </label>
        <label className="text-xs font-bold text-slate-700">Link fixo
          <input id="ws-slug" required maxLength={60} value={effectiveSlug} onChange={e => { setSlugTouched(true); setSlug(normalizeSlug(e.target.value)); }} className={`mt-1 ${inputCls} font-mono`}/>
          <span className="mt-1 block text-[11px] font-medium text-slate-500 break-all">{origin}/dds/<b>{effectiveSlug || '...'}</b></span>
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm">Cancelar</button>
        <button disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm inline-flex items-center gap-1.5 disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin"/> : <Check size={15}/>} Criar programação</button>
      </div>
    </form>
  );
}

function ScheduleCard({ schedule, reload, onError, flash }: { schedule: Schedule; reload: () => Promise<void>; onError: (m: string) => void; flash: (m: string) => void }) {
  const weeksAsc = useMemo(() => [...schedule.weeks].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)), [schedule.weeks]);
  const defaultIndex = pickVisibleWeekIndex(weeksAsc, new Date());
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const week = weeksAsc.find(w => w.id === selectedWeekId) || weeksAsc[defaultIndex] || null;
  const [draft, setDraft] = useState<WeekDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: schedule.name, farm: schedule.farm, slug: schedule.slug });
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = `${origin}/dds/${schedule.slug}`;
  const latestEnd = weeksAsc.length ? new Date(weeksAsc[weeksAsc.length - 1].endsAt) : null;

  const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true); onError('');
    try { await fn(); await reload(); if (okMsg) flash(okMsg); return true; }
    catch (e: any) { onError(e.message); return false; }
    finally { setBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); flash('Link copiado. Cole no grupo da equipe.'); }
    catch { window.prompt('Copie o link:', link); }
  };

  const openCreate = (source?: Week) => {
    const start = latestEnd && latestEnd > new Date() ? latestEnd : nextMondayAt6();
    setDraft({
      mode: 'create', scheduleId: schedule.id, date: toDateInput(start), time: toTimeInput(start), startLocked: false,
      themes: Array.from({ length: THEMES_PER_WEEK }, (_, i) => {
        const t = source?.themes[i];
        return { topic: t?.topic || '', objective: t?.objective || '', programmaticContent: t?.programmaticContent || '', durationHours: t?.durationHours || 24 };
      })
    });
  };
  const openEdit = (w: Week) => {
    const start = new Date(w.startsAt);
    setDraft({
      mode: 'edit', scheduleId: schedule.id, weekId: w.id, date: toDateInput(start), time: toTimeInput(start),
      startLocked: w.themes[0].state !== 'LOCKED',
      themes: w.themes.map(t => ({ id: t.id, topic: t.topic, objective: t.objective || '', programmaticContent: t.programmaticContent || '', durationHours: t.durationHours, locked: t.state !== 'LOCKED', state: t.state }))
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100">
        {editing ? (
          <form className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1" onSubmit={async e => { e.preventDefault(); if (await run(() => callApi('PATCH', { action: 'update_schedule', id: schedule.id, ...form }), 'Programação atualizada.')) setEditing(false); }}>
            <input aria-label="Nome" maxLength={120} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls}/>
            <input aria-label="Unidade" maxLength={150} value={form.farm} onChange={e => setForm(f => ({ ...f, farm: e.target.value }))} className={inputCls}/>
            <div className="flex gap-2">
              <input aria-label="Link fixo" maxLength={60} value={form.slug} onChange={e => setForm(f => ({ ...f, slug: normalizeSlug(e.target.value) }))} className={`${inputCls} font-mono`}/>
              <button disabled={busy} className="rounded-lg bg-emerald-600 px-2.5 text-white" title="Salvar"><Check size={16}/></button>
              <button type="button" onClick={() => { setEditing(false); setForm({ name: schedule.name, farm: schedule.farm, slug: schedule.slug }); }} className="rounded-lg border border-slate-200 px-2.5 text-slate-600" title="Cancelar"><X size={16}/></button>
            </div>
            {form.slug !== schedule.slug && <p className="sm:col-span-3 text-[11px] font-semibold text-amber-700">Ao trocar o link, o endereço antigo deixa de funcionar. Divulgue o novo link no grupo.</p>}
          </form>
        ) : (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-slate-900 text-lg">{schedule.name}</h3>
              <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500" title="Editar nome, unidade e link"><Pencil size={13}/></button>
              {!schedule.active && <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-red-600">Link desativado</span>}
            </div>
            <p className="text-sm text-slate-500">{schedule.farm}{schedule.organizerName ? ` · ${schedule.organizerName}` : ''}</p>
            <p className="mt-1 text-xs font-mono text-emerald-700 break-all inline-flex items-center gap-1"><Link2 size={12}/>{link}</p>
          </div>
        )}
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white inline-flex items-center gap-1.5"><Copy size={14}/> Copiar link fixo</button>
            <a href={`/dds/${schedule.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"><ExternalLink size={14}/> Ver como participante</a>
            <button type="button" disabled={busy} onClick={() => {
              if (schedule.active && !window.confirm('Desativar o link? Os participantes não conseguirão abrir os temas até você ativar de novo.')) return;
              run(() => callApi('PATCH', { action: 'update_schedule', id: schedule.id, active: !schedule.active }), schedule.active ? 'Link desativado.' : 'Link ativado.');
            }} className={`rounded-lg border px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 ${schedule.active ? 'border-slate-200 text-slate-600' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}><Power size={14}/> {schedule.active ? 'Desativar' : 'Ativar link'}</button>
          </div>
        )}
      </div>

      {weeksAsc.length > 0 && (
        <div className="px-4 sm:px-5 pt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1">Semanas</span>
          {weeksAsc.map(w => {
            const now = Date.now();
            const isCurrent = +new Date(w.startsAt) <= now && now < +new Date(w.endsAt);
            const selected = week?.id === w.id;
            return <button key={w.id} type="button" onClick={() => { setSelectedWeekId(w.id); setDraft(null); }} className={`rounded-full border px-3 py-1 text-xs font-bold ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}`}>
              {fmtRange(w.startsAt, w.endsAt)}{isCurrent && <span className="ml-1.5 text-emerald-600">● atual</span>}
            </button>;
          })}
        </div>
      )}

      {draft ? (
        <WeekForm draft={draft} setDraft={setDraft} busy={busy} onCancel={() => setDraft(null)} onSave={async payload => {
          const ok = await run(() => callApi(draft.mode === 'create' ? 'POST' : 'PATCH', payload), draft.mode === 'create' ? 'Semana cadastrada.' : 'Semana atualizada.');
          if (ok) setDraft(null);
        }}/>
      ) : week ? (
        <WeekTable week={week} busy={busy} run={run}
          onEdit={() => openEdit(week)}
          onNext={() => openCreate(weeksAsc[weeksAsc.length - 1])}
          onDelete={() => { if (window.confirm('Excluir esta semana? Ela ainda não começou, então nenhum registro será perdido.')) run(() => callApi('DELETE', { weekId: week.id }), 'Semana excluída.').then(() => setSelectedWeekId(null)); }}
        />
      ) : (
        <div className="p-6 text-center">
          <p className="text-sm text-slate-500">Nenhuma semana cadastrada. O link já funciona e mostra "nenhum tema disponível" até você montar a primeira semana.</p>
          <button type="button" onClick={() => openCreate()} className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 text-white font-extrabold text-sm inline-flex items-center gap-1.5"><Plus size={15}/> Montar primeira semana</button>
        </div>
      )}
    </section>
  );
}

function WeekTable({ week, busy, run, onEdit, onNext, onDelete }: {
  week: Week; busy: boolean; run: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;
  onEdit: () => void; onNext: () => void; onDelete: () => void;
}) {
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [reopenHours, setReopenHours] = useState(24);
  const notStarted = week.themes.every(t => t.state === 'LOCKED');
  const allClosed = week.themes.every(t => t.state === 'CLOSED');
  const total = week.themes.reduce((sum, t) => sum + t.signatures, 0);

  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 inline-flex items-center gap-1.5"><Users size={13}/> {total} assinatura(s) nesta semana</p>
        <div className="flex flex-wrap gap-2">
          {!allClosed && <button type="button" onClick={onEdit} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"><Pencil size={13}/> Editar semana</button>}
          <button type="button" onClick={onNext} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800 inline-flex items-center gap-1.5"><Plus size={13}/> Montar próxima semana</button>
          {notStarted && <button type="button" disabled={busy} onClick={onDelete} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 inline-flex items-center gap-1.5"><Trash2 size={13}/> Excluir semana</button>}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
            <th className="py-2 px-3">Dia</th><th className="py-2 px-3">Tema</th><th className="py-2 px-3">Disponível</th><th className="py-2 px-3">Situação</th><th className="py-2 px-3 text-right">Assinaturas</th><th className="py-2 px-3"></th>
          </tr></thead>
          <tbody>{week.themes.map(t => {
            const until = t.state === 'REOPENED' && t.reopenUntil ? t.reopenUntil : t.closesAt;
            return <React.Fragment key={t.id}>
              <tr className={`border-b border-slate-100 last:border-0 ${t.state === 'OPEN' ? 'bg-emerald-50/60' : t.state === 'REOPENED' ? 'bg-blue-50/60' : ''}`}>
                <td className="py-2.5 px-3 font-extrabold text-slate-800 whitespace-nowrap">{WEEKDAYS[new Date(t.opensAt).getDay()]}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-800 min-w-[200px]">{t.topic}</td>
                <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap tabular-nums">{fmtShort(t.opensAt)}<br/>→ {fmtShort(until)} <span className="text-slate-400">({t.durationHours} h)</span></td>
                <td className="py-2.5 px-3"><StatePill state={t.state}/></td>
                <td className="py-2.5 px-3 text-right font-black tabular-nums text-slate-800">{t.state === 'LOCKED' ? '—' : t.signatures}</td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {t.state === 'CLOSED' && <button type="button" onClick={() => { setReopenId(reopenId === t.id ? null : t.id); setReopenHours(24); }} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-extrabold text-amber-800 inline-flex items-center gap-1"><RotateCcw size={12}/> Reabrir</button>}
                  {t.state === 'REOPENED' && <button type="button" disabled={busy} onClick={() => run(() => callApi('PATCH', { action: 'close_theme', themeId: t.id }), 'Reabertura encerrada. A ata foi atualizada.')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700">Encerrar</button>}
                </td>
              </tr>
              {reopenId === t.id && <tr className="bg-blue-50 border-b border-blue-100"><td colSpan={6} className="px-3 py-3">
                <div className="flex flex-wrap items-end gap-3">
                  <p className="text-sm text-slate-700 flex-1 min-w-[220px]"><b>Reabrir &quot;{t.topic}&quot;</b><br/><span className="text-xs text-slate-500">O tema volta a aceitar assinaturas junto com o tema do dia e encerra sozinho no prazo. A ata é atualizada no encerramento.</span></p>
                  <label className="text-xs font-bold text-slate-600">Aberto por mais
                    <select value={reopenHours} onChange={e => setReopenHours(Number(e.target.value))} className={`mt-1 ${inputCls} w-28`}>
                      {[2, 4, 8, 12, 24, 48, 72].map(h => <option key={h} value={h}>{h} h</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => setReopenId(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">Cancelar</button>
                  <button type="button" disabled={busy} onClick={async () => { if (await run(() => callApi('PATCH', { action: 'reopen_theme', themeId: t.id, hours: reopenHours }), 'Tema reaberto.')) setReopenId(null); }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-extrabold text-white inline-flex items-center gap-1.5">{busy ? <Loader2 size={13} className="animate-spin"/> : <RotateCcw size={13}/>} Reabrir tema</button>
                </div>
              </td></tr>}
            </React.Fragment>;
          })}</tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">Temas encerrados geram a ata automaticamente e aparecem em Histórico &amp; Atas, como qualquer DDS.</p>
    </div>
  );
}

function WeekForm({ draft, setDraft, busy, onCancel, onSave }: {
  draft: WeekDraft; setDraft: React.Dispatch<React.SetStateAction<WeekDraft | null>>; busy: boolean;
  onCancel: () => void; onSave: (payload: unknown) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const startDate = new Date(`${draft.date}T${draft.time || '06:00'}:00`);
  const validStart = !Number.isNaN(startDate.getTime());
  const windows = validStart ? buildThemeWindows(startDate, draft.themes.map(t => Number(t.durationHours) || MIN_DURATION_HOURS)) : [];

  const setTheme = (i: number, patch: Partial<ThemeDraft>) =>
    setDraft(d => d ? { ...d, themes: d.themes.map((t, j) => j === i ? { ...t, ...patch } : t) } : d);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const themes = draft.themes.map(t => ({ id: t.id, topic: t.topic, objective: t.objective, programmaticContent: t.programmaticContent, durationHours: Number(t.durationHours) }));
    const startsAt = startDate.toISOString();
    await onSave(draft.mode === 'create'
      ? { action: 'create_week', scheduleId: draft.scheduleId, startsAt, themes }
      : { action: 'update_week', weekId: draft.weekId, startsAt, themes });
  };

  return (
    <form onSubmit={submit} className="p-4 sm:p-5 space-y-4 bg-slate-50/70">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="font-black text-slate-900">{draft.mode === 'create' ? 'Montar semana' : 'Editar semana'}</h4>
          <p className="text-xs text-slate-500">Cada tema abre quando o anterior encerra. Duração mínima de {MIN_DURATION_HOURS} h.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-bold text-slate-700">Início do 1º tema
            <input id="wf-date" type="date" required disabled={draft.startLocked} value={draft.date} onChange={e => setDraft(d => d ? { ...d, date: e.target.value } : d)} className={`mt-1 ${inputCls}`}/>
          </label>
          <label className="text-xs font-bold text-slate-700">Horário
            <input id="wf-time" type="time" required disabled={draft.startLocked} value={draft.time} onChange={e => setDraft(d => d ? { ...d, time: e.target.value } : d)} className={`mt-1 ${inputCls}`}/>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        {draft.themes.map((t, i) => {
          const w = windows[i];
          return (
            <div key={i} className={`rounded-xl border p-3 ${t.state === 'OPEN' ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-2">
                  <p className="text-sm font-extrabold text-slate-800">{w ? WEEKDAYS[w.opensAt.getDay()] : `Tema ${i + 1}`}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">{w ? <>{fmtShort(w.opensAt)}<br/>→ {fmtShort(w.closesAt)}</> : '—'}</p>
                </div>
                <label className="md:col-span-7 text-[11px] font-bold text-slate-600">Tema {i + 1}
                  <input id={`wf-topic-${i}`} required maxLength={200} disabled={t.locked} value={t.topic} onChange={e => setTheme(i, { topic: e.target.value })} placeholder="Ex.: Uso correto de EPI" className={`mt-1 ${inputCls}`}/>
                </label>
                <label className="md:col-span-2 text-[11px] font-bold text-slate-600">Aberto por (h)
                  <input id={`wf-dur-${i}`} type="number" required min={MIN_DURATION_HOURS} max={MAX_DURATION_HOURS} step={1} disabled={t.state === 'CLOSED' || t.state === 'REOPENED'} value={t.durationHours} onChange={e => setTheme(i, { durationHours: Number(e.target.value) })} className={`mt-1 ${inputCls}`}/>
                </label>
                <button type="button" onClick={() => setExpanded(expanded === i ? null : i)} className="md:col-span-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold text-slate-600 inline-flex items-center justify-center gap-1" title="Objetivo e conteúdo programático">{expanded === i ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} Conteúdo</button>
              </div>
              {t.locked && <p className="mt-1 text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1"><Lock size={11}/> {t.state === 'OPEN' ? 'Tema aberto: só a duração pode mudar (para estender ou antecipar o encerramento).' : 'Tema encerrado: fica como foi publicado.'}</p>}
              {expanded === i && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="text-[11px] font-bold text-slate-600">Objetivo
                    <textarea id={`wf-obj-${i}`} rows={3} maxLength={1000} disabled={t.locked} value={t.objective} onChange={e => setTheme(i, { objective: e.target.value })} className={`mt-1 ${inputCls}`}/>
                  </label>
                  <label className="text-[11px] font-bold text-slate-600">Conteúdo programático
                    <textarea id={`wf-cont-${i}`} rows={3} maxLength={3000} disabled={t.locked} value={t.programmaticContent} onChange={e => setTheme(i, { programmaticContent: e.target.value })} className={`mt-1 ${inputCls}`}/>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-sm">Cancelar</button>
        <button disabled={busy || !validStart} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm inline-flex items-center gap-1.5 disabled:opacity-60">{busy ? <Loader2 size={15} className="animate-spin"/> : <Check size={15}/>} {draft.mode === 'create' ? 'Salvar semana' : 'Salvar alterações'}</button>
      </div>
    </form>
  );
}
