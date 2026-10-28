'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, TrendingUp, Users, Target, Award, Trophy,
  Calendar, Filter, Search, Download, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, ShieldAlert, Sparkles, ChevronLeft, ChevronRight,
  Eye, Check, Copy, ArrowUpRight, ArrowDownRight, Layers, BookOpen,
  FileText, ExternalLink, HelpCircle
} from 'lucide-react';
import { generateBiConsolidatedPdf } from '@/lib/quizBiPdf';
import { generateQuizRankingPdf } from '@/lib/quizRankingPdf';
import { computeQuizRanking } from '@/lib/quizRanking';
import QuizRankingView from './QuizRankingView';

interface BiIndicators {
  totalQuizzesCreated: number;
  totalQuizzesPublished: number;
  totalQuizzesClosed: number;
  totalQuizzesInProgress: number;
  totalAttempts: number;
  uniqueParticipantsCount: number;
  overallAverageScore: number;
  approvalRate: number;
  criticalPerformancesCount: number;
  participationRate: number;
}

interface BiQuizItem {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  shareToken: string;
  passingScore: number;
  criticalBelow: number;
  showRanking?: boolean;
  createdAt: string;
  publishedAt?: string | null;
  closedAt?: string | null;
  meetingId?: string | null;
  meetingTopic?: string | null;
  meetingFarm?: string | null;
  questionsCount: number;
  totalParticipants: number;
  totalAttempts: number;
  averageScore: number;
  approvalRate: number;
  highestScore: number;
  lowestScore: number;
  isClosed: boolean;
  isPartial: boolean;
}

interface FragilityItem {
  questionId: string;
  quizId: string;
  meetingId?: string | null;
  quizTitle: string;
  questionText: string;
  totalAnswered: number;
  correctCount: number;
  errorCount: number;
  errorRate: number;
  correctOptionText: string;
  mostCommonWrongText: string;
  fragilityLevel: 'CRITICAL' | 'MODERATE' | 'LOW';
  actionPlan: string;
}

interface Props {
  organizerName?: string;
  companyName?: string;
  onOpenCollaboratorModal?: (collaboratorName: string) => void;
  onSelectQuizForRanking?: (quizId: string) => void;
}

