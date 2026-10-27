'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Activity, BarChart3, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Download, RefreshCw, Users } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import QuizBiDashboard from '@/components/QuizBiDashboard';
import { useAuth } from '@/context/AuthContext';

interface GeneralBiData {
  generatedAt: string;
  indicators: {
    totalActivities: number; totalDDS: number; totalCampaigns: number; totalTrainings: number;
    completedActivities: number; totalPresences: number; averagePresences: number;
    activitiesWithoutPresences: number; totalQuizzes: number; totalAttempts: number;
    uniqueQuizParticipants: number; averageQuizScore: number; quizApprovalRate: number;
  };
  charts: {
    byKind: { label: string; value: number }[];
    byUnit: { label: string; value: number }[];
    monthly: { label: string; activities: number; presences: number }[];
  };
  classifications: string[];
  units: string[];
  recentActivities: { id: string; topic: string; classification: string; unit: string; date: string; status: string; presences: number }[];
  note: string;
}

function CountCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    {detail && <p className="text-[11px] text-slate-500 mt-1">{detail}</p>}
  </div>;
}

function Bars({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
    <h2 className="text-sm font-bold text-slate-900 mb-4">{title}</h2>
    {data.length === 0 ? <p className="text-xs text-slate-500">Sem registros no período selecionado.</p> :
      <div className="space-y-3">{data.slice(0, 12).map(item =>
        <div key={item.label}>
          <div className="flex justify-between gap-3 text-xs mb-1"><span className="font-medium text-slate-700 truncate">{item.label}</span><strong>{item.value}</strong></div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="bg-emerald-600 h-full rounded-full" style={{ width: (item.value / max * 100) + '%' }} /></div>
        </div>
      )}</div>}
  </section>;
}

function GeneralBIPageContent() {
  const { user } = useAuth();
  const [section, setSection] = useState<'GERAL' | 'AVALIACOES'>('GERAL');
  const [period, setPeriod] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [classification, setClassification] = useState('ALL');
  const [unit, setUnit] = useState('ALL');
  const [data, setData] = useState<GeneralBiData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ period, classification, unit });
      if (period === 'custom') {
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      }
      const res = await fetch('/api/bi/geral?' + params.toString(), { cache: 'no-store' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Falha ao carregar BI.');
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar indicadores.');
    } finally { setBusy(false); }
  }, [period, classification, unit, startDate, endDate]);

  useEffect(() => { if (section === 'GERAL') load(); }, [section, load]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['Indicador', 'Valor'],
      ...Object.entries(data.indicators).map(([key, value]) => [key, String(value)]),
      [], ['Classificação', 'Quantidade'], ...data.charts.byKind.map(i => [i.label, String(i.value)]),
      [], ['Unidade', 'Quantidade'], ...data.charts.byUnit.map(i => [i.label, String(i.value)]),
      [], ['Mês', 'Atividades', 'Presenças'], ...data.charts.monthly.map(i => [i.label, String(i.activities), String(i.presences)])
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = href; a.download = 'DDS_ON_BI_Geral.csv'; a.click(); URL.revokeObjectURL(href);
  };

  const n = data?.indicators;
  return <AppShell breadcrumbs={[{ label: 'Gestão', href: '/admin' }, { label: 'BI & Analytics DDS ON' }]}>
    <div className="space-y-5">
      <header className="rounded-2xl bg-[#0F1F38] text-white px-5 py-6 sm:px-7">
        <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase"><BarChart3 size={17}/> Inteligência operacional</div>
        <h1 className="text-2xl sm:text-3xl font-black mt-2">BI Geral do DDS ON</h1>
        <p className="text-slate-300 text-sm mt-2">Levantamento de DDS, campanhas, treinamentos, presenças e resultados de avaliações.</p>
      </header>
      <nav aria-label="Áreas de BI" className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setSection('GERAL')} className={'px-4 py-2 rounded-xl text-sm font-bold ' + (section === 'GERAL' ? 'bg-emerald-700 text-white' : 'bg-white border text-slate-700')}>Visão geral & atividades</button>
        <button type="button" onClick={() => setSection('AVALIACOES')} className={'px-4 py-2 rounded-xl text-sm font-bold ' + (section === 'AVALIACOES' ? 'bg-emerald-700 text-white' : 'bg-white border text-slate-700')}>Resultados dos questionários</button>
      </nav>
      {section === 'AVALIACOES' ? <QuizBiDashboard organizerName={user?.name || 'Gestor SST'} companyName={user?.company || 'DDS ON'}/> : <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <label className="text-xs text-slate-600 font-semibold">Período
            <select value={period} onChange={e => setPeriod(e.target.value)} className="block w-full mt-1 rounded-lg border border-slate-200 p-2.5 bg-white">
              <option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="90d">Últimos 90 dias</option><option value="year">Ano atual</option><option value="all">Todo o histórico</option><option value="custom">Período personalizado</option>
            </select>
          </label>
          <label className="text-xs text-slate-600 font-semibold">Tipo de atividade
            <select value={classification} onChange={e => setClassification(e.target.value)} className="block w-full mt-1 rounded-lg border border-slate-200 p-2.5 bg-white">
              <option value="ALL">Todos</option>{data?.classifications.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600 font-semibold">Unidade
            <select value={unit} onChange={e => setUnit(e.target.value)} className="block w-full mt-1 rounded-lg border border-slate-200 p-2.5 bg-white">
              <option value="ALL">Todas</option>{data?.units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          {period === 'custom' && <><label className="text-xs text-slate-600 font-semibold">Início<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full mt-1 rounded-lg border p-2.5" /></label>
          <label className="text-xs text-slate-600 font-semibold">Fim<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block w-full mt-1 rounded-lg border p-2.5" /></label></>}
          <div className="flex items-end gap-2">
            <button onClick={load} disabled={busy} className="rounded-lg bg-slate-900 text-white px-3 py-2.5 text-xs font-bold flex items-center gap-1 disabled:opacity-50"><RefreshCw size={14}/> Atualizar</button>
            <button onClick={exportCsv} disabled={!data || busy} className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-xs font-bold flex items-center gap-1 disabled:opacity-50"><Download size={14}/> CSV</button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</p>}
        {busy && <p className="text-sm text-slate-500">Atualizando indicadores...</p>}
        {n && <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <CountCard label="Atividades registradas" value={n.totalActivities}/>
            <CountCard label="DDS" value={n.totalDDS}/>
            <CountCard label="Campanhas" value={n.totalCampaigns}/>
            <CountCard label="Treinamentos" value={n.totalTrainings}/>
            <CountCard label="Registros de presença" value={n.totalPresences} detail="Total de presenças, não pessoas únicas"/>
            <CountCard label="Média de presenças/atividade" value={n.averagePresences.toLocaleString('pt-BR', {maximumFractionDigits: 1})}/>
            <CountCard label="Avaliações criadas" value={n.totalQuizzes}/>
            <CountCard label="Respostas de avaliações" value={n.totalAttempts}/>
            <CountCard label="Média das avaliações" value={n.totalAttempts ? n.averageQuizScore.toLocaleString('pt-BR', {maximumFractionDigits:1}) + '%' : '—'}/>
            <CountCard label="Aprovação em avaliações" value={n.totalAttempts ? n.quizApprovalRate.toLocaleString('pt-BR', {maximumFractionDigits:1}) + '%' : '—'}/>
            <CountCard label="Atividades concluídas" value={n.completedActivities}/>
            <CountCard label="Atividades sem presenças" value={n.activitiesWithoutPresences}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Bars title="Atividades por classificação" data={data!.charts.byKind}/>
            <Bars title="Atividades por unidade" data={data!.charts.byUnit}/>
            <Bars title="Atividades por mês" data={data!.charts.monthly.map(m => ({label:m.label,value:m.activities}))}/>
            <Bars title="Presenças por mês" data={data!.charts.monthly.map(m => ({label:m.label,value:m.presences}))}/>
          </div>
          <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
            <h2 className="font-bold text-slate-900 mb-3">Atividades recentes</h2>
            <div className="overflow-x-auto"><table className="w-full text-xs text-left">
              <thead><tr className="border-b text-slate-500"><th className="p-2">Tema</th><th className="p-2">Tipo</th><th className="p-2">Unidade</th><th className="p-2">Data</th><th className="p-2 text-right">Presenças</th></tr></thead>
              <tbody>{data!.recentActivities.map(m => <tr key={m.id} className="border-b border-slate-100">
                <td className="p-2 font-medium">{m.topic}</td><td className="p-2">{m.classification}</td><td className="p-2">{m.unit}</td>
                <td className="p-2 whitespace-nowrap">{new Date(m.date).toLocaleDateString('pt-BR')}</td><td className="p-2 text-right">{m.presences}</td>
              </tr>)}</tbody>
            </table></div>
            {data!.recentActivities.length === 0 && <p className="text-xs text-slate-500 mt-2">Nenhuma atividade registrada no período.</p>}
            <Link href="/admin?view=history" className="inline-block mt-4 text-xs font-bold text-blue-700 hover:underline">Abrir histórico de DDS</Link>
          </section>
          <p className="text-[11px] text-slate-500">{data!.note}</p>
        </>}
      </>}
    </div>
  </AppShell>;
}


// Next.js 14 requires Suspense around clients that can reach useSearchParams
// through nested layout components (AppShell / Sidebar).
export default function GeneralBIPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-[#F5F7FB] p-8 text-sm text-slate-600" role="status">
        Carregando painel de BI...
      </div>
    }>
      <GeneralBIPageContent />
    </React.Suspense>
  );
}
