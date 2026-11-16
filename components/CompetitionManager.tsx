'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Crown, Loader2, Pencil, Plus, RefreshCw, RotateCcw, SlidersHorizontal, Star, Trash2, Trophy, Users, X } from 'lucide-react';

type Participant = {
  registration: string; name: string; totalPoints: number;
  ddsParticipations: number; quizParticipations: number; performancePoints: number; speedPoints: number;
  bonusPoints?: number; bonus?: Record<string, { quantity: number; points: number }>;
};
type BonusCriterion = { id: string; name: string; weight: number };
type BonusEntry = {
  id: string; criterionId: string; criterionName: string; weight: number;
  participantRegistration: string; participantName: string;
  quantity: number; points: number; note?: string | null; createdAt: string;
};
type Competition = {
  id: string; name: string; description?: string | null;
  startDate: string; endDate: string; status: 'SCHEDULED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  ddsAttendancePoints: number; quizParticipationPoints: number; quizPerformancePoints: number; quizSpeedPoints: number;
  leaderboard: Participant[];
  bonusCriteria?: BonusCriterion[];
  bonusEntries?: BonusEntry[];
};

async function callApi(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

const BONUS_API = '/api/competicoes/pontos-extras';
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500';

/** Editor de um lançamento já incluído, exibido na própria linha (lista detalhada e ranking). */
function EntryInlineEditor({ entry, criteria, onSaved, onCancel, onError }: {
  entry: BonusEntry; criteria: BonusCriterion[];
  onSaved: () => Promise<void>; onCancel: () => void; onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    criterionId: entry.criterionId, registration: entry.participantRegistration,
    name: entry.participantName, quantity: entry.quantity, note: entry.note || ''
  });
  const [saving, setSaving] = useState(false);
  const criterion = criteria.find(c => c.id === form.criterionId);
  const points = (criterion?.weight || 0) * (Number(form.quantity) || 0);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.registration.trim() || !form.name.trim()) { onError('Informe matrícula e nome do colaborador.'); return; }
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) === 0) { onError('A quantidade deve ser um número inteiro diferente de zero.'); return; }
    setSaving(true); onError('');
    try {
      await callApi(BONUS_API, 'PATCH', { kind: 'entry', id: entry.id, ...form, quantity: Number(form.quantity) });
      await onSaved();
      onCancel();
    } catch (err: any) { onError(err.message || 'Erro ao salvar o lançamento.'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} onKeyDown={e => { if (e.key === 'Escape') onCancel(); }} className="rounded-xl border-2 border-amber-300 bg-amber-50/70 p-3 grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-12 gap-2 items-end">
      <label className="col-span-2 sm:col-span-3 lg:col-span-3 text-[11px] font-semibold text-slate-600">Critério
        <select value={form.criterionId} onChange={e => setForm(f => ({ ...f, criterionId: e.target.value }))} className={`mt-1 ${inputCls}`}>
          {criteria.map(c => <option key={c.id} value={c.id}>{c.name} (peso {c.weight})</option>)}
        </select>
      </label>
      <label className="col-span-1 sm:col-span-1 lg:col-span-2 text-[11px] font-semibold text-slate-600">Matrícula
        <input maxLength={40} value={form.registration} onChange={e => setForm(f => ({ ...f, registration: e.target.value }))} className={`mt-1 ${inputCls} font-mono`}/>
      </label>
      <label className="col-span-1 sm:col-span-2 lg:col-span-3 text-[11px] font-semibold text-slate-600">Colaborador
        <input maxLength={160} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={`mt-1 ${inputCls}`}/>
      </label>
      <label className="col-span-1 sm:col-span-1 lg:col-span-2 text-[11px] font-semibold text-slate-600">Quantidade
        <input autoFocus type="number" min="-1000" max="1000" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value === '' ? ('' as any) : Number(e.target.value) }))} className={`mt-1 ${inputCls}`}/>
      </label>
      <div className="col-span-1 sm:col-span-1 lg:col-span-2 text-[11px] font-semibold text-slate-600">Pontos
        <div className={`mt-1 rounded-lg border px-3 py-2 text-sm font-black ${points < 0 ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {points}{points !== entry.points && <span className="ml-1 text-[10px] font-semibold text-slate-400 line-through">{entry.points}</span>}
        </div>
      </div>
      <label className="col-span-2 sm:col-span-4 lg:col-span-8 text-[11px] font-semibold text-slate-600">Observação
        <input maxLength={500} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={`mt-1 ${inputCls}`}/>
      </label>
      <div className="col-span-2 sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">Cancelar</button>
        <button disabled={saving} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white inline-flex items-center gap-1.5 disabled:opacity-60">{saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>} Salvar correção</button>
      </div>
    </form>
  );
}

/** Painel de pesos dos critérios automáticos, critérios extras e lançamentos manuais. */
function ScoringPanel({ comp, onChanged, onError }: { comp: Competition; onChanged: () => Promise<void>; onError: (msg: string) => void }) {
  const criteria = comp.bonusCriteria || [];
  const entries = comp.bonusEntries || [];
  const locked = comp.status === 'CANCELLED';
  const [busy, setBusy] = useState(false);

  // Pesos dos critérios automáticos
  const [weights, setWeights] = useState({
    ddsAttendancePoints: comp.ddsAttendancePoints, quizParticipationPoints: comp.quizParticipationPoints,
    quizPerformancePoints: comp.quizPerformancePoints, quizSpeedPoints: comp.quizSpeedPoints
  });
  useEffect(() => {
    setWeights({
      ddsAttendancePoints: comp.ddsAttendancePoints, quizParticipationPoints: comp.quizParticipationPoints,
      quizPerformancePoints: comp.quizPerformancePoints, quizSpeedPoints: comp.quizSpeedPoints
    });
  }, [comp.ddsAttendancePoints, comp.quizParticipationPoints, comp.quizPerformancePoints, comp.quizSpeedPoints]);
  const weightsChanged = weights.ddsAttendancePoints !== comp.ddsAttendancePoints || weights.quizParticipationPoints !== comp.quizParticipationPoints ||
    weights.quizPerformancePoints !== comp.quizPerformancePoints || weights.quizSpeedPoints !== comp.quizSpeedPoints;

  // Critério extra (novo / edição)
  const [newCriterion, setNewCriterion] = useState({ name: '', weight: 10 });
  const [editingCriterion, setEditingCriterion] = useState<BonusCriterion | null>(null);

  // Lançamento (novo / edição)
  const emptyEntry = { id: '', criterionId: '', registration: '', name: '', quantity: 1, note: '' };
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [entryFilter, setEntryFilter] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const knownPeople = new Map<string, string>();
  for (const p of comp.leaderboard || []) knownPeople.set(p.registration, p.name);
  for (const e of entries) if (!knownPeople.has(e.participantRegistration)) knownPeople.set(e.participantRegistration, e.participantName);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); onError('');
    try { await fn(); await onChanged(); return true; }
    catch (e: any) { onError(e.message || 'Erro ao salvar.'); return false; }
    finally { setBusy(false); }
  };

  const saveWeights = () => run(() => callApi('/api/competicoes', 'PATCH', { id: comp.id, ...weights }));

  const addCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriterion.name.trim()) { onError('Informe o nome do critério extra.'); return; }
    if (await run(() => callApi(BONUS_API, 'POST', { kind: 'criterion', competitionId: comp.id, ...newCriterion }))) setNewCriterion({ name: '', weight: 10 });
  };
  const saveCriterion = async () => {
    if (!editingCriterion) return;
    if (await run(() => callApi(BONUS_API, 'PATCH', { kind: 'criterion', id: editingCriterion.id, name: editingCriterion.name, weight: editingCriterion.weight }))) setEditingCriterion(null);
  };
  const deleteCriterion = (c: BonusCriterion) => {
    const count = entries.filter(e => e.criterionId === c.id).length;
    if (!window.confirm(`Excluir o critério "${c.name}"?${count ? ` Os ${count} lançamento(s) dele também serão excluídos.` : ''}`)) return;
    run(() => callApi(BONUS_API, 'DELETE', { kind: 'criterion', id: c.id }));
  };

  const submitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const criterionId = entryForm.criterionId || criteria[0]?.id;
    if (!criterionId) { onError('Cadastre um critério extra antes de lançar pontos.'); return; }
    if (!entryForm.registration.trim() || !entryForm.name.trim()) { onError('Informe matrícula e nome do colaborador.'); return; }
    const payload = { kind: 'entry', criterionId, registration: entryForm.registration, name: entryForm.name, quantity: entryForm.quantity, note: entryForm.note };
    const ok = await run(() => callApi(BONUS_API, 'POST', { ...payload, competitionId: comp.id }));
    if (ok) setEntryForm({ ...emptyEntry, criterionId });
  };
  const deleteEntry = (entry: BonusEntry) => {
    if (!window.confirm(`Excluir o lançamento de ${entry.points} ponto(s) para ${entry.participantName}?`)) return;
    run(() => callApi(BONUS_API, 'DELETE', { kind: 'entry', id: entry.id }));
  };

  const selectedCriterion = criteria.find(c => c.id === (entryForm.criterionId || criteria[0]?.id));
  const previewPoints = selectedCriterion ? selectedCriterion.weight * (Number(entryForm.quantity) || 0) : 0;
  const filteredEntries = entries.filter(e => {
    const q = entryFilter.trim().toLowerCase();
    return !q || e.participantName.toLowerCase().includes(q) || e.participantRegistration.toLowerCase().includes(q) || e.criterionName.toLowerCase().includes(q);
  });

  const weightFields: { key: keyof typeof weights; label: string }[] = [
    { key: 'ddsAttendancePoints', label: 'Presença em cada DDS' },
    { key: 'quizParticipationPoints', label: 'Cada questionário respondido' },
    { key: 'quizPerformancePoints', label: 'Por ponto percentual de desempenho' },
    { key: 'quizSpeedPoints', label: 'Bônus de velocidade (até 1min30s)' }
  ];

  return (
    <div className="border-b border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-5">
      <fieldset disabled={locked || busy} className="space-y-5">
        {/* Pesos dos critérios automáticos */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="font-extrabold text-slate-800 text-sm">Peso dos indicadores automáticos</h4>
            {weightsChanged && <button type="button" onClick={saveWeights} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-extrabold text-white inline-flex items-center gap-1.5 disabled:opacity-60"><Check size={14}/> Salvar pesos e recalcular</button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {weightFields.map(f => <label key={f.key} className="text-xs font-semibold text-slate-600">{f.label}
              <input type="number" min="0" max="1000" value={weights[f.key]} onChange={e => setWeights(w => ({ ...w, [f.key]: Number(e.target.value) }))} className={`mt-1 ${inputCls}`}/>
            </label>)}
          </div>
        </div>

        {/* Critérios extras */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="font-extrabold text-slate-800 text-sm">Critérios de pontuação extra</h4>
          <p className="text-[11px] text-slate-500 mb-3">Cada critério aparece como uma coluna no ranking. Pontos = quantidade lançada × peso. Ao alterar o peso, todos os lançamentos do critério são recalculados.</p>
          {criteria.length > 0 && <ul className="divide-y divide-slate-100 mb-3">
            {criteria.map(c => {
              const total = entries.filter(e => e.criterionId === c.id).reduce((sum, e) => sum + e.points, 0);
              return <li key={c.id} className="py-2 flex flex-wrap items-center gap-2">
                {editingCriterion?.id === c.id ? <>
                  <input maxLength={80} value={editingCriterion.name} onChange={e => setEditingCriterion({ ...editingCriterion, name: e.target.value })} className={`${inputCls} max-w-xs`} aria-label="Nome do critério"/>
                  <label className="text-xs font-semibold text-slate-600 inline-flex items-center gap-1">Peso
                    <input type="number" min="0" max="1000" value={editingCriterion.weight} onChange={e => setEditingCriterion({ ...editingCriterion, weight: Number(e.target.value) })} className={`${inputCls} w-24`}/>
                  </label>
                  <button type="button" onClick={saveCriterion} className="rounded-lg bg-emerald-600 p-2 text-white" title="Salvar critério"><Check size={14}/></button>
                  <button type="button" onClick={() => setEditingCriterion(null)} className="rounded-lg border border-slate-200 p-2 text-slate-600" title="Cancelar"><X size={14}/></button>
                </> : <>
                  <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">peso {c.weight}</span>
                  <span className="text-xs text-slate-500">{total} pts lançados</span>
                  <span className="ml-auto flex gap-1">
                    <button type="button" onClick={() => setEditingCriterion(c)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500" title="Editar critério"><Pencil size={13}/></button>
                    <button type="button" onClick={() => deleteCriterion(c)} className="rounded-lg border border-red-200 p-1.5 text-red-600" title="Excluir critério"><Trash2 size={13}/></button>
                  </span>
                </>}
              </li>;
            })}
          </ul>}
          <form onSubmit={addCriterion} className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate-600 flex-1 min-w-[200px]">Novo critério
              <input maxLength={80} value={newCriterion.name} onChange={e => setNewCriterion(v => ({ ...v, name: e.target.value }))} placeholder="Ex.: Sugestão de melhoria, Relato de quase acidente" className={`mt-1 ${inputCls}`}/>
            </label>
            <label className="text-xs font-semibold text-slate-600 w-28">Peso (pontos)
              <input type="number" min="0" max="1000" value={newCriterion.weight} onChange={e => setNewCriterion(v => ({ ...v, weight: Number(e.target.value) }))} className={`mt-1 ${inputCls}`}/>
            </label>
            <button className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-2 text-xs font-extrabold text-white inline-flex items-center gap-1.5 disabled:opacity-60"><Plus size={14}/> Adicionar critério</button>
          </form>
        </div>

        {/* Lançamentos */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="font-extrabold text-slate-800 text-sm mb-3">Lançar pontos extras para um colaborador</h4>
          {criteria.length === 0 ? <p className="text-sm text-slate-500">Cadastre ao menos um critério extra para lançar pontos.</p> :
          <form onSubmit={submitEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <label className="text-xs font-semibold text-slate-600 lg:col-span-1">Critério
              <select value={entryForm.criterionId || criteria[0]?.id} onChange={e => setEntryForm(f => ({ ...f, criterionId: e.target.value }))} className={`mt-1 ${inputCls}`}>
                {criteria.map(c => <option key={c.id} value={c.id}>{c.name} (peso {c.weight})</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Matrícula
              <input list={`people-reg-${comp.id}`} maxLength={40} value={entryForm.registration} onChange={e => { const registration = e.target.value; setEntryForm(f => ({ ...f, registration, name: knownPeople.get(registration.trim()) || f.name })); }} className={`mt-1 ${inputCls} font-mono`}/>
              <datalist id={`people-reg-${comp.id}`}>{[...knownPeople.entries()].map(([reg, n]) => <option key={reg} value={reg}>{n}</option>)}</datalist>
            </label>
            <label className="text-xs font-semibold text-slate-600 lg:col-span-2">Colaborador
              <input list={`people-name-${comp.id}`} maxLength={160} value={entryForm.name} onChange={e => { const name = e.target.value; const match = [...knownPeople.entries()].find(([, n]) => n === name); setEntryForm(f => ({ ...f, name, registration: match ? match[0] : f.registration })); }} className={`mt-1 ${inputCls}`}/>
              <datalist id={`people-name-${comp.id}`}>{[...new Set(knownPeople.values())].map(n => <option key={n} value={n}/>)}</datalist>
            </label>
            <label className="text-xs font-semibold text-slate-600">Quantidade
              <input type="number" min="-1000" max="1000" value={entryForm.quantity} onChange={e => setEntryForm(f => ({ ...f, quantity: Number(e.target.value) }))} className={`mt-1 ${inputCls}`}/>
            </label>
            <div className="text-xs font-semibold text-slate-600">Pontos
              <div className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">{previewPoints}</div>
            </div>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-4">Observação (opcional)
              <input maxLength={500} value={entryForm.note} onChange={e => setEntryForm(f => ({ ...f, note: e.target.value }))} placeholder="Motivo ou evidência do lançamento" className={`mt-1 ${inputCls}`}/>
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-2 justify-end">
              <button className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white inline-flex items-center gap-1.5 disabled:opacity-60">{busy ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Incluir pontos</button>
            </div>
          </form>}
          <p className="text-[11px] text-slate-500 mt-2">Use quantidade negativa para descontar pontos (ex.: penalidade). Digitou errado? Clique em <b>Editar</b> no lançamento abaixo ou no detalhamento do colaborador no ranking.</p>

          {entries.length > 0 && <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Lançamentos detalhados ({entries.length})</h5>
              <input value={entryFilter} onChange={e => setEntryFilter(e.target.value)} placeholder="Filtrar por nome, matrícula ou critério" className={`${inputCls} max-w-xs`}/>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200"><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Colaborador</th><th className="py-2 pr-3">Matrícula</th><th className="py-2 pr-3">Critério</th><th className="py-2 pr-3">Cálculo</th><th className="py-2 pr-3">Pontos</th><th className="py-2 pr-3">Observação</th><th className="py-2"></th></tr></thead>
              <tbody>{filteredEntries.map(e => editingEntryId === e.id ? <tr key={e.id} className="border-b border-slate-100"><td colSpan={8} className="py-2">
                <EntryInlineEditor entry={e} criteria={criteria} onSaved={onChanged} onCancel={() => setEditingEntryId(null)} onError={onError}/>
              </td></tr> : <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onDoubleClick={() => !locked && setEditingEntryId(e.id)} title="Clique duas vezes para editar">
                <td className="py-2 pr-3 text-xs text-slate-500 whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString('pt-BR')}</td>
                <td className="py-2 pr-3 font-semibold text-slate-800">{e.participantName}</td>
                <td className="py-2 pr-3 font-mono text-slate-600">{e.participantRegistration}</td>
                <td className="py-2 pr-3">{e.criterionName}</td>
                <td className="py-2 pr-3 text-xs text-slate-500 whitespace-nowrap">{e.quantity} × {e.weight}</td>
                <td className={`py-2 pr-3 font-black ${e.points < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{e.points > 0 ? '+' : ''}{e.points}</td>
                <td className="py-2 pr-3 text-xs text-slate-500">{e.note || '—'}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button type="button" onClick={() => setEditingEntryId(e.id)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-600 mr-1 inline-flex items-center gap-1" title="Corrigir lançamento"><Pencil size={13}/> Editar</button>
                  <button type="button" onClick={() => deleteEntry(e)} className="rounded-lg border border-red-200 p-1.5 text-red-600" title="Excluir lançamento"><Trash2 size={13}/></button>
                </td>
              </tr>)}</tbody>
            </table></div>
          </div>}
        </div>
      </fieldset>
      {locked && <p className="text-xs text-slate-500">Competição cancelada: a pontuação não pode ser alterada.</p>}
    </div>
  );
}

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendada', ACTIVE: 'Em andamento', FINISHED: 'Encerrada', CANCELLED: 'Cancelada'
};

