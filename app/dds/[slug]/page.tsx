'use client';

// Link fixo do DDS Semanal: /dds/<slug>
// Mostra os temas da semana. O tema disponível leva para a tela de presença de
// sempre (/presencial?id=...), com selfie, assinatura e funcionamento offline.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, ClipboardCheck, Clock3, Loader2, Lock, PenTool, RefreshCw } from 'lucide-react';
import DdsLogo from '@/components/DdsLogo';

type PublicTheme = {
  id: string; order: number; state: 'LOCKED' | 'OPEN' | 'REOPENED' | 'CLOSED';
  opensAt: string; closesAt: string; availableUntil: string | null;
  topic: string | null; objective: string | null; meetingId: string | null; quizToken: string | null;
};
type PublicData = {
  now: string;
  schedule: { name: string; farm: string; company: string | null };
  week: { startsAt: string; endsAt: string; themes: PublicTheme[] } | null;
  reopenedElsewhere: PublicTheme[];
};

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DAY_TITLE = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const pad = (n: number) => String(n).padStart(2, '0');
const fmtLong = (value: string) => {
  const d = new Date(value);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function remaining(until: string, now: number) {
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return 'encerrando';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h >= 1 ? `${h} h ${pad(m)} min` : `${m} min`;
}

export default function WeeklyDdsPublicPage() {
  const params = useParams();
  const slug = String(params?.slug || '').toLowerCase();
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0); // diferença entre o relógio do servidor e o do celular

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dds-semanal/publico?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'Não foi possível carregar os temas.');
      offsetRef.current = new Date(json.now).getTime() - Date.now();
      setData(json);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Sem conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // Relógio da tela e recarga automática quando um tema abre ou encerra.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offsetRef.current), 30000);
    const poll = setInterval(() => { if (!document.hidden) load(); }, 120000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(tick); clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const themes = [...(data.week?.themes || []), ...data.reopenedElsewhere];
    const current = Date.now() + offsetRef.current;
    const boundaries = themes.flatMap(t => [t.opensAt, t.availableUntil]).filter(Boolean)
      .map(v => new Date(v as string).getTime()).filter(t => t > current);
    if (!boundaries.length) return;
    const wait = Math.min(...boundaries) - current + 1500;
    if (wait > 2147483000) return;
    const timer = setTimeout(load, wait);
    return () => clearTimeout(timer);
  }, [data, load]);

  // Tema disponível ainda sem DDS criado (acesso simultâneo): tenta de novo em instantes.
  useEffect(() => {
    if (!data) return;
    const pending = [...(data.week?.themes || []), ...data.reopenedElsewhere]
      .some(t => (t.state === 'OPEN' || t.state === 'REOPENED') && !t.meetingId);
    if (!pending) return;
    const timer = setTimeout(load, 5000);
    return () => clearTimeout(timer);
  }, [data, load]);

  const themes = data?.week?.themes || [];
  const available = [...data?.reopenedElsewhere || [], ...themes].filter(t => t.state === 'OPEN' || t.state === 'REOPENED');

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <DdsLogo size="sm" showSubtitle={false} />
          {data && <span className="text-xs font-semibold text-slate-300 text-right truncate">{data.schedule.company || data.schedule.farm}</span>}
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-3">
        {loading ? (
          <div className="py-16 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/>Carregando os temas da semana...</div>
        ) : error && !data ? (
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-center space-y-3">
            <p className="font-bold text-slate-800">{error}</p>
            <button type="button" onClick={() => { setLoading(true); load(); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 inline-flex items-center gap-2"><RefreshCw size={14}/> Tentar de novo</button>
          </div>
        ) : data && (
          <>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">DDS da semana</p>
              <h1 className="text-xl font-black text-slate-900">{data.schedule.name}</h1>
              <p className="text-sm text-slate-500">{data.schedule.farm}</p>
            </div>

            {error && <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800">{error} Mostrando a última informação carregada.</p>}

            {available.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                <CalendarDays className="mx-auto text-slate-300" size={30}/>
                <p className="mt-2 font-bold text-slate-800">Nenhum tema disponível agora</p>
                <p className="text-sm text-slate-500">
                  {themes.find(t => t.state === 'LOCKED') ? `O próximo tema libera ${fmtLong(themes.find(t => t.state === 'LOCKED')!.opensAt)}.` : 'Aguarde o organizador publicar a próxima semana.'}
                </p>
              </div>
            )}

            {data.reopenedElsewhere.map(t => <ThemeCard key={t.id} slug={slug} theme={t} now={now} reopenedFromOtherWeek/>)}
            {themes.map(t => <ThemeCard key={t.id} slug={slug} theme={t} now={now} isToday={t.state === 'OPEN'}/>)}

            <p className="pt-2 text-center text-[11px] text-slate-400">Os temas liberam e encerram automaticamente. Guarde este link: ele é o mesmo todas as semanas.</p>
          </>
        )}
      </div>
    </main>
  );
}

