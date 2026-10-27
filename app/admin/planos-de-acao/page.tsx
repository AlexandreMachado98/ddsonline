'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { 
  Plus, Search, Filter, Download, RefreshCw, LayoutDashboard, 
  List, Calendar as CalendarIcon, CheckSquare, Clock, 
  AlertTriangle, Shield, CheckCircle2, User, ChevronLeft, ChevronRight,
  FileText, ExternalLink, Eye, Edit3, Trash2, Loader2, Sparkles, SlidersHorizontal
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import MetricCard from '@/components/ui/MetricCard';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import ActionPlanModal from '@/components/planos-de-acao/ActionPlanModal';
import ActionPlanDetailsModal from '@/components/planos-de-acao/ActionPlanDetailsModal';
import ActionPlanKanban from '@/components/planos-de-acao/ActionPlanKanban';
import ActionPlanCalendar from '@/components/planos-de-acao/ActionPlanCalendar';
import ActionPlanDashboard from '@/components/planos-de-acao/ActionPlanDashboard';
import { 
  calculateDeadlineState, 
  calculatePlanProgress,
  STATUS_LABELS, 
  PRIORITY_LABELS, 
  ORIGIN_LABELS,
  ActionPlanStatus 
} from '@/lib/actionPlanUtils';
import { 
  generateActionPlanIndividualPdf, 
  generateActionPlanConsolidatedPdf 
} from '@/lib/actionPlanPdfGenerator';
import { useAuth } from '@/context/AuthContext';