export default function CompetitionManager() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [ddsPoints, setDdsPoints] = useState(10);
  const [quizPoints, setQuizPoints] = useState(5);
  const [performancePoints, setPerformancePoints] = useState(1);
  const [speedPoints, setSpeedPoints] = useState(5);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [scoringOpen, setScoringOpen] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const reload = useCallback(async () => {
    // Recarrega sem exibir o carregamento de página inteira, preservando painéis abertos.
    const response = await fetch('/api/competicoes', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível carregar as competições.');
    setCompetitions(data.competitions || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/competicoes', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível carregar as competições.');
      setCompetitions(data.competitions || []);
    } catch (e: any) { setError(e.message || 'Erro ao carregar competições.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) { setError('Preencha o nome e o período da competição.'); return; }
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/competicoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, startDate: new Date(startDate + 'T00:00:00').toISOString(),
          endDate: new Date(endDate + 'T23:59:59').toISOString(),
          ddsAttendancePoints: ddsPoints, quizParticipationPoints: quizPoints,
          quizPerformancePoints: performancePoints, quizSpeedPoints: speedPoints
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível criar a competição.');
      setName(''); setDescription(''); setEndDate(''); setShowForm(false);
      await load();
    } catch (e: any) { setError(e.message || 'Erro ao criar competição.'); }
    finally { setSaving(false); }
  };

  const finishCompetition = async (id: string) => {
    if (!window.confirm('Deseja encerrar esta competição? O ranking será considerado definitivo.')) return;
    setError('');
    try {
      const response = await fetch('/api/competicoes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'FINISHED' })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível encerrar.');
      await load();
    } catch (e: any) { setError(e.message || 'Erro ao encerrar competição.'); }
  };

  const updateCompetition = async (id: string, changes: { name?: string; status?: 'ACTIVE' }) => {
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/competicoes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...changes }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível atualizar a competição.');
      setEditingId(null); setEditingName(''); await load();
    } catch (e: any) { setError(e.message || 'Erro ao atualizar competição.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy size={16} className="text-amber-600 shrink-0"/>
          <p className="text-sm text-slate-600 truncate" title="Some pontos por presença nos DDS, participação e desempenho nos questionários, além de pontos extras lançados manualmente."><span className="font-extrabold text-slate-800">Competição de participação</span> · pontos por DDS, questionários e pontos extras</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={load} className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap"><RefreshCw size={13}/> Atualizar</button>
          <button type="button" onClick={() => setShowForm(v => !v)} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5 whitespace-nowrap"><Plus size={14}/> Nova competição</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={createCompetition} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
          <div><h3 className="font-black text-slate-900 text-lg">Criar competição</h3><p className="text-sm text-slate-500">Defina o período e os pontos de cada critério. Os pontos são acumulados automaticamente a partir dos registros vinculados à matrícula.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-xs font-bold text-slate-700">Nome da competição
              <input required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Desafio Segurança em Primeiro Lugar" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-medium outline-none focus:border-amber-500"/>
            </label>
            <label className="text-xs font-bold text-slate-700">Descrição (opcional)
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Objetivo ou regras da campanha" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-medium outline-none focus:border-amber-500"/>
            </label>
            <label className="text-xs font-bold text-slate-700">Data de início
              <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"/>
            </label>
            <label className="text-xs font-bold text-slate-700">Data de encerramento
              <input required type="date" min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"/>
            </label>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <h4 className="font-extrabold text-slate-800 text-sm mb-3">Pontuação por critério</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="text-xs font-semibold text-slate-600">Presença em cada DDS
                <input type="number" min="0" max="1000" value={ddsPoints} onChange={e => setDdsPoints(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"/>
              </label>
              <label className="text-xs font-semibold text-slate-600">Cada questionário respondido
                <input type="number" min="0" max="1000" value={quizPoints} onChange={e => setQuizPoints(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"/>
              </label>
              <label className="text-xs font-semibold text-slate-600">Por ponto percentual de desempenho
                <input type="number" min="0" max="1000" value={performancePoints} onChange={e => setPerformancePoints(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"/>
              </label>
              <label className="text-xs font-semibold text-slate-600">Bônus por responder em até 1min30s
                <input type="number" min="0" max="1000" value={speedPoints} onChange={e => setSpeedPoints(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"/>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">O bônus de velocidade é concedido uma vez por questionário quando a conclusão ocorre em até 90 segundos. Acima desse tempo, não há bônus.</p>
            <p className="text-[11px] text-slate-500 mt-1">Exemplo: com 1 ponto por percentual, uma nota de 85% gera 85 pontos de desempenho, além dos pontos por participação.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm">Cancelar</button>
            <button disabled={saving} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm inline-flex items-center gap-2 disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Criar competição</button>
          </div>
        </form>
      )}

      {loading ? <div className="py-14 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/>Carregando competições...</div> :
        competitions.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Trophy size={34} className="mx-auto text-slate-300"/><h3 className="mt-3 font-black text-slate-800">Nenhuma competição criada</h3><p className="text-sm text-slate-500 mt-1">Crie a primeira competição para começar a acompanhar os pontos da equipe.</p></div> :
        <div className="space-y-4">{competitions.map(comp => {
          const winner = comp.status === 'FINISHED' ? comp.leaderboard?.[0] : null;
          return <section key={comp.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
              <div><div className="flex flex-wrap items-center gap-2">{editingId === comp.id ? <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); updateCompetition(comp.id, { name: editingName }); }}><input autoFocus maxLength={120} value={editingName} onChange={e => setEditingName(e.target.value)} className="min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold" aria-label="Novo nome da competição"/><button disabled={saving || !editingName.trim()} className="rounded-lg bg-emerald-600 p-2 text-white" title="Salvar nome"><Check size={16}/></button><button type="button" onClick={() => { setEditingId(null); setEditingName(''); }} className="rounded-lg border border-slate-200 p-2 text-slate-600" title="Cancelar edição"><X size={16}/></button></form> : <><h3 className="font-black text-slate-900 text-lg">{comp.name}</h3><button type="button" onClick={() => { setEditingId(comp.id); setEditingName(comp.name); }} className="rounded-lg border border-slate-200 p-1.5 text-slate-500" title="Editar nome da competição"><Pencil size={14}/></button></>}<span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${comp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : comp.status === 'FINISHED' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>{statusLabels[comp.status]}</span></div>{comp.description && <p className="text-sm text-slate-500 mt-1">{comp.description}</p>}<p className="text-xs text-slate-500 mt-2 flex items-center gap-2"><CalendarDays size={13}/>{new Date(comp.startDate).toLocaleDateString('pt-BR')} até {new Date(comp.endDate).toLocaleDateString('pt-BR')}</p></div>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setScoringOpen(o => ({ ...o, [comp.id]: !o[comp.id] }))} className={`rounded-xl border px-4 py-2.5 text-xs font-extrabold inline-flex items-center gap-2 ${scoringOpen[comp.id] ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700'}`}><SlidersHorizontal size={14}/> Pontos extras e pesos</button>{comp.status === 'ACTIVE' && <button type="button" onClick={() => finishCompetition(comp.id)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white">Encerrar competição</button>}{comp.status === 'FINISHED' && <button type="button" disabled={saving} onClick={() => { if (window.confirm('Deseja reabrir esta competição? Ela voltará para Em andamento e manterá o período e os critérios configurados.')) updateCompetition(comp.id, { status: 'ACTIVE' }); }} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white inline-flex items-center gap-2 disabled:opacity-60"><RotateCcw size={14}/> Reabrir competição</button>}</div>
            </div>
            {winner && <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-3"><Crown className="text-amber-600" size={22}/><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Grande vencedor</p><p className="font-black text-slate-900">{winner.name} · Matrícula {winner.registration} · {winner.totalPoints} pontos</p></div></div>}
            {scoringOpen[comp.id] && <ScoringPanel comp={comp} onChanged={reload} onError={setError}/>}
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3 text-xs font-black uppercase tracking-wider text-slate-500"><Users size={14}/> Classificação geral</div>
              {!comp.leaderboard?.length ? <p className="text-sm text-slate-500 py-4">Ainda não há participações pontuadas com matrícula nesta competição.</p> :
                <LeaderboardTable comp={comp} expanded={expandedRows} onToggle={key => setExpandedRows(r => ({ ...r, [key]: !r[key] }))} onChanged={reload} onError={setError}/>}
            </div>
          </section>;
        })}</div>}
    </div>
  );
}

function LeaderboardTable({ comp, expanded, onToggle, onChanged, onError }: {
  comp: Competition; expanded: Record<string, boolean>; onToggle: (key: string) => void;
  onChanged: () => Promise<void>; onError: (msg: string) => void;
}) {
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const canEdit = comp.status !== 'CANCELLED';
  const removeEntry = async (e: BonusEntry) => {
    if (!window.confirm(`Excluir o lançamento de ${e.points} ponto(s) para ${e.participantName}?`)) return;
    onError('');
    try { await callApi(BONUS_API, 'DELETE', { kind: 'entry', id: e.id }); await onChanged(); }
    catch (err: any) { onError(err.message || 'Erro ao excluir o lançamento.'); }
  };
  const criteria = comp.bonusCriteria || [];
  const entries = comp.bonusEntries || [];
  const columnCount = 8 + criteria.length;
  return (
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
        <th className="py-2 pr-3">Pos.</th><th className="py-2 pr-3">Colaborador</th><th className="py-2 pr-3">Matrícula</th>
        <th className="py-2 pr-3">DDS</th><th className="py-2 pr-3">Questionários</th><th className="py-2 pr-3">Desempenho</th><th className="py-2 pr-3">Velocidade</th>
        {criteria.map(c => <th key={c.id} className="py-2 pr-3 text-amber-700" title={`Peso ${c.weight} por unidade`}>{c.name}<span className="block text-[9px] font-semibold normal-case tracking-normal text-amber-600">peso {c.weight}</span></th>)}
        <th className="py-2 text-right">Total</th>
      </tr></thead>
      <tbody>{comp.leaderboard.map((p, i) => {
        const key = comp.id + ':' + p.registration;
        const personEntries = entries.filter(e => e.participantRegistration === p.registration);
        const isOpen = !!expanded[key];
        return <React.Fragment key={p.registration}>
          <tr className="border-b border-slate-100 last:border-0">
            <td className="py-3 pr-3 font-black text-slate-500">{i + 1}º</td>
            <td className="py-3 pr-3 font-bold text-slate-800">
              <button type="button" onClick={() => onToggle(key)} className="inline-flex items-center gap-1 text-left hover:text-amber-700" title="Ver detalhamento da pontuação">
                {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}{p.name}
              </button>
            </td>
            <td className="py-3 pr-3 font-mono text-slate-600">{p.registration}</td>
            <td className="py-3 pr-3">{p.ddsParticipations}</td>
            <td className="py-3 pr-3">{p.quizParticipations}</td>
            <td className="py-3 pr-3">{p.performancePoints}</td>
            <td className="py-3 pr-3">{p.speedPoints}</td>
            {criteria.map(c => {
              const b = p.bonus?.[c.id];
              return <td key={c.id} className="py-3 pr-3">{b ? <><span className={`font-bold ${b.points < 0 ? 'text-red-600' : 'text-amber-700'}`}>{b.points}</span><span className="block text-[10px] text-slate-400">{b.quantity} × {c.weight}</span></> : <span className="text-slate-400">0</span>}</td>;
            })}
            <td className="py-3 text-right font-black text-emerald-700">{p.totalPoints}</td>
          </tr>
          {isOpen && <tr className="bg-slate-50 border-b border-slate-100"><td colSpan={columnCount} className="px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              <Detail label="Presença em DDS" value={p.ddsParticipations * comp.ddsAttendancePoints} hint={`${p.ddsParticipations} × ${comp.ddsAttendancePoints}`}/>
              <Detail label="Questionários" value={p.quizParticipations * comp.quizParticipationPoints} hint={`${p.quizParticipations} × ${comp.quizParticipationPoints}`}/>
              <Detail label="Desempenho" value={p.performancePoints} hint={`peso ${comp.quizPerformancePoints} por %`}/>
              <Detail label="Velocidade" value={p.speedPoints} hint={`peso ${comp.quizSpeedPoints}`}/>
              {criteria.map(c => <Detail key={c.id} label={c.name} value={p.bonus?.[c.id]?.points || 0} hint={`${p.bonus?.[c.id]?.quantity || 0} × ${c.weight}`} highlight/>)}
              <Detail label="Total" value={p.totalPoints} strong/>
            </div>
            {personEntries.length > 0 && <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
              {personEntries.map(e => editingEntryId === e.id
                ? <li key={e.id}><EntryInlineEditor entry={e} criteria={criteria} onSaved={onChanged} onCancel={() => setEditingEntryId(null)} onError={onError}/></li>
                : <li key={e.id} className="flex flex-wrap items-center gap-2"><Star size={12} className="text-amber-500"/><span className="text-slate-400">{new Date(e.createdAt).toLocaleDateString('pt-BR')}</span><span className="font-semibold">{e.criterionName}</span><span>{e.quantity} × {e.weight} = <b className={e.points < 0 ? 'text-red-600' : 'text-emerald-700'}>{e.points}</b></span>{e.note && <span className="text-slate-500">— {e.note}</span>}
                  {canEdit && <span className="ml-auto flex gap-1">
                    <button type="button" onClick={() => setEditingEntryId(e.id)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 inline-flex items-center gap-1" title="Corrigir lançamento"><Pencil size={12}/> Editar</button>
                    <button type="button" onClick={() => removeEntry(e)} className="rounded-md border border-red-200 bg-white p-1 text-red-600" title="Excluir lançamento"><Trash2 size={12}/></button>
                  </span>}
                </li>)}
            </ul>}
          </td></tr>}
        </React.Fragment>;
      })}</tbody>
    </table></div>
  );
}

function Detail({ label, value, hint, highlight, strong }: { label: string; value: number; hint?: string; highlight?: boolean; strong?: boolean }) {
  return <div className={`rounded-lg border px-3 py-2 ${strong ? 'border-emerald-200 bg-emerald-50' : highlight ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate" title={label}>{label}</div>
    <div className={`text-base font-black ${strong ? 'text-emerald-700' : value < 0 ? 'text-red-600' : 'text-slate-800'}`}>{value}</div>
    {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
  </div>;
}