export default function QuizBiDashboard({
  organizerName = 'Gestor de Segurança',
  companyName = 'DDS Online',
  onOpenCollaboratorModal,
  onSelectQuizForRanking
}: Props) {
  // Sub-abas da Área de BI
  const [subTab, setSubTab] = useState<'OVERVIEW' | 'ANALYSIS' | 'RANKING' | 'HISTORY' | 'LEARNING'>('OVERVIEW');

  // Filtros Globais
  const [period, setPeriod] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [scoreRangeFilter, setScoreRangeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('ALL');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('ALL');

  // Estado de Dados da API
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [indicators, setIndicators] = useState<BiIndicators>({
    totalQuizzesCreated: 0,
    totalQuizzesPublished: 0,
    totalQuizzesClosed: 0,
    totalQuizzesInProgress: 0,
    totalAttempts: 0,
    uniqueParticipantsCount: 0,
    overallAverageScore: 0,
    approvalRate: 0,
    criticalPerformancesCount: 0,
    participationRate: 0
  });

  const [quizzes, setQuizzes] = useState<BiQuizItem[]>([]);
  const [fragilities, setFragilities] = useState<FragilityItem[]>([]);
  const [monthlyTimeline, setMonthlyTimeline] = useState<any[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<any>({
    critical: 0,
    regular: 0,
    approved: 0,
    excellent: 0
  });
  const [ddsPerformance, setDdsPerformance] = useState<any[]>([]);
  const [topParticipants, setTopParticipants] = useState<any[]>([]);

  // Histórico Paginado
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize] = useState<number>(8);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historySortBy, setHistorySortBy] = useState<string>('createdAt');
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);
  // Fluxo rápido exclusivo para fragilidades com respostas incorretas.
  const [planQuestion, setPlanQuestion] = useState<FragilityItem | null>(null);
  const [planStartDate, setPlanStartDate] = useState('');
  const [planDueDate, setPlanDueDate] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planSuccess, setPlanSuccess] = useState<{ code: string; id: string } | null>(null);


  // Consulta à API de BI
  const fetchBiData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (period !== 'all') params.set('period', period);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (scoreRangeFilter !== 'ALL') params.set('scoreRange', scoreRangeFilter);
      if (searchTerm.trim()) params.set('theme', searchTerm.trim());
      if (selectedMeetingId !== 'ALL') params.set('meetingId', selectedMeetingId);
      if (selectedQuizId !== 'ALL') params.set('quizId', selectedQuizId);
      params.set('_t', String(Date.now()));

      const res = await fetch(`/api/questionarios/bi?${params.toString()}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Falha ao carregar dados do BI.');
      }

      setIndicators(data.indicators || {});
      setQuizzes(data.quizzes || []);
      setFragilities(data.fragilities || []);
      setMonthlyTimeline(data.charts?.monthlyTimeline || []);
      setScoreDistribution(data.charts?.scoreDistribution || { critical: 0, regular: 0, approved: 0, excellent: 0 });
      setDdsPerformance(data.charts?.ddsPerformance || []);
      setTopParticipants(data.ranking?.participants || []);

    } catch (err: any) {
      console.error('Erro ao buscar BI:', err);
      setError(err?.message || 'Não foi possível carregar as informações analíticas.');
    } finally {
      setIsLoading(false);
    }
  }, [period, startDate, endDate, statusFilter, scoreRangeFilter, searchTerm, selectedMeetingId, selectedQuizId]);

  useEffect(() => {
    fetchBiData();
  }, [fetchBiData]);

  // Histórico com Filtro Local / Paginação
  const filteredHistory = useMemo(() => {
    let list = [...quizzes];
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter(item =>
        item.title.toLowerCase().includes(q) ||
        (item.meetingTopic && item.meetingTopic.toLowerCase().includes(q)) ||
        (item.meetingFarm && item.meetingFarm.toLowerCase().includes(q))
      );
    }
    if (historySortBy === 'averageScore') {
      list.sort((a, b) => b.averageScore - a.averageScore);
    } else if (historySortBy === 'totalAttempts') {
      list.sort((a, b) => b.totalAttempts - a.totalAttempts);
    } else if (historySortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [quizzes, historySearch, historySortBy]);

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistory.slice(start, start + historyPageSize);
  }, [filteredHistory, historyPage, historyPageSize]);

  // Exportação do Relatório Consolidado em PDF
  const handleExportConsolidatedPdf = async () => {
    try {
      setIsExporting(true);
      const periodLabels: Record<string, string> = {
        all: 'Histórico Completo',
        '7d': 'Últimos 7 dias',
        '30d': 'Últimos 30 dias',
        '90d': 'Últimos 90 dias',
        year: 'Ano Atual',
        custom: `${startDate || 'Início'} até ${endDate || 'Hoje'}`
      };

      const doc = await generateBiConsolidatedPdf({
        periodLabel: periodLabels[period] || 'Período Geral',
        organizerName,
        companyName,
        indicators,
        quizzes,
        fragilities
      });

      doc.save(`BI_Questionarios_DDS_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      alert('Não foi possível gerar o PDF consolidado do BI.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyPlan = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedActionId(id);
    setTimeout(() => setCopiedActionId(null), 3000);
  };


  const openAutomaticPlan = (item: FragilityItem) => {
    if (item.errorCount <= 0) return;
    setPlanQuestion(item);
    const now = new Date();
    setPlanStartDate([now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'));
    setPlanDueDate('');
    setPlanError('');
    setPlanSuccess(null);
  };

  const submitAutomaticPlan = async () => {
    const item = planQuestion;
    if (!item || savingPlan) return;
    if (!planStartDate || !planDueDate) {
      setPlanError('Informe a data de início e o prazo final do plano.');
      return;
    }
    if (planDueDate < planStartDate) {
      setPlanError('O prazo final não pode ser anterior ao início.');
      return;
    }
    const risk = item.mostCommonWrongText
      ? `Resposta incorreta identificada: "${item.mostCommonWrongText}".`
      : 'Respostas incorretas identificadas nesta questão.';
    try {
      setSavingPlan(true);
      setPlanError('');
      const response = await fetch('/api/planos-de-acao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Reforço preventivo — ${item.questionText}`.slice(0, 220),
          description: `Avaliação: ${item.quizTitle}. Questão: ${item.questionText}.`,
          origin: 'QUESTIONNAIRE',
          originReferenceId: item.questionId,
          meetingId: item.meetingId || null,
          category: 'Segurança do Trabalho / Aprendizagem',
          criticality: item.fragilityLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          priority: item.fragilityLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          status: 'OPEN',
          identificationDate: new Date().toISOString(),
          problemDescription: `Questão: ${item.questionText}\nAvaliação: ${item.quizTitle}\nOcorrências: ${item.errorCount} erros em ${item.totalAnswered} respostas (${item.errorRate}%).`,
          identifiedRisk: risk,
          identifiedCause: 'Dificuldade de compreensão apontada pelas respostas ao questionário; investigar a causa com a equipe.',
          immediateMeasures: 'Orientar a equipe sobre a resposta correta e avaliar a necessidade de reforço no próximo DDS.',
          actionDescription: item.actionPlan || `Reforçar a orientação sobre: ${item.questionText}`,
          actionObjective: 'Esclarecer a dúvida e reforçar a conduta preventiva correta.',
          expectedResult: `A equipe deverá compreender e aplicar a orientação correta: ${item.correctOptionText}`,
          completionCriteria: 'Realizar o reforço, registrar evidências e avaliar a compreensão da equipe.',
          additionalNotes: `Gabarito: ${item.correctOptionText}. Desvio mais frequente: ${item.mostCommonWrongText || 'Não identificado'}.`,
          startDate: planStartDate + 'T12:00:00.000Z',
          dueDate: planDueDate + 'T12:00:00.000Z'
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Não foi possível criar o plano de ação.');
      setPlanSuccess({ code: result.data?.code || result.plan?.code || 'Criado', id: result.data?.id || result.plan?.id || '' });
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Erro ao registrar o plano de ação.');
    } finally {
      setSavingPlan(false);
    }
  };

  // Seletor de Quiz para visualização do Ranking Integrado
  const activeRankingQuiz = useMemo(() => {
    if (selectedQuizId !== 'ALL') {
      return quizzes.find(q => q.id === selectedQuizId) || quizzes[0] || null;
    }
    const withAttempts = quizzes.find(q => q.totalAttempts > 0);
    return withAttempts || quizzes[0] || null;
  }, [quizzes, selectedQuizId]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. BARRA SUPERIOR: CONTROLE DE SUB-ABAS DO BI & EXPORTAÇÃO                */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/80 p-3 sm:p-4 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Sub-abas das 5 Áreas Principais */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-2xl">
          <button
            type="button"
            onClick={() => setSubTab('OVERVIEW')}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'OVERVIEW'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 size={14} />
            <span>Visão Geral</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('ANALYSIS')}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'ANALYSIS'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers size={14} />
            <span>Análise ({quizzes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('RANKING')}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'RANKING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Trophy size={14} />
            <span>Ranking</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('HISTORY')}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'HISTORY'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen size={14} />
            <span>Histórico</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('LEARNING')}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'LEARNING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp size={14} />
            <span>Evolução</span>
          </button>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={fetchBiData}
            disabled={isLoading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700"
            title="Atualizar Dados do BI"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-emerald-400' : ''} />
          </button>

          <button
            type="button"
            onClick={handleExportConsolidatedPdf}
            disabled={isExporting || isLoading}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            <span>{isExporting ? 'Exportando...' : 'Exportar Relatório PDF'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FILTROS INTELIGENTES GLOBAIS                                           */}
      {/* ========================================================================= */}
      <section className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-emerald-400" />
            <h2 className="text-xs font-black text-white uppercase tracking-wider">
              Filtros Inteligentes de Business Intelligence
            </h2>
          </div>
          {(period !== 'all' || statusFilter !== 'ALL' || scoreRangeFilter !== 'ALL' || searchTerm || selectedQuizId !== 'ALL') && (
            <button
              onClick={() => {
                setPeriod('all');
                setStatusFilter('ALL');
                setScoreRangeFilter('ALL');
                setSearchTerm('');
                setSelectedQuizId('ALL');
                setSelectedMeetingId('ALL');
              }}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs">
          {/* Período */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Período</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="all">Todo o Histórico</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="year">Este Ano</option>
              <option value="custom">Período Personalizado</option>
            </select>
          </div>

          {/* Status da Avaliação */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="ALL">Todos os Status</option>
              <option value="PUBLISHED">Em Andamento (Publicado)</option>
              <option value="CLOSED">Concluído (Encerrado)</option>
              <option value="DRAFT">Rascunho</option>
            </select>
          </div>

          {/* Faixa de Aproveitamento */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Aproveitamento</label>
            <select
              value={scoreRangeFilter}
              onChange={e => setScoreRangeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="ALL">Todas as Notas</option>
              <option value="CRITICAL">🚨 Crítico (&lt; 40%)</option>
              <option value="REGULAR">⚠️ Regular (40% - 69%)</option>
              <option value="APPROVED">✅ Aprovado (70% - 89%)</option>
              <option value="EXCELLENT">⭐ Excelente (≥ 90%)</option>
            </select>
          </div>

          {/* Questionário Específico */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Questionário</label>
            <select
              value={selectedQuizId}
              onChange={e => setSelectedQuizId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 font-medium truncate"
            >
              <option value="ALL">Todos os Questionários</option>
              {quizzes.map(q => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.status === 'PUBLISHED' ? 'Ativo' : 'Encerrado'})
                </option>
              ))}
            </select>
          </div>

          {/* Busca Textual */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Busca por Tema / Palavra</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: Linha de fogo, NR-31..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 font-medium placeholder-slate-600 text-xs"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Datas personalizadas quando 'custom' for selecionado */}
        {period === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 max-w-md">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Data Início</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Data Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </section>

      {/* Feedback de Erro */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3 text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchBiData}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg font-bold text-xs cursor-pointer transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA A: VISÃO GERAL (INDICADORES CONSOLIDADOS & HIGHLIGHTS)            */}
      {/* ========================================================================= */}
      {subTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Grid de 8 Cards de Indicadores Consolidados */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Aproveitamento Médio */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Aproveitamento Médio</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-emerald-400">{indicators.overallAverageScore}%</h3>
                <span className="text-[10px] text-slate-400">geral</span>
              </div>
            </div>

            {/* Taxa de Aprovação */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Taxa de Aprovação</span>
              <div className="flex items-baseline gap-2">
                <h3 className={`text-2xl font-black ${indicators.approvalRate >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {indicators.approvalRate}%
                </h3>
                <span className="text-[10px] text-slate-400">da equipe</span>
              </div>
            </div>

            {/* Respostas Recebidas */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total de Respostas</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-white">{indicators.totalAttempts}</h3>
                <span className="text-[10px] text-slate-400">submissões</span>
              </div>
            </div>

            {/* Participantes Distintos */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Colaboradores Únicos</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-cyan-300">{indicators.uniqueParticipantsCount}</h3>
                <span className="text-[10px] text-slate-400">avaliados</span>
              </div>
            </div>

            {/* Desempenhos Críticos */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Desempenhos Críticos</span>
              <div className="flex items-baseline gap-2">
                <h3 className={`text-2xl font-black ${indicators.criticalPerformancesCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {indicators.criticalPerformancesCount}
                </h3>
                <span className="text-[10px] text-slate-400">&lt; 40%</span>
              </div>
            </div>

            {/* Questionários em Andamento */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Em Andamento</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-amber-300">{indicators.totalQuizzesInProgress}</h3>
                <span className="text-[10px] text-slate-400">parciais</span>
              </div>
            </div>

            {/* Questionários Concluídos */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Concluídos</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-emerald-300">{indicators.totalQuizzesClosed}</h3>
                <span className="text-[10px] text-slate-400">finais</span>
              </div>
            </div>

            {/* Total Criados */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Criados</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-slate-200">{indicators.totalQuizzesCreated}</h3>
                <span className="text-[10px] text-slate-400">avaliativas</span>
              </div>
            </div>

            {/* Taxa de Participação */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Taxa Participação</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-teal-300">{indicators.participationRate}%</h3>
                <span className="text-[10px] text-slate-400">dos DDS</span>
              </div>
            </div>

            {/* Fragilidades Críticas */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Fragilidades de Pauta</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-rose-400">
                  {fragilities.filter(f => f.fragilityLevel === 'CRITICAL').length}
                </h3>
                <span className="text-[10px] text-slate-400">temas &gt;50% erro</span>
              </div>
            </div>
          </div>

          {/* Gráfico 1: Distribuição das Notas (Histograma de Faixas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-emerald-400" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Distribuição das Notas (Histograma de Desempenho)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">Total: {indicators.totalAttempts} avaliações</span>
              </div>

              {indicators.totalAttempts === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Nenhuma resposta registrada no período.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {[
                    { label: 'Excelente (90% a 100%)', count: scoreDistribution.excellent, color: 'bg-emerald-500', text: 'text-emerald-400' },
                    { label: 'Aprovado (70% a 89%)', count: scoreDistribution.approved, color: 'bg-teal-500', text: 'text-teal-400' },
                    { label: 'Regular (40% a 69%)', count: scoreDistribution.regular, color: 'bg-amber-500', text: 'text-amber-400' },
                    { label: 'Crítico (Abaixo de 40%)', count: scoreDistribution.critical, color: 'bg-rose-500', text: 'text-rose-400' }
                  ].map((item, idx) => {
                    const percent = indicators.totalAttempts > 0
                      ? Math.round((item.count / indicators.totalAttempts) * 100)
                      : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-semibold">{item.label}</span>
                          <span className={`font-black ${item.text}`}>{item.count} ({percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 flex">
                          <div
                            className={`${item.color} h-full rounded-full transition-all duration-500`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Destaque 2: Top Colaboradores & Top Questionário */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-amber-400" />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Destaques do Ranking Geral
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubTab('RANKING')}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer"
                  >
                    Ver Ranking Completo →
                  </button>
                </div>

                <div className="space-y-2.5 pt-3">
                  {topParticipants.slice(0, 3).map((p, idx) => (
                    <div
                      key={idx}
                      onClick={() => onOpenCollaboratorModal && onOpenCollaboratorModal(p.name)}
                      className="p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                          idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-400 text-slate-950' : 'bg-amber-700 text-white'
                        }`}>
                          {idx + 1}º
                        </span>
                        <div>
                          <h4 className="font-bold text-white group-hover:text-emerald-300 transition-colors">{p.name}</h4>
                          <span className="text-[10px] text-slate-400">{p.role} • {p.totalAttempts} prova(s)</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-400 text-sm">{p.avgScore}%</span>
                        <span className="text-[10px] text-slate-500 block">média</span>
                      </div>
                    </div>
                  ))}

                  {topParticipants.length === 0 && (
                    <p className="text-xs text-slate-400 py-6 text-center">Nenhum colaborador avaliado ainda.</p>
                  )}
                </div>
              </div>

              {/* Box de Alerta Metodológico */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-400 mt-3">
                <HelpCircle size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Critério de BI:</strong> A quantidade de respostas ({indicators.totalAttempts}) reflete o volume total de submissões, enquanto {indicators.uniqueParticipantsCount} colaboradores únicos foram individualmente auditados.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA B: ANÁLISE DE QUESTIONÁRIOS                                       */}
      {/* ========================================================================= */}
      {subTab === 'ANALYSIS' && (
        <section className="bg-white border border-slate-200/80 p-5 sm:p-7 rounded-3xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-emerald-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Análise Comparativa de Questionários ({quizzes.length})
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Acompanhe o desempenho médio, aprovação e volume de colaboradores em cada avaliação aplicada.
              </p>
            </div>
          </div>

          {quizzes.length === 0 ? (
            <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800">
              <Layers size={36} className="mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-bold text-white">Nenhum questionário encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Revise os filtros selecionados ou crie uma nova avaliação.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {quizzes.map(q => {
                const isClosed = q.status === 'CLOSED';
                return (
                  <div
                    key={q.id}
                    className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-3.5 transition-all flex flex-col justify-between shadow-md"
                  >
                    <div>
                      {/* Tags de Status e DDS */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          isClosed
                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        }`}>
                          {isClosed ? '🔒 Concluído (Dados Finais)' : '🟢 Em Andamento (Dados Parciais)'}
                        </span>

                        <span className="text-[11px] text-slate-400">
                          {q.questionsCount} perguntas
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white mt-2 leading-snug">{q.title}</h3>

                      <p className="text-xs text-slate-400 mt-1">
                        DDS: <strong className="text-slate-300">{q.meetingTopic ? `${q.meetingTopic} (${q.meetingFarm || 'Geral'})` : 'Autônomo (Sem DDS Vinculado)'}</strong>
                      </p>
                    </div>

                    {/* Métricas Rápidas */}
                    <div className="grid grid-cols-4 gap-2 p-2.5 bg-slate-900 rounded-xl border border-slate-800/80 text-center">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Média</span>
                        <span className="text-xs font-black text-emerald-400">{q.averageScore}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Aprovação</span>
                        <span className="text-xs font-black text-teal-300">{q.approvalRate}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Respostas</span>
                        <span className="text-xs font-black text-white">{q.totalAttempts}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Participantes</span>
                        <span className="text-xs font-black text-cyan-300">{q.totalParticipants}</span>
                      </div>
                    </div>

                    {/* Rodapé com Ações */}
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-slate-500">
                        Criado em {new Date(q.createdAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuizId(q.id);
                            setSubTab('RANKING');
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Ver Ranking Desta Avaliação"
                        >
                          <Trophy size={12} className="text-amber-400" />
                          <span>Ranking</span>
                        </button>

                        <a
                          href={`/questionario/${q.shareToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
                          title="Abrir Link da Avaliação"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA C: RANKING DE DESEMPENHO INTEGRADO                                */}
      {/* ========================================================================= */}
      {subTab === 'RANKING' && (
        <div className="space-y-4">
          {/* Seletor do Questionário em foco para o Ranking */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Questionário Selecionado</span>
              <h3 className="text-sm font-bold text-white">
                {activeRankingQuiz ? activeRankingQuiz.title : 'Nenhum questionário selecionado'}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedQuizId}
                onChange={e => setSelectedQuizId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-emerald-500 font-medium max-w-xs truncate"
              >
                <option value="ALL">Selecionar Questionário...</option>
                {quizzes.map(q => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>
          </div>

          {activeRankingQuiz ? (
            <QuizRankingView
              key={activeRankingQuiz.id}
              quizId={activeRankingQuiz.id}
              quizTitle={activeRankingQuiz.title}
              passingScore={activeRankingQuiz.passingScore}
              ddsTopic={activeRankingQuiz.meetingTopic || undefined}
              ddsFarm={activeRankingQuiz.meetingFarm || undefined}
              initialShowRanking={activeRankingQuiz.showRanking}
              shareToken={activeRankingQuiz.shareToken}
              organizerName={organizerName}
              companyName={companyName}
              />
          ) : (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
              <Trophy size={36} className="mx-auto text-amber-500 mb-2" />
              <p className="text-sm font-bold text-white">Nenhum questionário disponível para exibir ranking</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA D: HISTÓRICO DE AVALIAÇÕES (PERMANENTE & PAGINADO)                 */}
      {/* ========================================================================= */}
      {subTab === 'HISTORY' && (
        <section className="bg-white border border-slate-200/80 p-5 sm:p-7 rounded-3xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-emerald-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Histórico Permanente de Avaliações
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Todas as avaliações concluídas e ativas preservadas para auditoria, histórico e relatórios.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportConsolidatedPdf}
                disabled={isExporting}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={13} />
                <span>Exportar Histórico</span>
              </button>
            </div>
          </div>

          {/* Filtros Rápidos de Histórico */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Filtrar histórico..."
                value={historySearch}
                onChange={e => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-emerald-500 font-medium placeholder-slate-600"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
              <span className="text-[11px] text-slate-400">Ordenar por:</span>
              <select
                value={historySortBy}
                onChange={e => setHistorySortBy(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="createdAt">Data de Criação</option>
                <option value="averageScore">Média de Aproveitamento</option>
                <option value="totalAttempts">Volume de Respostas</option>
                <option value="title">Título Alfabético</option>
              </select>
            </div>
          </div>

          {/* Tabela do Histórico */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Título da Avaliação</th>
                  <th className="py-2.5 px-3">DDS Vinculado</th>
                  <th className="py-2.5 px-3 text-center">Colaboradores</th>
                  <th className="py-2.5 px-3 text-center">Respostas</th>
                  <th className="py-2.5 px-3 text-center">Média</th>
                  <th className="py-2.5 px-3 text-center">Aprovação</th>
                  <th className="py-2.5 px-3 text-right">Data</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {pagedHistory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-950/60 transition-colors">
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        item.status === 'CLOSED'
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : item.status === 'PUBLISHED'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        {item.status === 'CLOSED' ? 'Encerrado' : item.status === 'PUBLISHED' ? 'Ativo' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-white max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                      {item.meetingTopic ? `${item.meetingTopic} (${item.meetingFarm || 'Geral'})` : 'Autônomo'}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-cyan-300">
                      {item.totalParticipants}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-white">
                      {item.totalAttempts}
                    </td>
                    <td className="py-3 px-3 text-center font-black text-emerald-400">
                      {item.averageScore}%
                    </td>
                    <td className="py-3 px-3 text-center font-black text-teal-300">
                      {item.approvalRate}%
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuizId(item.id);
                          setSubTab('RANKING');
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Ver Ranking e Detalhes"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {pagedHistory.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                      Nenhuma avaliação histórica encontrada com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalHistoryPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
              <span className="text-slate-400">
                Página <strong>{historyPage}</strong> de <strong>{totalHistoryPages}</strong> ({filteredHistory.length} registros)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={13} /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                  disabled={historyPage === totalHistoryPages}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  Próxima <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA E: EVOLUÇÃO DE APRENDIZAGEM & FRAGILIDADES OPERACIONAIS           */}
      {/* ========================================================================= */}
      {subTab === 'LEARNING' && (
        <div className="space-y-6">
          {/* Gráfico de Evolução Mensal da Participação & Média */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Evolução Temporal dos Resultados (Participação e Média de Aproveitamento)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Meses com Avaliações Ativas</span>
            </div>

            {monthlyTimeline.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Dados insuficientes para desenhar curva de evolução temporal.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                {monthlyTimeline.map((m, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-center">
                    <span className="text-[11px] font-black text-slate-400 uppercase">{m.label}</span>
                    <div className="space-y-0.5">
                      <h4 className="text-lg font-black text-emerald-400">{m.averageScore}%</h4>
                      <span className="text-[10px] text-slate-500 block">aproveitamento</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-850 text-[10px] text-slate-300">
                      <strong>{m.attempts}</strong> respostas ({m.uniqueParticipants} únicos)
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Aviso metodológico essencial */}
            <div className="p-3 bg-slate-950 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300/90">
              <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Diretriz Pedagógica de Segurança:</strong> Não interprete automaticamente variações de notas entre questionários com níveis de dificuldade distintos como melhora ou piora individual do colaborador. Utilize as métricas para diagnosticar a retenção de cada tema específico.
              </span>
            </div>
          </div>

          {/* Diagnóstico de Fragilidades Operacionais com Planos de Ação */}
          <section className="bg-white border border-slate-200/80 p-5 sm:p-7 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className="text-rose-400" />
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    Temas com Maiores Dificuldades & Oportunidades de Reforço no DDS
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Identificação das dúvidas mais comuns com geração de plano de ação preventivo pronto para aplicação em campo.
                </p>
              </div>

              <span className="text-[11px] font-bold text-slate-400 self-start sm:self-auto bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                Questões Mapeadas: <strong className="text-white">{fragilities.length}</strong>
              </span>
            </div>

            {fragilities.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhuma resposta registrada ainda para calcular fragilidades.</p>
            ) : (
              <div className="space-y-3.5">
                {fragilities.map((item, idx) => {
                  const isCrit = item.fragilityLevel === 'CRITICAL';
                  const isMod = item.fragilityLevel === 'MODERATE';
                  return (
                    <div
                      key={item.questionId || idx}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isCrit
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : isMod
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              isCrit
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                : isMod
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            }`}>
                              {isCrit ? '🚨 Tema Crítico' : isMod ? '⚠️ Ponto de Atenção' : '✅ Procedimento Seguro'}
                            </span>
                            <span className="text-[11px] text-slate-400">{item.quizTitle}</span>
                          </div>
                          <h3 className="text-sm font-bold text-white pt-1">{item.questionText}</h3>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-baseline gap-1.5 justify-end">
                            <span className={`text-base font-black ${isCrit ? 'text-rose-400' : isMod ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {item.errorRate}%
                            </span>
                            <span className="text-[11px] text-slate-400">taxa de erro</span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {item.errorCount} erros • {item.correctCount} acertos ({item.totalAnswered} respostas)
                          </span>
                        </div>
                      </div>

                      {/* Gabarito vs Desvio */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-slate-900/80 rounded-xl border border-emerald-500/20 space-y-0.5">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 size={11} /> Procedimento Correto (Gabarito)
                          </span>
                          <p className="text-slate-200 font-semibold">{item.correctOptionText}</p>
                        </div>

                        {item.mostCommonWrongText ? (
                          <div className="p-2.5 bg-slate-900/80 rounded-xl border border-rose-500/20 space-y-0.5">
                            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                              <AlertTriangle size={11} /> Desvio Mais Comum Marcado
                            </span>
                            <p className="text-slate-200 font-semibold">{item.mostCommonWrongText}</p>
                          </div>
                        ) : null}
                      </div>

                      {/* Box de Ação para o DDS */}
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 text-teal-400 font-bold text-[11px] uppercase tracking-wider">
                            <Target size={13} />
                            <span>Pauta de Reforço Recomendada para o DDS</span>
                          </div>
                          <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-line">
                            {item.actionPlan}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyPlan(item.actionPlan, item.questionId)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                          >
                            {copiedActionId === item.questionId ? (
                              <>
                                <Check size={13} className="text-emerald-400" />
                                <span className="text-emerald-400 font-bold">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>

                          {item.errorCount > 0 && (
                            <button
                              type="button"
                              onClick={() => openAutomaticPlan(item)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                              title="Gerar plano automaticamente a partir dos erros e definir o prazo"
                            >
                              <Target size={13} />
                              <span>Criar Plano de Ação</span>
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {planQuestion && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="auto-plan-title" className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="auto-plan-title" className="text-lg font-black">Plano de ação a partir do questionário</h2>
                <p className="text-xs text-slate-400 mt-1">Os dados da questão e do gabarito serão preenchidos automaticamente.</p>
              </div>
              <button type="button" aria-label="Fechar" disabled={savingPlan} onClick={() => setPlanQuestion(null)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs">Fechar</button>
            </div>
            {planSuccess ? (
              <div className="space-y-3 rounded-xl border border-emerald-700 bg-emerald-950/40 p-4">
                <p role="status" className="text-sm font-bold text-emerald-300">Plano de ação criado com sucesso: {planSuccess.code}</p>
                <a href="/admin/planos-de-acao" className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-slate-950">Abrir Planos de Ação</a>
              </div>
            ) : (
              <>
                <div className="space-y-2 rounded-xl bg-slate-900 p-3 text-xs">
                  <p className="text-slate-400">Avaliação: <strong className="text-white">{planQuestion.quizTitle}</strong></p>
                  <p className="font-bold text-white">{planQuestion.questionText}</p>
                  <p className="text-rose-300">{planQuestion.errorCount} erros de {planQuestion.totalAnswered} respostas ({planQuestion.errorRate}%)</p>
                  <p className="text-emerald-300">Orientação correta: {planQuestion.correctOptionText}</p>
                  <p className="text-slate-400">Origem: Questionário · Situação inicial: Aberto · Prioridade: {planQuestion.fragilityLevel === 'CRITICAL' ? 'Alta' : 'Média'}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-200">Data de início
                    <input type="date" required value={planStartDate} onChange={e => setPlanStartDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-200">Prazo final
                    <input type="date" required min={planStartDate || undefined} value={planDueDate} onChange={e => setPlanDueDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white" />
                  </label>
                </div>
                <p className="text-xs text-slate-400">O responsável poderá ser atribuído posteriormente no módulo de Planos de Ação. A criação manual permanece disponível.</p>
                {planError && <p role="alert" className="rounded-lg bg-rose-950 p-3 text-sm text-rose-300">{planError}</p>}
                <button type="button" disabled={savingPlan || !planDueDate || !planStartDate} onClick={submitAutomaticPlan} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">
                  {savingPlan ? 'Criando plano...' : 'Confirmar e criar plano automaticamente'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
