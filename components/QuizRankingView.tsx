'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  Trophy, Award, Medal, Crown, Sparkles, Download, RefreshCw, 
  Search, Filter, CheckCircle2, AlertTriangle, Users, FileText, 
  Lock, Globe, Copy, Check, Eye, UserCheck, ShieldCheck, ArrowRight,
  ExternalLink, BarChart3, AlertCircle, Clock
} from 'lucide-react';
import { QuizRankingSummary, QuizRankingItem } from '@/lib/quizRanking';
import { generateQuizRankingPdf } from '@/lib/quizRankingPdf';

interface QuizRankingViewProps {
  quizId: string;
  quizTitle: string;
  passingScore?: number;
  ddsTopic?: string | null;
  ddsFarm?: string | null;
  initialShowRanking?: boolean;
  organizerName?: string;
  companyName?: string;
  isPublicMode?: boolean; // Se for visualizado pelo colaborador na tela pública
  shareToken?: string;
  onOpenCollaboratorModal?: (attemptId: string) => void;
}

export default function QuizRankingView({
  quizId,
  quizTitle,
  passingScore = 70,
  ddsTopic,
  ddsFarm,
  initialShowRanking = false,
  organizerName = 'Gestor de Segurança',
  companyName = 'DDS Online',
  isPublicMode = false,
  shareToken,
  onOpenCollaboratorModal
}: QuizRankingViewProps) {
  const [summary, setSummary] = useState<QuizRankingSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [showRankingPublic, setShowRankingPublic] = useState<boolean>(initialShowRanking);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros e Pesquisa
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'INSUFFICIENT'>('ALL');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Busca os dados do ranking pela API dedicada
  const fetchRankingData = useCallback(async (isSilent = false) => {
    // Cancela requisição pendente anterior para evitar sobrecarga de rede
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMsg(null);

      const endpoint = isPublicMode && shareToken
        ? `/api/questionarios/ranking?token=${encodeURIComponent(shareToken)}&_t=${Date.now()}`
        : `/api/questionarios/ranking?quizId=${encodeURIComponent(quizId)}&_t=${Date.now()}`;

      const res = await fetch(endpoint, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      const data = await res.json();

      if (data.success && data.summary) {
        setSummary(data.summary);
        if (data.showRanking !== undefined) {
          setShowRankingPublic(Boolean(data.showRanking));
        }
        setLastUpdated(new Date());
      } else {
        setErrorMsg(data.error || 'Não foi possível carregar a classificação.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // Cancelamento intencional, ignora
      console.error('Erro ao buscar ranking:', err);
      setErrorMsg('Falha de conexão ao carregar ranking.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [quizId, isPublicMode, shareToken]);

  // Carga inicial e Polling em Tempo Real (a cada 15 segundos)
  useEffect(() => {
    fetchRankingData(false);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchRankingData(true);
    }, 15000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchRankingData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchRankingData]);

  // Alterna visibilidade pública do ranking (Apenas Gestor)
  const handleTogglePrivacy = async (newValue: boolean) => {
    if (isPublicMode) return;
    try {
      setIsUpdatingPrivacy(true);
      const res = await fetch('/api/questionarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: quizId, showRanking: newValue })
      });
      const data = await res.json();
      if (data.success) {
        setShowRankingPublic(newValue);
      }
    } catch (err) {
      console.error('Erro ao alternar privacidade:', err);
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  // Exportar Relatório em PDF
  const handleExportPdf = async () => {
    if (!summary) return;
    try {
      setIsExportingPdf(true);
      const doc = await generateQuizRankingPdf({
        ddsTopic: ddsTopic || undefined,
        ddsFarm: ddsFarm || undefined,
        quizTitle,
        passingScore,
        organizerName,
        companyName,
        summary,
        generatedAt: new Date()
      });

      const cleanFileName = `Ranking_${quizTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(cleanFileName);
    } catch (err) {
      console.error('Erro ao exportar PDF do ranking:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Copiar link de compartilhamento
  const handleCopyShareLink = () => {
    if (!shareToken || typeof window === 'undefined') return;
    const url = `${window.location.origin}/questionario/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Lista de participantes filtrada
  const filteredRanking = useMemo(() => {
    if (!summary || !Array.isArray(summary.ranking)) return [];

    return summary.ranking.filter(item => {
      // Filtro de busca por nome ou função
      const matchesSearch =
        item.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.participantRole.toLowerCase().includes(searchQuery.toLowerCase());

      // Filtro por situação
      let matchesStatus = true;
      if (statusFilter === 'PASSED') matchesStatus = item.passed;
      if (statusFilter === 'INSUFFICIENT') matchesStatus = !item.passed;

      return matchesSearch && matchesStatus;
    });
  }, [summary, searchQuery, statusFilter]);

  // Iniciais para o avatar
  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'CL';
    const parts = nameStr.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (isLoading && !summary) {
    return (
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-3 min-h-[300px]">
        <RefreshCw size={28} className="text-emerald-400 animate-spin" />
        <p className="text-xs text-slate-300 font-bold">Calculando classificação e atualizando ranking em tempo real...</p>
      </div>
    );
  }

  if (errorMsg && !summary) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
        <AlertTriangle size={32} className="text-amber-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">Visualização Indisponível</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">{errorMsg}</p>
        <button
          onClick={() => fetchRankingData(false)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Barra de Topo do Ranking com Metadados e Controles */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1.5">
                <Trophy size={13} className="text-amber-600" /> Ranking de Desempenho
              </span>
              {ddsTopic ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700">
                  DDS: {ddsTopic}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700">
                  ✨ Avaliação Autônoma
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-xl font-black text-[#0F1F38] mt-1.5">{quizTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Critério: Nota Mínima de Aprovação ≥ {passingScore}% • Ordenação por aproveitamento, acertos e tempo
            </p>
          </div>

          {/* Ações do Gestor */}
          <div className="flex items-center gap-2.5 flex-wrap">
            
            {/* Controle de Privacidade (Privado vs Público) */}
            {!isPublicMode && (
              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-600 px-1 font-semibold flex items-center gap-1">
                  {showRankingPublic ? <Globe size={13} className="text-emerald-600" /> : <Lock size={13} className="text-amber-600" />}
                  <span className="hidden sm:inline">Visibilidade:</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleTogglePrivacy(!showRankingPublic)}
                  disabled={isUpdatingPrivacy}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    showRankingPublic
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                      : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
                  }`}
                  title={showRankingPublic ? 'Público: Colaboradores podem ver a classificação' : 'Privado: Apenas gestores podem ver o ranking'}
                >
                  {isUpdatingPrivacy ? 'Salvando...' : showRankingPublic ? '🌐 Público (Equipe)' : '🔒 Privado (Gestor)'}
                </button>
              </div>
            )}

            {/* Atualização em Tempo Real */}
            <button
              onClick={() => fetchRankingData(true)}
              disabled={isRefreshing}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title={`Atualizado às ${lastUpdated.toLocaleTimeString('pt-BR')}`}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
              <span className="hidden sm:inline">{isRefreshing ? 'Sincronizando...' : 'Atualizar'}</span>
            </button>

            {/* Exportar em PDF */}
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || !summary || summary.totalParticipants === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              <span>{isExportingPdf ? 'Gerando Relatório...' : 'Exportar Ranking em PDF'}</span>
            </button>

            {/* Compartilhar link */}
            {shareToken && (
              <button
                onClick={handleCopyShareLink}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                title="Copiar link de resposta desta avaliação"
              >
                {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            )}
          </div>
        </div>

        {/* 2. Quadro de Indicadores Rápidos (KPIs) */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Users size={12} className="text-blue-600" /> Participantes
              </span>
              <p className="text-xl font-black text-[#0F1F38]">{summary.totalParticipants}</p>
              <span className="text-[10px] text-slate-500">{summary.totalAttempts} tentativas totais</span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <BarChart3 size={12} className="text-emerald-600" /> Média Geral
              </span>
              <p className={`text-xl font-black ${summary.averageScore >= passingScore ? 'text-emerald-700' : 'text-amber-700'}`}>
                {summary.averageScore}%
              </p>
              <span className="text-[10px] text-slate-500">Média de corte: {passingScore}%</span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-600" /> Taxa de Aprovação
              </span>
              <p className={`text-xl font-black ${summary.approvalRate >= 70 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {summary.approvalRate}%
              </p>
              <span className="text-[10px] text-slate-500">{summary.approvedCount} de {summary.totalParticipants} aprovados</span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Crown size={12} className="text-amber-600" /> Maior Aproveitamento
              </span>
              <p className="text-xl font-black text-amber-700">
                {summary.highestScore}%
              </p>
              <span className="text-[10px] text-slate-500">Menor: {summary.lowestScore}%</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Pódio Visual dos Três Melhores Colocados (Destaque Ouro, Prata, Bronze) */}
      {summary && summary.totalParticipants > 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-amber-600" />
              <h3 className="text-sm font-black text-[#0F1F38] uppercase tracking-wider">
                Pódio de Excelência Operacional
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Classificação oficial por mérito</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            
            {/* 🥈 2º LUGAR — PRATA */}
            <div className="order-2 md:order-1 bg-gradient-to-b from-slate-50 to-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group hover:border-slate-300 transition-all shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5">
                    <Medal size={14} className="text-slate-500" /> 2º LUGAR • PRATA
                  </span>
                  {summary.podium.second.some(s => s.isTie) && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Empate
                    </span>
                  )}
                </div>

                {summary.podium.second.length > 0 ? (
                  summary.podium.second.map(item => (
                    <div key={item.attemptId} className="space-y-1.5 py-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-black text-xs text-slate-800 shrink-0">
                          {getInitials(item.participantName)}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="text-sm font-black text-slate-900 truncate">{item.participantName}</h4>
                          <p className="text-[10px] text-slate-500 truncate">{item.participantRole || 'Colaborador'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500 text-[11px]">{item.correctCount}/{item.totalQuestions} acertos</span>
                          {item.timeSpentFormatted && item.timeSpentFormatted !== '—' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                              <Clock size={10} className="text-slate-500" /> {item.timeSpentFormatted}
                            </span>
                          )}
                        </div>
                        <span className="font-black text-slate-800 text-sm">{item.score}%</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">Nenhum participante nesta colocação</p>
                )}
              </div>
            </div>

            {/* 🥇 1º LUGAR — OURO (Destaque Central Elevado com coroa e brilho) */}
            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-50/80 via-white to-white border-2 border-amber-300 rounded-3xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group hover:border-amber-400 transition-all shadow-md md:-translate-y-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 bg-amber-100 px-3 py-1 rounded-lg border border-amber-300 flex items-center gap-1.5 shadow-sm">
                    <Crown size={15} className="text-amber-600" /> 1º LUGAR • OURO
                  </span>
                  {summary.podium.first.some(f => f.isTie) && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      Empate
                    </span>
                  )}
                </div>

                {summary.podium.first.length > 0 ? (
                  summary.podium.first.map(item => (
                    <div key={item.attemptId} className="space-y-1.5 py-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 border-2 border-amber-400 flex items-center justify-center font-black text-xs text-slate-900 shrink-0 shadow-sm">
                          {getInitials(item.participantName)}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="text-sm sm:text-base font-black text-slate-900 truncate flex items-center gap-1">
                            {item.participantName} <Sparkles size={13} className="text-amber-500 shrink-0" />
                          </h4>
                          <p className="text-[10px] text-slate-500 truncate">{item.participantRole || 'Colaborador'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-600 font-bold text-[11px]">{item.correctCount}/{item.totalQuestions} acertos</span>
                          {item.timeSpentFormatted && item.timeSpentFormatted !== '—' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-900 border border-amber-200 flex items-center gap-1">
                              <Clock size={10} className="text-amber-600" /> {item.timeSpentFormatted}
                            </span>
                          )}
                        </div>
                        <span className="font-black text-amber-700 text-base">{item.score}%</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">Nenhum participante nesta colocação</p>
                )}
              </div>
            </div>

            {/* 🥉 3º LUGAR — BRONZE */}
            <div className="order-3 md:order-3 bg-gradient-to-b from-orange-50/50 to-white border border-orange-200 rounded-3xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group hover:border-orange-300 transition-all shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-orange-900 bg-orange-100 px-2.5 py-1 rounded-lg border border-orange-300 flex items-center gap-1.5">
                    <Award size={14} className="text-orange-600" /> 3º LUGAR • BRONZE
                  </span>
                  {summary.podium.third.some(t => t.isTie) && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Empate
                    </span>
                  )}
                </div>

                {summary.podium.third.length > 0 ? (
                  summary.podium.third.map(item => (
                    <div key={item.attemptId} className="space-y-1.5 py-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-orange-200 border border-orange-300 flex items-center justify-center font-black text-xs text-orange-950 shrink-0">
                          {getInitials(item.participantName)}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="text-sm font-black text-slate-900 truncate">{item.participantName}</h4>
                          <p className="text-[10px] text-slate-500 truncate">{item.participantRole || 'Colaborador'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500 text-[11px]">{item.correctCount}/{item.totalQuestions} acertos</span>
                          {item.timeSpentFormatted && item.timeSpentFormatted !== '—' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100/70 text-orange-900 border border-orange-200 flex items-center gap-1">
                              <Clock size={10} className="text-orange-600" /> {item.timeSpentFormatted}
                            </span>
                          )}
                        </div>
                        <span className="font-black text-orange-800 text-sm">{item.score}%</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">Nenhum participante nesta colocação</p>
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* Estado Vazio Amigável */
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
            <Trophy size={28} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-black text-[#0F1F38] uppercase tracking-wider">
              Nenhuma Resposta Registrada Ainda
            </h3>
            <p className="text-xs text-slate-500">
              Assim que os colaboradores responderem a esta avaliação, o ranking automático e o pódio de excelência serão gerados aqui instantaneamente.
            </p>
          </div>
          {shareToken && (
            <button
              onClick={handleCopyShareLink}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedLink ? 'Link do Questionário Copiado!' : 'Copiar Link para a Equipe'}</span>
            </button>
          )}
        </div>
      )}

      {/* 4. Tabela do Ranking Completo com Busca e Filtros */}
      {summary && summary.totalParticipants > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-[#0F1F38] uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-blue-600" /> Classificação Geral ({summary.totalParticipants} avaliados)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Exibindo resultados individuais com aproveitamento, total de acertos e tempo de resposta
              </p>
            </div>

            {/* Filtros e Barra de Pesquisa */}
            <div className="flex items-center gap-2 flex-wrap">
              
              {/* Barra de Pesquisa */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 outline-none w-44 sm:w-52"
                />
              </div>

              {/* Filtro por Situação */}
              <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('PASSED')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    statusFilter === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:text-emerald-700'
                  }`}
                >
                  Aprovados
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('INSUFFICIENT')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    statusFilter === 'INSUFFICIENT' ? 'bg-rose-100 text-rose-800' : 'text-slate-500 hover:text-rose-700'
                  }`}
                >
                  Insuficientes
                </button>
              </div>

            </div>
          </div>

          {/* Tabela Responsiva */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-16 text-center">Posição</th>
                  <th className="py-3 px-3">Colaborador</th>
                  <th className="py-3 px-3 hidden sm:table-cell">Função</th>
                  <th className="py-3 px-3 text-center">Acertos</th>
                  <th className="py-3 px-3 text-center">Tempo</th>
                  <th className="py-3 px-3 text-center">Aproveitamento</th>
                  <th className="py-3 px-3 text-center">Situação</th>
                  <th className="py-3 px-3 text-right hidden md:table-cell">Conclusão</th>
                  {!isPublicMode && onOpenCollaboratorModal && (
                    <th className="py-3 px-3 text-center w-16">Ação</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRanking.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Nenhum colaborador encontrado para o filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  filteredRanking.map(item => {
                    const isPodium = item.position <= 3;
                    const posColor = item.position === 1 ? 'text-amber-600 font-black' :
                                     item.position === 2 ? 'text-slate-700 font-black' :
                                     item.position === 3 ? 'text-orange-600 font-black' :
                                     'text-slate-500 font-bold';

                    return (
                      <tr 
                        key={item.attemptId}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Posição */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {item.position === 1 && <Crown size={14} className="text-amber-500" />}
                            {item.position === 2 && <Medal size={14} className="text-slate-400" />}
                            {item.position === 3 && <Award size={14} className="text-orange-500" />}
                            <span className={posColor}>{item.position}º</span>
                            {item.isTie && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200" title="Empate de pontuação e tempo">
                                =
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Nome do Colaborador */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              isPodium ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {getInitials(item.participantName)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {item.participantName}
                              </p>
                              <p className="text-[10px] text-slate-400 sm:hidden">
                                {item.participantRole}
                              </p>
                              {!isPublicMode && item.participantRegistration && (
                                <p className="text-[10px] font-semibold text-slate-500">Matrícula: {item.participantRegistration}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Função */}
                        <td className="py-3 px-3 text-slate-600 hidden sm:table-cell whitespace-nowrap">
                          {item.participantRole || 'Colaborador'}
                        </td>

                        {/* Acertos */}
                        <td className="py-3 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                          {item.correctCount}/{item.totalQuestions}
                        </td>

                        {/* Tempo */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {item.timeSpentFormatted && item.timeSpentFormatted !== '—' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              <Clock size={11} className="text-emerald-600" />
                              {item.timeSpentFormatted}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Aproveitamento */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`font-black ${item.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {item.score}%
                            </span>
                          </div>
                        </td>

                        {/* Situação */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            item.passed 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                          }`}>
                            {item.passed ? 'Aprovado' : 'Insuficiente'}
                          </span>
                        </td>

                        {/* Data */}
                        <td className="py-3 px-3 text-right text-slate-400 text-[11px] hidden md:table-cell whitespace-nowrap">
                          {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>

                        {/* Ver Gabarito / Respostas (Gestor) */}
                        {!isPublicMode && onOpenCollaboratorModal && (
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => onOpenCollaboratorModal(item.attemptId)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Ver Gabarito e Questões Respondidas"
                            >
                              <Eye size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
}