function ThemeCard({ slug, theme, now, isToday, reopenedFromOtherWeek }: { slug: string; theme: PublicTheme; now: number; isToday?: boolean; reopenedFromOtherWeek?: boolean }) {
  const day = DAY_TITLE[new Date(theme.opensAt).getDay()];

  if (theme.state === 'LOCKED') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 opacity-80">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{day}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-500"><Lock size={10}/> Bloqueado</span>
        </div>
        <p className="mt-1 text-sm text-slate-500 inline-flex items-center gap-1.5"><Clock3 size={13}/> Libera {fmtLong(theme.opensAt)}</p>
      </div>
    );
  }

  if (theme.state === 'CLOSED') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{day}</span>
          <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-400">Encerrado</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-500">{theme.topic}</p>
      </div>
    );
  }

  const reopened = theme.state === 'REOPENED';
  const until = theme.availableUntil || theme.closesAt;
  return (
    <div className={`rounded-2xl border-2 bg-white px-4 py-4 space-y-2 ${reopened ? 'border-blue-300' : 'border-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-black uppercase tracking-wider ${reopened ? 'text-blue-700' : 'text-emerald-700'}`}>
          {isToday ? 'Tema de hoje · ' : ''}{day}{reopenedFromOtherWeek ? ' (semana anterior)' : ''}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${reopened ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current"/>{reopened ? 'Reaberto' : 'Aberto'}
        </span>
      </div>
      <h2 className="text-lg font-black text-slate-900 leading-snug">{theme.topic}</h2>
      {theme.objective && <p className="text-sm text-slate-600">{theme.objective}</p>}
      <p className="text-xs text-slate-500 inline-flex items-center gap-1.5"><Clock3 size={13}/> Aberto até {fmtLong(until)} · faltam {remaining(until, now)}</p>
      {theme.meetingId ? (
        <>
          <Link href={`/presencial?id=${encodeURIComponent(theme.meetingId)}&semana=${encodeURIComponent(slug)}${theme.quizToken ? `&quiz=${encodeURIComponent(theme.quizToken)}` : ''}`} className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white ${reopened ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <PenTool size={16}/> Abrir tema e assinar presença
          </Link>
          {theme.quizToken && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <span className="text-xs text-slate-600 inline-flex items-center gap-1.5"><ClipboardCheck size={14} className="text-emerald-600"/> Este tema tem questionário.</span>
              <Link href={`/questionario/${encodeURIComponent(theme.quizToken)}`} className="text-xs font-extrabold text-emerald-700 whitespace-nowrap">Já assinei: responder</Link>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-xl bg-slate-100 py-3 text-center text-sm font-semibold text-slate-500 inline-flex w-full items-center justify-center gap-2"><Loader2 size={14} className="animate-spin"/> Preparando o tema...</p>
      )}
    </div>
  );
}
