'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Check, ChevronDown, ChevronRight, ClipboardCheck, Copy, Download, ExternalLink, Link2, Loader2, Lock, Pencil,
  Image as ImageIcon, Plus, Power, QrCode, RefreshCw, RotateCcw, Table2, Trash2, Users, X
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import AttachmentManager, { type DdsAttachment } from '@/components/AttachmentManager';
import {
  THEMES_PER_WEEK, MIN_DURATION_HOURS, MAX_DURATION_HOURS, buildThemeWindows, normalizeSlug,
  pickVisibleWeekIndex, type ThemeState
} from '@/lib/ddsSchedule';

type Theme = {
  id: string; order: number; topic: string; objective: string | null; programmaticContent: string | null;
  durationHours: number; opensAt: string; closesAt: string; reopenUntil: string | null;
  state: ThemeState; availableUntil: string | null; meetingId: string | null; signatures: number;
  quizSourceId: string | null; quizTitle: string | null; quizToken: string | null; quizResponses: number;
  attachmentCount: number;
};
type QuizOption = { id: string; title: string; isTemplate: boolean; questions: number };
type Week = { id: string; startsAt: string; endsAt: string; themes: Theme[] };
type Schedule = {
  id: string; slug: string; name: string; farm: string; active: boolean;
  organizerName: string | null; weeks: Week[];
};
type ThemeDraft = {
  id?: string; topic: string; objective: string; programmaticContent: string; durationHours: number; quizSourceId: string;
  locked?: boolean; state?: ThemeState;
  // Imagens: em "Montar semana" ficam no rascunho e são enviadas após salvar; ao copiar
  // de outra semana, as imagens do tema de origem são copiadas no servidor se não forem alteradas.
  attachments?: DdsAttachment[] | null; attachmentsDirty?: boolean; copyFromThemeId?: string; attachmentCount?: number;
};
type PendingUpload = { order: number; attachments: DdsAttachment[] };
type WeekDraft = { mode: 'create' | 'edit'; scheduleId: string; weekId?: string; date: string; time: string; startLocked: boolean; themes: ThemeDraft[] };

const API = '/api/dds-semanal';
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-500';

