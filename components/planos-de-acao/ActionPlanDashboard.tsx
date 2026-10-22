'use client';

import React from 'react';
import { 
  CheckCircle2, Clock, AlertTriangle, ShieldAlert, 
  BarChart3, User, TrendingUp, Calendar, Target,
  FileCheck2, ArrowUpRight
} from 'lucide-react';
import MetricCard from '@/components/ui/MetricCard';

interface DashboardMetrics {
  total: number;
  open: number;
  inProgress: number;
  awaitingValidation: number;
  completed: number;
  suspended: number;
  cancelled: number;
  overdue: number;
  nearDue: number;
  completedOnTime: number;
  completedLate: number;
  completionRate: number;
  onTimeRate: number;
  avgResolutionDays: number;
  byPriority: Record<string, number>;
  byCriticality: Record<string, number>;
  byResponsible: Array<{ id: string; name: string; total: number; completed: number; overdue: number }>;
  monthlyEvolution: Array<{ month: string; created: number; completed: number }>;
}

interface ActionPlanDashboardProps {
  metrics: DashboardMetrics | null;
  onFilterStatus?: (status: string) => void;
}

export default function ActionPlanDashboard({
  metrics,
  onFilterStatus
}: ActionPlanDashboardProps) {
  if (!metrics) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Grid Principal de Indicadores Chave */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <MetricCard
          title="Total Cadastrado"
          value={metrics.total}
          subtitle="Planos de Ação"
          variant="default"
          onClick={() => onFilterStatus?.('ALL')}
        />

        <MetricCard
          title="Em Andamento"
          value={metrics.inProgress}
          subtitle="Em execução"
          variant="blue"
          onClick={() => onFilterStatus?.('IN_PROGRESS')}
        />

        <MetricCard
          title="Aguardando Validação"
          value={metrics.awaitingValidation}
          subtitle="Para verificar"
          variant="amber"
          onClick={() => onFilterStatus?.('AWAITING_VALIDATION')}
        />

        <MetricCard
          title="Vencidos"
          value={metrics.overdue}
          subtitle="Atenção imediata"
          className="border-rose-200 bg-rose-50/40 text-rose-950"
          onClick={() => onFilterStatus?.('OVERDUE')}
        />

        <MetricCard
          title="Próximos do Vencimento"
          value={metrics.nearDue}
          subtitle="Alerta ativo"
          variant="amber"
        />

        <MetricCard
          title="Concluídos"
          value={metrics.completed}
          subtitle={`${metrics.completionRate}% do total`}
          variant="emerald"
          onClick={() => onFilterStatus?.('COMPLETED')}
        />
      </div>

      {/* 2. Destaques de Performance Operacional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Taxa de Conclusão no Prazo</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{metrics.onTimeRate}%</span>
            <span className="text-xs text-slate-500 font-medium">dos planos concluídos</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${metrics.onTimeRate}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics.completedOnTime} no prazo de {metrics.completed} finalizados
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Tempo Médio de Conclusão</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{metrics.avgResolutionDays}</span>
            <span className="text-xs text-slate-500 font-medium">dias corridos</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Média da identificação até a conclusão efetiva com validação SST.
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Distribuição por Criticidade</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-100">
              <span className="text-[10px] font-bold uppercase text-rose-800 block">Muito Alta</span>
              <span className="text-lg font-black text-rose-900">{metrics.byCriticality.VERY_HIGH || 0}</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
              <span className="text-[10px] font-bold uppercase text-amber-800 block">Alta</span>
              <span className="text-lg font-black text-amber-900">{metrics.byCriticality.HIGH || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Gráficos e Desempenho por Responsável */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução Mensal */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-600" />
              <span>Evolução Mensal (Criados vs Concluídos)</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-400">Últimos meses</span>
          </div>

          <div className="space-y-3 pt-2">
            {metrics.monthlyEvolution.map((m, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{m.month}</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-blue-600 font-bold">{m.created} criados</span>
                    <span className="text-emerald-600 font-bold">{m.completed} concluídos</span>
                  </div>
                </div>

                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 gap-1">
                  <div 
                    className="bg-blue-500 rounded-full transition-all" 
                    style={{ width: `${metrics.total > 0 ? (m.created / metrics.total) * 100 : 0}%` }} 
                  />
                  <div 
                    className="bg-emerald-500 rounded-full transition-all" 
                    style={{ width: `${metrics.total > 0 ? (m.completed / metrics.total) * 100 : 0}%` }} 
                  />
                </div>
              </div>
            ))}

            {metrics.monthlyEvolution.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                Aguardando acúmulo de dados históricos
              </div>
            )}
          </div>
        </div>

        {/* Desempenho por Responsável */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
              <User size={16} className="text-blue-600" />
              <span>Desempenho por Responsável</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-400">Volume & Conclusão</span>
          </div>

          <div className="space-y-2.5 pt-2">
            {metrics.byResponsible.map(resp => {
              const rate = resp.total > 0 ? Math.round((resp.completed / resp.total) * 100) : 0;
              return (
                <div key={resp.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 truncate">{resp.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>Total: {resp.total}</span>
                      <span>• Concluídos: {resp.completed}</span>
                      {resp.overdue > 0 && (
                        <span className="text-rose-600 font-bold">• Vencidos: {resp.overdue}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-emerald-700">{rate}%</span>
                    <span className="text-[10px] text-slate-400 block">taxa</span>
                  </div>
                </div>
              );
            })}

            {metrics.byResponsible.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                Nenhum responsável com planos atribuídos
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
