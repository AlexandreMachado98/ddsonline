'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, CalendarDays, CheckCircle2, Clock3, Crown, Loader2, Plus, RefreshCw, Trophy, Users } from 'lucide-react';

type Participant = {
  registration: string; name: string; totalPoints: number;
  ddsParticipations: number; quizParticipations: number; performancePoints: number;
};
type Competition = {
  id: string; name: string; description?: string | null;
  startDate: string; endDate: string; status: 'SCHEDULED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  ddsAttendancePoints: number; quizParticipationPoints: number; quizPerformancePoints: number;
  leaderboard: Participant[];
};

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
          quizPerformancePoints: performancePoints
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-black text-xs uppercase tracking-wider"><Trophy size={16}/> Competição de participação</div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Engaje sua equipe e reconheça os destaques</h2>
          <p className="text-sm text-slate-600 mt-1">Some pontos por presença nos DDS, participação e desempenho nos questionários.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm inline-flex items-center gap-2"><RefreshCw size={15}/> Atualizar</button>
          <button type="button" onClick={() => setShowForm(v => !v)} className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm inline-flex items-center gap-2"><Plus size={16}/> Nova competição</button>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-600">Presença em cada DDS
                <input type="number" min="0" max="1000" value={ddsPoints} onChange={e => setDdsPoints(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"/>
              </label>
              <label className="text-xs font-semibold text-slate-600">Cada questionário respondido
                <input type="number" min="0" max="1000" value={quizPoints} onChange={e => setQuizPoints(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"/>
              </label>
              <label className="text-xs font-semibold text-slate-600">Por ponto percentual de desempenho
                <input type="number" min="0" max="1000" value={performancePoints} onChange={e => setPerformancePoints(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"/>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Exemplo: com 1 ponto por percentual, uma nota de 85% gera 85 pontos de desempenho, além dos pontos por participação.</p>
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
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900 text-lg">{comp.name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${comp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : comp.status === 'FINISHED' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>{statusLabels[comp.status]}</span></div>{comp.description && <p className="text-sm text-slate-500 mt-1">{comp.description}</p>}<p className="text-xs text-slate-500 mt-2 flex items-center gap-2"><CalendarDays size={13}/>{new Date(comp.startDate).toLocaleDateString('pt-BR')} até {new Date(comp.endDate).toLocaleDateString('pt-BR')}</p></div>
              {comp.status === 'ACTIVE' && <button type="button" onClick={() => finishCompetition(comp.id)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white">Encerrar competição</button>}
            </div>
            {winner && <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-3"><Crown className="text-amber-600" size={22}/><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Grande vencedor</p><p className="font-black text-slate-900">{winner.name} · Matrícula {winner.registration} · {winner.totalPoints} pontos</p></div></div>}
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3 text-xs font-black uppercase tracking-wider text-slate-500"><Users size={14}/> Classificação geral</div>
              {!comp.leaderboard?.length ? <p className="text-sm text-slate-500 py-4">Ainda não há participações pontuadas com matrícula nesta competição.</p> :
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200"><th className="py-2 pr-3">Pos.</th><th className="py-2 pr-3">Colaborador</th><th className="py-2 pr-3">Matrícula</th><th className="py-2 pr-3">DDS</th><th className="py-2 pr-3">Questionários</th><th className="py-2 pr-3">Desempenho</th><th className="py-2 text-right">Total</th></tr></thead><tbody>{comp.leaderboard.map((p,i)=><tr key={p.registration} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-3 font-black text-slate-500">{i+1}º</td><td className="py-3 pr-3 font-bold text-slate-800">{p.name}</td><td className="py-3 pr-3 font-mono text-slate-600">{p.registration}</td><td className="py-3 pr-3">{p.ddsParticipations}</td><td className="py-3 pr-3">{p.quizParticipations}</td><td className="py-3 pr-3">{p.performancePoints}</td><td className="py-3 text-right font-black text-emerald-700">{p.totalPoints}</td></tr>)}</tbody></table></div>}
            </div>
          </section>;
        })}</div>}
    </div>
  );
}