async function callApi(method: string, body?: unknown, query = '') {
  const response = await fetch(API + query, {
    method, cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

/**
 * Salva as imagens de um tema em etapas, para cada envio ficar pequeno:
 * 1) remove as excluídas (mantendo as já salvas, sem reenviar o conteúdo);
 * 2) envia cada imagem nova numa requisição própria;
 * 3) grava a ordem final, legendas e nomes.
 */
async function saveThemeAttachments(themeId: string, items: DdsAttachment[], onProgress?: (done: number, total: number) => void) {
  const clean = (a: DdsAttachment) => ({ ...a, fileData: undefined, uploadStatus: undefined, errorMessage: undefined });
  const kept = items.filter(a => a.id);
  const fresh = items.filter(a => !a.id);
  if (fresh.length) await callApi('PATCH', { action: 'set_theme_attachments', themeId, attachments: kept.map(clean) });
  const ids = new Map<DdsAttachment, string>();
  for (let i = 0; i < fresh.length; i++) {
    onProgress?.(i, fresh.length);
    const a = fresh[i];
    const res = await callApi('PATCH', { action: 'add_theme_attachment', themeId, attachment: { ...a, uploadStatus: undefined, errorMessage: undefined } });
    ids.set(a, res.attachment.id);
  }
  onProgress?.(fresh.length, fresh.length);
  await callApi('PATCH', { action: 'set_theme_attachments', themeId, attachments: items.map(a => clean({ ...a, id: a.id || ids.get(a) })) });
}

// Limite de PDF por arquivo: cada envio para a hospedagem aceita cerca de 4,5 MB.
const MAX_THEME_PDF_MB = 4;

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
  const [showQr, setShowQr] = useState(false);
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
    // O formulário trabalha em minutos: arredonda para cima para não sobrepor a semana anterior.
    const start = latestEnd && latestEnd > new Date() ? new Date(Math.ceil(latestEnd.getTime() / 60000) * 60000) : nextMondayAt6();
    setDraft({
      mode: 'create', scheduleId: schedule.id, date: toDateInput(start), time: toTimeInput(start), startLocked: false,
      themes: Array.from({ length: THEMES_PER_WEEK }, (_, i) => {
        const t = source?.themes[i];
        return {
          topic: t?.topic || '', objective: t?.objective || '', programmaticContent: t?.programmaticContent || '', durationHours: t?.durationHours || 24, quizSourceId: t?.quizSourceId || '',
          attachments: t && t.attachmentCount > 0 ? null : [], copyFromThemeId: t && t.attachmentCount > 0 ? t.id : undefined, attachmentCount: t?.attachmentCount || 0
        };
      })
    });
  };
  const openEdit = (w: Week) => {
    const start = new Date(w.startsAt);
    setDraft({
      mode: 'edit', scheduleId: schedule.id, weekId: w.id, date: toDateInput(start), time: toTimeInput(start),
      startLocked: w.themes[0].state !== 'LOCKED',
      themes: w.themes.map(t => ({ id: t.id, topic: t.topic, objective: t.objective || '', programmaticContent: t.programmaticContent || '', durationHours: t.durationHours, quizSourceId: t.quizSourceId || '', locked: t.state !== 'LOCKED', state: t.state, attachmentCount: t.attachmentCount }))
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
            <button type="button" onClick={() => setShowQr(v => !v)} className={`rounded-lg border px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 ${showQr ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'}`}><QrCode size={14}/> QR Code</button>
            <a href={`/dds/${schedule.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"><ExternalLink size={14}/> Ver como participante</a>
            <button type="button" disabled={busy} onClick={() => {
              if (schedule.active && !window.confirm('Desativar o link? Os participantes não conseguirão abrir os temas até você ativar de novo.')) return;
              run(() => callApi('PATCH', { action: 'update_schedule', id: schedule.id, active: !schedule.active }), schedule.active ? 'Link desativado.' : 'Link ativado.');
            }} className={`rounded-lg border px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 ${schedule.active ? 'border-slate-200 text-slate-600' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}><Power size={14}/> {schedule.active ? 'Desativar' : 'Ativar link'}</button>
          </div>
        )}
      </div>

      {showQr && !editing && <QrPanel link={link} name={schedule.name} farm={schedule.farm} slug={schedule.slug} onClose={() => setShowQr(false)}/>}

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
        <WeekForm draft={draft} setDraft={setDraft} busy={busy} onError={onError} onCancel={() => setDraft(null)} onSave={async (payload, uploads) => {
          const ok = await run(async () => {
            const res = await callApi(draft.mode === 'create' ? 'POST' : 'PATCH', payload);
            // Imagens dos temas novos vão em requisições separadas (uma por tema) para não estourar o limite de envio.
            for (const upload of uploads) {
              const themeId = res.week?.themes?.find((t: { order: number; id: string }) => t.order === upload.order)?.id;
              if (!themeId) continue;
              try {
                await saveThemeAttachments(themeId, upload.attachments);
              } catch (e: any) {
                throw new Error(`A semana foi salva, mas as imagens do tema ${upload.order + 1} não foram enviadas (${e.message}). Adicione-as pelo botão Imagens do tema.`);
              }
            }
          }, draft.mode === 'create' ? 'Semana cadastrada.' : 'Semana atualizada.');
          if (ok) setDraft(null);
        }}/>
      ) : week ? (
        <WeekTable week={week} busy={busy} run={run} onError={onError} reload={reload}
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

function WeekTable({ week, busy, run, onEdit, onNext, onDelete, onError, reload }: {
  week: Week; busy: boolean; run: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;
  onEdit: () => void; onNext: () => void; onDelete: () => void; onError: (m: string) => void; reload: () => Promise<void>;
}) {
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [imagesId, setImagesId] = useState<string | null>(null);
  const [reopenHours, setReopenHours] = useState(24);
  const [showSummary, setShowSummary] = useState(false);
  useEffect(() => { setShowSummary(false); }, [week.id]);
  const notStarted = week.themes.every(t => t.state === 'LOCKED');
  const allClosed = week.themes.every(t => t.state === 'CLOSED');
  const total = week.themes.reduce((sum, t) => sum + t.signatures, 0);

  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 inline-flex items-center gap-1.5"><Users size={13}/> {total} assinatura(s) nesta semana</p>
        <div className="flex flex-wrap gap-2">
          {!notStarted && <button type="button" onClick={() => setShowSummary(v => !v)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 ${showSummary ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'}`}><Table2 size={13}/> Resumo da semana</button>}
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
                <td className="py-2.5 px-3 font-semibold text-slate-800 min-w-[200px]">
                  {t.topic}
                  {t.quizTitle && <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500"><ClipboardCheck size={12} className="text-emerald-600 shrink-0"/>{t.quizTitle}{t.state !== 'LOCKED' && t.quizToken ? ` · ${t.quizResponses} resposta(s)` : ''}</span>}
                  {t.attachmentCount > 0 && <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500"><ImageIcon size={12} className="text-emerald-600 shrink-0"/>{t.attachmentCount === 1 ? '1 imagem' : `${t.attachmentCount} imagens`}</span>}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap tabular-nums">{fmtShort(t.opensAt)}<br/>→ {fmtShort(until)} <span className="text-slate-400">({t.durationHours} h)</span></td>
                <td className="py-2.5 px-3"><StatePill state={t.state}/></td>
                <td className="py-2.5 px-3 text-right font-black tabular-nums text-slate-800">{t.state === 'LOCKED' ? '—' : t.signatures}</td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                  <button type="button" onClick={() => setImagesId(imagesId === t.id ? null : t.id)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold inline-flex items-center gap-1 ${imagesId === t.id ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'}`}><ImageIcon size={12}/> Imagens</button>
                  {t.state === 'CLOSED' && <button type="button" onClick={() => { setReopenId(reopenId === t.id ? null : t.id); setReopenHours(24); }} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-extrabold text-amber-800 inline-flex items-center gap-1"><RotateCcw size={12}/> Reabrir</button>}
                  {t.state === 'REOPENED' && <button type="button" disabled={busy} onClick={() => run(() => callApi('PATCH', { action: 'close_theme', themeId: t.id }), 'Reabertura encerrada. A ata foi atualizada.')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700">Encerrar</button>}
                </td>
              </tr>
              {imagesId === t.id && <tr className="bg-slate-50 border-b border-slate-200"><td colSpan={6} className="px-3 py-3">
                <ThemeAttachmentsEditor themeId={t.id} topic={t.topic} readOnly={t.state === 'CLOSED' || t.state === 'REOPENED'} isOpen={t.state === 'OPEN'} onError={onError} onSaved={reload}/>
              </td></tr>}
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
      {showSummary && <WeekSummary weekId={week.id}/>}
      <p className="text-[11px] text-slate-500">Temas encerrados geram a ata automaticamente e aparecem em Histórico &amp; Atas, como qualquer DDS.</p>
    </div>
  );
}

function WeekForm({ draft, setDraft, busy, onCancel, onSave, onError }: {
  draft: WeekDraft; setDraft: React.Dispatch<React.SetStateAction<WeekDraft | null>>; busy: boolean;
  onCancel: () => void; onSave: (payload: unknown, uploads: PendingUpload[]) => Promise<void>; onError: (m: string) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [quizOptions, setQuizOptions] = useState<QuizOption[] | null>(null);
  useEffect(() => {
    callApi('GET', undefined, '?quizOptions=1').then(d => setQuizOptions(d.quizzes || [])).catch(e => { setQuizOptions([]); onError(e.message); });
  }, [onError]);
  const templates = (quizOptions || []).filter(q => q.isTemplate);
  const standalone = (quizOptions || []).filter(q => !q.isTemplate);
  const startDate = new Date(`${draft.date}T${draft.time || '06:00'}:00`);
  const validStart = !Number.isNaN(startDate.getTime());
  const windows = validStart ? buildThemeWindows(startDate, draft.themes.map(t => Number(t.durationHours) || MIN_DURATION_HOURS)) : [];

  const setTheme = (i: number, patch: Partial<ThemeDraft>) =>
    setDraft(d => d ? { ...d, themes: d.themes.map((t, j) => j === i ? { ...t, ...patch } : t) } : d);

  // Ao abrir o "Conteúdo" de um tema copiado, carrega as imagens da semana de origem para revisão.
  useEffect(() => {
    if (expanded === null || draft.mode !== 'create') return;
    const t = draft.themes[expanded];
    if (!t || t.attachments !== null || !t.copyFromThemeId) return;
    const i = expanded;
    callApi('GET', undefined, `?themeAttachments=${encodeURIComponent(t.copyFromThemeId)}`)
      .then(d => setTheme(i, { attachments: (d.attachments || []).map((a: DdsAttachment) => ({ ...a, id: undefined })) }))
      .catch(e => { onError(e.message); setTheme(i, { attachments: [], copyFromThemeId: undefined }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, draft.mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const themes = draft.themes.map(t => ({
      id: t.id, topic: t.topic, objective: t.objective, programmaticContent: t.programmaticContent, durationHours: Number(t.durationHours), quizSourceId: t.quizSourceId || null,
      copyAttachmentsFromThemeId: draft.mode === 'create' && t.copyFromThemeId && !t.attachmentsDirty ? t.copyFromThemeId : undefined
    }));
    const uploads: PendingUpload[] = draft.mode === 'create'
      ? draft.themes.map((t, order) => ({ order, attachments: t.attachments || [] })).filter((u, order) => draft.themes[order].attachmentsDirty && u.attachments.length > 0)
      : [];
    const startsAt = startDate.toISOString();
    await onSave(draft.mode === 'create'
      ? { action: 'create_week', scheduleId: draft.scheduleId, startsAt, themes }
      : { action: 'update_week', weekId: draft.weekId, startsAt, themes }, uploads);
  };

  return (
    <form onSubmit={submit} className="p-4 sm:p-5 space-y-4 bg-slate-50/70">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="font-black text-slate-900">{draft.mode === 'create' ? 'Montar semana' : 'Editar semana'}</h4>
          <p className="text-xs text-slate-500">Cada tema abre quando o anterior encerra. Duração mínima de {MIN_DURATION_HOURS} h. O questionário escolhido é publicado junto com o tema e aparece para quem assinar. Em <b>Conteúdo</b> você adiciona as imagens do tema.</p>
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
                <label className="md:col-span-4 text-[11px] font-bold text-slate-600">Tema {i + 1}
                  <input id={`wf-topic-${i}`} required maxLength={200} disabled={t.locked} value={t.topic} onChange={e => setTheme(i, { topic: e.target.value })} placeholder="Ex.: Uso correto de EPI" className={`mt-1 ${inputCls}`}/>
                </label>
                <label className="md:col-span-3 text-[11px] font-bold text-slate-600">Questionário (opcional)
                  <select id={`wf-quiz-${i}`} disabled={t.locked} value={t.quizSourceId} onChange={e => setTheme(i, { quizSourceId: e.target.value })} className={`mt-1 ${inputCls}`}>
                    <option value="">{quizOptions === null ? 'Carregando...' : 'Sem questionário'}</option>
                    {/* Mantém visível uma escolha que não está mais na lista (ex.: modelo excluído) */}
                    {t.quizSourceId && quizOptions && !quizOptions.some(q => q.id === t.quizSourceId) && <option value={t.quizSourceId}>Questionário escolhido anteriormente</option>}
                    {templates.length > 0 && <optgroup label="Modelos">{templates.map(q => <option key={q.id} value={q.id}>{q.title} ({q.questions} perg.)</option>)}</optgroup>}
                    {standalone.length > 0 && <optgroup label="Questionários avulsos">{standalone.map(q => <option key={q.id} value={q.id}>{q.title} ({q.questions} perg.)</option>)}</optgroup>}
                  </select>
                </label>
                <label className="md:col-span-2 text-[11px] font-bold text-slate-600">Aberto por (h)
                  <input id={`wf-dur-${i}`} type="number" required min={MIN_DURATION_HOURS} max={MAX_DURATION_HOURS} step={1} disabled={t.state === 'CLOSED' || t.state === 'REOPENED'} value={t.durationHours} onChange={e => setTheme(i, { durationHours: Number(e.target.value) })} className={`mt-1 ${inputCls}`}/>
                </label>
                <button type="button" onClick={() => setExpanded(expanded === i ? null : i)} className="md:col-span-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold text-slate-600 inline-flex items-center justify-center gap-1" title="Objetivo, conteúdo programático e imagens">{expanded === i ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} Conteúdo{(t.attachments?.length ?? t.attachmentCount ?? 0) > 0 ? <span className="ml-0.5 inline-flex items-center gap-0.5 text-emerald-700"><ImageIcon size={11}/>{t.attachments?.length ?? t.attachmentCount}</span> : null}</button>
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
                  <div className="md:col-span-2 rounded-xl bg-slate-900 p-3">
                    {draft.mode === 'create' ? (
                      t.attachments === null
                        ? <p className="text-xs text-slate-300 inline-flex items-center gap-2"><Loader2 size={13} className="animate-spin"/> Carregando as imagens da semana anterior...</p>
                        : <AttachmentManager attachments={t.attachments || []} maxPdfSizeMb={MAX_THEME_PDF_MB} onChange={updated => setTheme(i, { attachments: updated, attachmentsDirty: true })}/>
                    ) : t.id ? (
                      <ThemeAttachmentsEditor themeId={t.id} topic={t.topic} readOnly={t.state === 'CLOSED' || t.state === 'REOPENED'} isOpen={t.state === 'OPEN'} onError={onError} dark/>
                    ) : null}
                  </div>
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

/** QR Code do link fixo, com cartaz pronto para imprimir e colar no mural. */
function QrPanel({ link, name, farm, slug, onClose }: { link: string; name: string; farm: string; slug: string; onClose: () => void }) {
  const canvasId = `dds-qr-${slug}`;

  const downloadPoster = () => {
    const qr = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!qr) return;
    const W = 1240, H = 1754; // A4 em 150 dpi
    const poster = document.createElement('canvas');
    poster.width = W; poster.height = H;
    const ctx = poster.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, 220);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#34d399'; ctx.font = '800 44px Inter, Arial, sans-serif';
    ctx.fillText('DDS ON', W / 2, 100);
    ctx.fillStyle = '#e2e8f0'; ctx.font = '600 34px Inter, Arial, sans-serif';
    ctx.fillText('Diálogo Diário de Segurança', W / 2, 160);
    ctx.fillStyle = '#0f172a'; ctx.font = '900 76px Inter, Arial, sans-serif';
    ctx.fillText('DDS da semana', W / 2, 360);
    ctx.font = '700 48px Inter, Arial, sans-serif';
    ctx.fillText(name.slice(0, 40), W / 2, 440);
    ctx.fillStyle = '#475569'; ctx.font = '500 36px Inter, Arial, sans-serif';
    ctx.fillText(farm.slice(0, 50), W / 2, 500);
    const size = 760;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, (W - size) / 2, 560, size, size);
    ctx.fillStyle = '#0f172a'; ctx.font = '800 42px Inter, Arial, sans-serif';
    ctx.fillText('Aponte a câmera do celular para assinar', W / 2, 1420);
    ctx.fillStyle = '#475569'; ctx.font = '500 30px Inter, Arial, sans-serif';
    ctx.fillText('O tema do dia libera automaticamente. O link é o mesmo todas as semanas.', W / 2, 1480);
    ctx.fillStyle = '#059669'; ctx.font = '600 30px monospace';
    ctx.fillText(link, W / 2, 1580);
    const a = document.createElement('a');
    a.href = poster.toDataURL('image/png');
    a.download = `cartaz-dds-semanal-${slug}.png`;
    a.click();
  };

  return (
    <div className="mx-4 sm:mx-5 mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 flex flex-col sm:flex-row items-center gap-4">
      <div className="rounded-xl bg-white p-3 border border-slate-200">
        <QRCodeCanvas id={canvasId} value={link} size={176} marginSize={2} level="M"/>
      </div>
      <div className="flex-1 space-y-2 text-center sm:text-left">
        <p className="font-extrabold text-slate-800">QR Code do link fixo</p>
        <p className="text-sm text-slate-600">Imprima e cole no mural, no refeitório ou no ponto de encontro. Como o link não muda, o mesmo cartaz serve para todas as semanas.</p>
        <p className="text-xs font-mono text-emerald-700 break-all">{link}</p>
        <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
          <button type="button" onClick={downloadPoster} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white inline-flex items-center gap-1.5"><Download size={14}/> Baixar cartaz (A4)</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">Fechar</button>
        </div>
      </div>
    </div>
  );
}

type SummaryData = {
  week: { id: string; startsAt: string; endsAt: string; scheduleName: string };
  themes: { order: number; topic: string; opensAt: string; state: ThemeState; hasQuiz: boolean }[];
  rows: { key: string; registration: string | null; name: string; cells: { signed: boolean; score: number | null }[]; signedCount: number; missedCount: number }[];
  signedPerTheme: number[];
};

/** Resumo da semana: quem assinou cada tema, quem faltou e a nota do questionário, por matrícula. */
function WeekSummary({ weekId }: { weekId: string }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null); setError('');
    callApi('GET', undefined, `?summary=${encodeURIComponent(weekId)}`).then(setData).catch(e => setError(e.message));
  }, [weekId]);

  if (error) return <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Montando o resumo...</p>;

  const started = data.themes.filter(t => t.state !== 'LOCKED').length;
  const dayLabel = (t: SummaryData['themes'][number]) => WEEKDAYS[new Date(t.opensAt).getDay()].slice(0, 3);

  const downloadCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Colaborador', 'Matrícula', ...data.themes.map(t => `${dayLabel(t)} ${new Date(t.opensAt).toLocaleDateString('pt-BR')} - ${t.topic}`), 'Assinou', 'Faltou'];
    const lines = data.rows.map(r => [
      r.name, r.registration || '',
      ...r.cells.map((c, i) => data.themes[i].state === 'LOCKED' ? '' : c.signed ? (c.score !== null ? `Assinou (nota ${Math.round(c.score)}%)` : 'Assinou') : 'Faltou'),
      r.signedCount, r.missedCount
    ]);
    const csv = '﻿' + [header, ...lines].map(l => l.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo-dds-semanal-${new Date(data.week.startsAt).toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-extrabold text-slate-800 text-sm">Resumo da semana</p>
          <p className="text-[11px] text-slate-500">{data.rows.length} colaborador(es) assinaram ao menos um tema · {started} de {data.themes.length} temas já começaram. Faltas contam só temas já iniciados.</p>
        </div>
        <button type="button" onClick={downloadCsv} disabled={!data.rows.length} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 disabled:opacity-50"><Download size={13}/> Baixar CSV</button>
      </div>
      {data.rows.length === 0 ? <p className="p-4 text-sm text-slate-500">Ainda não há assinaturas nesta semana.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="py-2 px-3">Colaborador</th><th className="py-2 px-3">Matrícula</th>
              {data.themes.map(t => <th key={t.order} className="py-2 px-2 text-center" title={t.topic}>{dayLabel(t)}</th>)}
              <th className="py-2 px-3 text-right">Assinou</th><th className="py-2 px-3 text-right">Faltou</th>
            </tr></thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">{r.name}</td>
                  <td className="py-2 px-3 font-mono text-slate-600">{r.registration || '—'}</td>
                  {r.cells.map((c, i) => {
                    const locked = data.themes[i].state === 'LOCKED';
                    return <td key={i} className="py-2 px-2 text-center">
                      {locked ? <span className="text-slate-300">·</span>
                        : c.signed ? <span className="inline-flex flex-col items-center leading-tight"><Check size={15} className="text-emerald-600"/>{c.score !== null && <span className={`text-[10px] font-bold ${c.score >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>{Math.round(c.score)}%</span>}</span>
                        : <X size={15} className="inline text-red-500" aria-label="Faltou"/>}
                    </td>;
                  })}
                  <td className="py-2 px-3 text-right font-bold tabular-nums">{r.signedCount}</td>
                  <td className={`py-2 px-3 text-right font-black tabular-nums ${r.missedCount ? 'text-red-600' : 'text-slate-400'}`}>{r.missedCount}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 text-xs font-bold text-slate-600">
                <td className="py-2 px-3" colSpan={2}>Assinaturas por tema</td>
                {data.signedPerTheme.map((n, i) => <td key={i} className="py-2 px-2 text-center tabular-nums">{data.themes[i].state === 'LOCKED' ? '' : n}</td>)}
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Imagens e PDFs de um tema já salvo. Mostrados aos colaboradores na tela de assinatura. */
function ThemeAttachmentsEditor({ themeId, topic, readOnly, isOpen, onError, onSaved, dark }: {
  themeId: string; topic: string; readOnly: boolean; isOpen: boolean;
  onError: (m: string) => void; onSaved?: () => Promise<void>; dark?: boolean;
}) {
  const [items, setItems] = useState<DdsAttachment[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    setItems(null); setDirty(false);
    callApi('GET', undefined, `?themeAttachments=${encodeURIComponent(themeId)}`)
      .then(d => setItems(d.attachments || []))
      .catch(e => { onError(e.message); setItems([]); });
  }, [themeId, onError]);

  const save = async () => {
    if (!items) return;
    setSaving(true); onError('');
    try {
      await saveThemeAttachments(themeId, items, (done, total) => setProgress(total > 1 && done < total ? `Enviando imagem ${done + 1} de ${total}...` : ''));
      const fresh = await callApi('GET', undefined, `?themeAttachments=${encodeURIComponent(themeId)}`);
      setItems(fresh.attachments || []);
      setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
      if (onSaved) await onSaved();
    } catch (e: any) {
      onError(e.message || 'Não foi possível salvar as imagens.');
    } finally { setSaving(false); setProgress(''); }
  };

  return (
    <div className={dark ? '' : 'rounded-xl bg-slate-900 p-3'}>
      {items === null ? (
        <p className="text-xs text-slate-300 inline-flex items-center gap-2"><Loader2 size={13} className="animate-spin"/> Carregando imagens de &quot;{topic}&quot;...</p>
      ) : (
        <>
          <AttachmentManager attachments={items} readOnly={readOnly} maxPdfSizeMb={MAX_THEME_PDF_MB} onChange={updated => { setItems(updated); setDirty(true); }}/>
          {!readOnly && (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <span className="text-[11px] text-slate-300 mr-auto">{isOpen ? 'Tema aberto: ao salvar, os colaboradores já veem as novas imagens.' : 'As imagens aparecem para os colaboradores quando o tema abrir.'}</span>
              {progress && <span className="text-xs font-bold text-slate-300">{progress}</span>}
              {saved && <span className="text-xs font-bold text-emerald-400 inline-flex items-center gap-1"><Check size={13}/> Imagens salvas</span>}
              <button type="button" disabled={!dirty || saving} onClick={save} className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-xs font-extrabold text-slate-950 inline-flex items-center gap-1.5 disabled:opacity-40">{saving ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>} Salvar imagens</button>
            </div>
          )}
          {readOnly && <p className="mt-2 text-[11px] text-slate-400">Tema encerrado: as imagens ficam como foram publicadas na ata.</p>}
        </>
      )}
    </div>
  );
}
