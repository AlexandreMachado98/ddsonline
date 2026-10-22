'use client';

import React from 'react';
import { 
  Clock, AlertTriangle, User, CheckCircle2, 
  ArrowRight, CheckSquare, Eye
} from 'lucide-react';
import { 
  calculateDeadlineState, 
  calculatePlanProgress,
  PRIORITY_LABELS,
  ActionPlanStatus 
} from '@/lib/actionPlanUtils';

interface ActionPlanKanbanProps {
  plans: any[];
  onSelectPlan: (plan: any) => void;
  onUpdateStatus: (planId: string, newStatus: ActionPlanStatus) => void;
}

export default function ActionPlanKanban({
  plans,
  onSelectPlan,
  onUpdateStatus
}: ActionPlanKanbanProps) {
  const columns: Array<{ id: ActionPlanStatus; title: string; color: string; bg: string }> = [
    { id: 'OPEN', title: '1. Aberto', color: 'text-slate-700', bg: 'bg-slate-100' },
    { id: 'IN_PROGRESS', title: '2. Em Andamento', color: 'text-blue-700', bg: 'bg-blue-100' },
    { id: 'AWAITING_VALIDATION', title: '3. Aguardando Validação', color: 'text-amber-700', bg: 'bg-amber-100' },
    { id: 'COMPLETED', title: '4. Concluído', color: 'text-emerald-700', bg: 'bg-emerald-100' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {columns.map(col => {
        const colPlans = plans.filter(p => {
          if (col.id === 'IN_PROGRESS') return p.status === 'IN_PROGRESS' || p.status === 'REOPENED';
          return p.status === col.id;
        });

        return (
          <div key={col.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-3 flex flex-col min-h-[500px]">
            {/* Header da Coluna */}
            <div className="flex items-center justify-between px-2 pt-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.bg.replace('100', '500')}`} />
                <h3 className={`text-xs font-black uppercase tracking-wider ${col.color}`}>
                  {col.title}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white border border-slate-200 text-slate-700 shadow-2xs">
                {colPlans.length}
              </span>
            </div>

            {/* Lista de Cards */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[75vh] pr-1">
              {colPlans.map(plan => {
                const deadline = calculateDeadlineState(plan.dueDate, plan.completedAt, plan.status, plan.alertDaysBefore || 7);
                const progress = calculatePlanProgress(plan.tasks || [], plan.status);

                return (
                  <div
                    key={plan.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition-all space-y-2.5 cursor-pointer group"
                    onClick={() => onSelectPlan(plan)}
                  >
                    {/* Código e Prioridade */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {plan.code}
                      </span>
                      <span className={`text-[10px] font-bold uppercase ${
                        plan.priority === 'CRITICAL' ? 'text-rose-600' : plan.priority === 'HIGH' ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        {PRIORITY_LABELS[plan.priority as keyof typeof PRIORITY_LABELS] || plan.priority}
                      </span>
                    </div>

                    {/* Título */}
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {plan.title}
                    </h4>

                    {/* Situação do Prazo e Responsável */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100 text-[11px]">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="flex items-center gap-1 truncate max-w-[140px]">
                          <User size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{plan.responsible?.name || 'Não atribuído'}</span>
                        </span>
                        <span>{plan.dueDate ? new Date(plan.dueDate).toLocaleDateString('pt-BR') : '-'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${deadline.colorClass.bg} ${deadline.colorClass.text} ${deadline.colorClass.border}`}>
                          {deadline.label}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700">{progress}%</span>
                      </div>

                      {/* Mini barra de progresso */}
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {/* Botões Rápidos de Avanço */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectPlan(plan)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                      >
                        <Eye size={12} />
                        <span>Ver detalhes</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {col.id === 'OPEN' && (
                          <button
                            onClick={() => onUpdateStatus(plan.id, 'IN_PROGRESS')}
                            className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-700"
                            title="Iniciar Execução"
                          >
                            Iniciar →
                          </button>
                        )}

                        {col.id === 'IN_PROGRESS' && (
                          <button
                            onClick={() => onUpdateStatus(plan.id, 'AWAITING_VALIDATION')}
                            className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[10px] hover:bg-amber-700"
                            title="Enviar para Validação"
                          >
                            Concluir →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {colPlans.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Nenhum plano nesta coluna
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