function PlanosDeAcaoContent() {
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();

  // Estados de Visualização
  const [activeMode, setActiveMode] = useState<'DASHBOARD' | 'LIST' | 'KANBAN' | 'CALENDAR'>('LIST');
  const [activeScope, setActiveScope] = useState<'ALL' | 'MY' | 'IN_PROGRESS' | 'OVERDUE' | 'COMPLETED' | 'AWAITING'>('ALL');

  // Estados de Dados
  const [plans, setPlans] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Paginação e Filtros
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [originFilter, setOriginFilter] = useState('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Carrega Métricas do Dashboard
  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/planos-de-acao?view=dashboard');
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Carrega Lista de Planos de Ação
  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();

      // Mapeia o escopo
      if (activeScope === 'MY') queryParams.set('view', 'my');
      else if (activeScope === 'OVERDUE') queryParams.set('view', 'overdue');
      else if (activeScope === 'COMPLETED') queryParams.set('view', 'completed');
      else if (activeScope === 'AWAITING') queryParams.set('view', 'awaiting');
      else if (activeScope === 'IN_PROGRESS') queryParams.set('view', 'in_progress');

      if (search.trim()) queryParams.set('search', search.trim());
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      if (priorityFilter !== 'ALL') queryParams.set('priority', priorityFilter);
      if (originFilter !== 'ALL') queryParams.set('origin', originFilter);

      // No modo Kanban e Calendário carregamos um limite maior para visão completa
      if (activeMode === 'KANBAN' || activeMode === 'CALENDAR') {
        queryParams.set('limit', '100');
        queryParams.set('page', '1');
      } else {
        queryParams.set('limit', '15');
        queryParams.set('page', String(page));
      }

      const res = await fetch(`/api/planos-de-acao?${queryParams.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        setPlans(data.data);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.total || 0);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeScope, search, statusFilter, priorityFilter, originFilter, page, activeMode]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Atualização Rápida de Status (usada pelo Kanban)
  const handleUpdatePlanStatus = async (planId: string, newStatus: ActionPlanStatus) => {
    try {
      const res = await fetch('/api/planos-de-acao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: planId, status: newStatus })
      });
      if (res.ok) {
        loadPlans();
        loadMetrics();
      }
    } catch (e) {}
  };

  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canPermanentlyDelete = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'COMPANY_ADMIN';

  const handleDeletePlan = async (plan: any) => {
    const permanent = canPermanentlyDelete;
    const message = permanent
      ? `Excluir permanentemente o plano ${plan.code} — ${plan.title}? Esta ação remove o plano, tarefas, evidências e histórico associado e não pode ser desfeita.`
      : `Cancelar o plano ${plan.code} — ${plan.title}? O registro será mantido no histórico.`;
    if (!window.confirm(message)) return;
    setDeleteError(null);
    setDeletingPlanId(plan.id);
    try {
      const query = new URLSearchParams({ id: plan.id });
      if (permanent) query.set('permanent', 'true');
      const response = await fetch('/api/planos-de-acao?' + query.toString(), { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Não foi possível alterar o plano.');
      await Promise.all([loadPlans(), loadMetrics()]);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Falha ao excluir o plano.');
    } finally {
      setDeletingPlanId(null);
    }
  };

  // Abrir detalhes do plano
  const handleOpenDetails = (plan: any) => {
    setSelectedPlanId(plan.id);
    setIsDetailsModalOpen(true);
  };

  // Exportar Relatório Consolidado
  const handleExportConsolidatedPdf = async () => {
    try {
      // Busca todos os planos com detalhes para compor o relatório consolidado
      const res = await fetch('/api/planos-de-acao?limit=100');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        generateActionPlanConsolidatedPdf(data.data, {
          companyName: currentUser?.company || 'DDS-ON Corporativo'
        });
      }
    } catch (e) {
      alert('Falha ao gerar relatório consolidado');
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Painel Geral', href: '/admin' },
        { label: 'Planos de Ação' }
      ]}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsRefreshing(true);
              loadPlans();
              loadMetrics();
            }}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Atualizar dados"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
          </button>

          <button
            onClick={handleExportConsolidatedPdf}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-2xs"
          >
            <Download size={15} />
            <span>Relatório Consolidado</span>
          </button>

          <button
            onClick={() => {
              setEditingPlan(null);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm hover:shadow"
          >
            <Plus size={16} />
            <span>Novo Plano</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        
        {/* Barra Superior de Navegação por Modos e Escopos */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
          {/* Seletor de Modos (Dashboard, Lista, Kanban, Calendário) */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveMode('DASHBOARD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeMode === 'DASHBOARD'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard size={15} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveMode('LIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeMode === 'LIST'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List size={15} />
              <span>Lista</span>
            </button>

            <button
              onClick={() => setActiveMode('KANBAN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeMode === 'KANBAN'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare size={15} />
              <span>Kanban</span>
            </button>

            <button
              onClick={() => setActiveMode('CALENDAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeMode === 'CALENDAR'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon size={15} />
              <span>Calendário</span>
            </button>
          </div>

          {/* Seletor de Escopos Rápidos */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 text-xs font-bold">
            <button
              onClick={() => { setActiveScope('ALL'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeScope === 'ALL'
                  ? 'bg-[#0F1F38] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({metrics?.total || 0})
            </button>

            <button
              onClick={() => { setActiveScope('MY'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeScope === 'MY'
                  ? 'bg-[#0F1F38] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Meus Planos
            </button>

            <button
              onClick={() => { setActiveScope('IN_PROGRESS'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeScope === 'IN_PROGRESS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Em Andamento ({metrics?.inProgress || 0})
            </button>

            <button
              onClick={() => { setActiveScope('OVERDUE'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeScope === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Vencidos ({metrics?.overdue || 0})
            </button>

            <button
              onClick={() => { setActiveScope('AWAITING'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeScope === 'AWAITING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Validação ({metrics?.awaitingValidation || 0})
            </button>

            <button
              onClick={() => { setActiveScope('COMPLETED'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeScope === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Concluídos ({metrics?.completed || 0})
            </button>
          </div>
        </div>

        {/* Barra de Filtros e Busca Textual (disponível em Lista, Kanban e Calendário) */}
        {activeMode !== 'DASHBOARD' && (
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por código, título, setor, perigo ou responsável..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={priorityFilter}
                  onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white font-bold"
                >
                  <option value="ALL">Todas as Prioridades</option>
                  <option value="CRITICAL">Crítica</option>
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Média</option>
                  <option value="LOW">Baixa</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white font-bold"
                >
                  <option value="ALL">Todos os Status</option>
                  <option value="OPEN">Aberto</option>
                  <option value="IN_PROGRESS">Em Andamento</option>
                  <option value="AWAITING_VALIDATION">Aguardando Validação</option>
                  <option value="COMPLETED">Concluído</option>
                  <option value="SUSPENDED">Suspenso</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 1. VISUALIZAÇÃO: DASHBOARD */}
        {activeMode === 'DASHBOARD' && (
          <ActionPlanDashboard
            metrics={metrics}
            onFilterStatus={(st) => {
              if (st === 'OVERDUE') setActiveScope('OVERDUE');
              else if (st === 'IN_PROGRESS') setActiveScope('IN_PROGRESS');
              else if (st === 'COMPLETED') setActiveScope('COMPLETED');
              else if (st === 'AWAITING_VALIDATION') setActiveScope('AWAITING');
              else setActiveScope('ALL');
              setActiveMode('LIST');
            }}
          />
        )}

        {deleteError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{deleteError}</div>}

        {/* 2. VISUALIZAÇÃO: LISTA EM CARTÕES RESPONSIVOS */}
        {activeMode === 'LIST' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <p className="text-xs font-semibold">Carregando planos de ação...</p>
              </div>
            ) : plans.length === 0 ? (
              <EmptyState
                title="Nenhum plano de ação encontrado"
                description="Não há registros correspondentes aos filtros selecionados. Crie um novo plano ou ajuste a busca."
                action={{
                  label: "Novo Plano de Ação",
                  onClick: () => setIsCreateModalOpen(true),
                  icon: Plus
                }}
                className="my-8 border-none"
              />
            ) : (
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 p-3 sm:p-4">
                {plans.map(plan => {
                  const deadline = calculateDeadlineState(plan.dueDate, plan.completedAt, plan.status, plan.alertDaysBefore || 7);
                  const progress = calculatePlanProgress(plan.tasks || [], plan.status);
                  return (
                    <article key={plan.id} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm hover:border-blue-200 transition-colors min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-extrabold text-blue-700">{plan.code}</span>
                          <button type="button" onClick={() => handleOpenDetails(plan)} className="block text-left text-sm font-extrabold text-slate-900 hover:text-blue-700 break-words mt-1" title="Ver detalhes do plano">
                            {plan.title}
                          </button>
                          {plan.problemDescription && <p className="text-xs text-slate-500 mt-1 line-clamp-2 break-words">{plan.problemDescription}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1 shrink-0 max-w-full">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${plan.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : plan.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                            {PRIORITY_LABELS[plan.priority as keyof typeof PRIORITY_LABELS] || plan.priority}
                          </span>
                          <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold uppercase">
                            {STATUS_LABELS[plan.status as ActionPlanStatus] || plan.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div className="min-w-0"><span className="block text-[10px] font-bold uppercase text-slate-500">Origem / setor</span><p className="font-semibold text-slate-800 break-words">{ORIGIN_LABELS[plan.origin] || plan.origin} · {plan.sector || 'Geral'}</p></div>
                        <div className="min-w-0"><span className="block text-[10px] font-bold uppercase text-slate-500">Responsável</span><p className="font-semibold text-slate-800 break-words">{plan.responsible?.name || 'Não atribuído'}</p></div>
                        <div><span className="block text-[10px] font-bold uppercase text-slate-500">Prazo final</span><p className="font-semibold text-slate-800">{plan.dueDate ? new Date(plan.dueDate).toLocaleDateString('pt-BR') : 'Não definido'}</p></div>
                        <div><span className="block text-[10px] font-bold uppercase text-slate-500">Situação</span>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${deadline.colorClass.bg} ${deadline.colorClass.text} ${deadline.colorClass.border}`}>{deadline.label}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600" aria-label={`Progresso: ${progress}%`}>
                          <span className="text-[10px] font-bold text-slate-500">Progresso</span>
                          <div className="w-20 h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                          <strong>{progress}%</strong>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <button type="button" onClick={async () => {
                            try {
                              const res = await fetch(`/api/planos-de-acao/${plan.id}`);
                              const data = await res.json();
                              generateActionPlanIndividualPdf(data.success && data.plan ? data.plan : plan);
                            } catch { generateActionPlanIndividualPdf(plan); }
                          }} className="p-2 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" title="Baixar PDF" aria-label={`Baixar PDF do plano ${plan.code}`}><FileText size={16}/></button>
                          <button type="button" onClick={() => handleOpenDetails(plan)} className="p-2 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50" title="Visualizar" aria-label={`Visualizar plano ${plan.code}`}><Eye size={16}/></button>
                          <button type="button" onClick={() => { setEditingPlan(plan); setIsCreateModalOpen(true); }} className="p-2 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50" title="Editar" aria-label={`Editar plano ${plan.code}`}><Edit3 size={16}/></button>
                          {plan.status !== 'CANCELLED' && <button type="button" disabled={deletingPlanId !== null} onClick={() => handleDeletePlan(plan)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40" title={canPermanentlyDelete ? 'Excluir plano permanentemente' : 'Cancelar plano (mantém histórico)'} aria-label={`${canPermanentlyDelete ? 'Excluir' : 'Cancelar'} plano ${plan.code}`}>
                            {deletingPlanId === plan.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16}/>}
                          </button>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>Total de {totalCount} planos cadastrados</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-2 font-bold">Página {page} de {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. VISUALIZAÇÃO: KANBAN */}
        {activeMode === 'KANBAN' && (
          <ActionPlanKanban
            plans={plans}
            onSelectPlan={handleOpenDetails}
            onUpdateStatus={handleUpdatePlanStatus}
          />
        )}

        {/* 4. VISUALIZAÇÃO: CALENDÁRIO */}
        {activeMode === 'CALENDAR' && (
          <ActionPlanCalendar
            plans={plans}
            onSelectPlan={handleOpenDetails}
          />
        )}
      </div>

      {/* Modal de Criação / Edição de Plano de Ação */}
      <ActionPlanModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingPlan(null);
        }}
        onSuccess={() => {
          loadPlans();
          loadMetrics();
        }}
        planToEdit={editingPlan}
      />

      {/* Modal de Detalhes Completos do Plano de Ação */}
      <ActionPlanDetailsModal
        planId={selectedPlanId}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedPlanId(null);
        }}
        onPlanUpdated={() => {
          loadPlans();
          loadMetrics();
        }}
        onEditPlan={(plan) => {
          setEditingPlan(plan);
          setIsCreateModalOpen(true);
        }}
      />
    </AppShell>
  );
}

export default function PlanosDeAcaoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    }>
      <PlanosDeAcaoContent />
    </Suspense>
  );
}
