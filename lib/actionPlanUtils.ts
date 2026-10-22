// lib/actionPlanUtils.ts
// Módulo de Inteligência de Negócios, Prazos e Máquina de Estados dos Planos de Ação

export type ActionPlanStatus = 
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'AWAITING_VALIDATION'
  | 'COMPLETED'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'REOPENED';

export type ActionPlanPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ActionPlanCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type ActionPlanOrigin = 
  | 'DDS'
  | 'INSPECTION'
  | 'AUDIT'
  | 'NON_CONFORMITY'
  | 'INCIDENT'
  | 'ACCIDENT'
  | 'PREVENTIVE_OBSERVATION'
  | 'QUESTIONNAIRE'
  | 'OTHER';
export type VerificationResult = 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'PENDING';

export type DeadlineState = 
  | 'IN_TIME'
  | 'NEAR_DUE'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'COMPLETED_ON_TIME'
  | 'COMPLETED_LATE';

// Máquina de Estados Oficial
export const VALID_STATUS_TRANSITIONS: Record<ActionPlanStatus, ActionPlanStatus[]> = {
  OPEN: ['IN_PROGRESS', 'SUSPENDED', 'CANCELLED'],
  IN_PROGRESS: ['AWAITING_VALIDATION', 'SUSPENDED', 'CANCELLED'],
  AWAITING_VALIDATION: ['COMPLETED', 'IN_PROGRESS'], // IN_PROGRESS = devolvido para correção
  COMPLETED: ['REOPENED'],
  SUSPENDED: ['OPEN', 'IN_PROGRESS', 'CANCELLED'],
  REOPENED: ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [] // Terminal
};

/**
 * Valida se uma transição de status é permitida pelo fluxo operacional
 */
export function canTransitionStatus(currentStatus: ActionPlanStatus, newStatus: ActionPlanStatus): boolean {
  if (currentStatus === newStatus) return true;
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

/**
 * Avalia a situação exata do prazo de um plano ou tarefa
 * Distingue status operacional de situação de calendário.
 */
export function calculateDeadlineState(
  dueDate: string | Date | null | undefined,
  completedAt: string | Date | null | undefined,
  status: ActionPlanStatus,
  alertDaysBefore: number = 7
): {
  state: DeadlineState;
  label: string;
  daysRemaining: number;
  isOverdue: boolean;
  colorClass: { bg: string; text: string; border: string; dot?: string };
} {
  // Se concluído, avalia se concluiu dentro do prazo original/prorrogado
  if (status === 'COMPLETED' && completedAt && dueDate) {
    const compDate = new Date(completedAt).getTime();
    const dDate = new Date(dueDate).getTime();
    const isLate = compDate > dDate;

    return isLate
      ? {
          state: 'COMPLETED_LATE',
          label: 'Concluído com Atraso',
          daysRemaining: 0,
          isOverdue: false,
          colorClass: {
            bg: 'bg-amber-50',
            text: 'text-amber-800',
            border: 'border-amber-300'
          }
        }
      : {
          state: 'COMPLETED_ON_TIME',
          label: 'Concluído no Prazo',
          daysRemaining: 0,
          isOverdue: false,
          colorClass: {
            bg: 'bg-emerald-50',
            text: 'text-emerald-800',
            border: 'border-emerald-300',
            dot: 'bg-emerald-500'
          }
        };
  }

  if (status === 'COMPLETED') {
    return {
      state: 'COMPLETED_ON_TIME',
      label: 'Concluído',
      daysRemaining: 0,
      isOverdue: false,
      colorClass: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-300'
      }
    };
  }

  if (status === 'CANCELLED') {
    return {
      state: 'IN_TIME',
      label: 'Cancelado',
      daysRemaining: 0,
      isOverdue: false,
      colorClass: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200'
      }
    };
  }

  if (!dueDate) {
    return {
      state: 'IN_TIME',
      label: 'Sem Prazo Definido',
      daysRemaining: 999,
      isOverdue: false,
      colorClass: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200'
      }
    };
  }

  const now = new Date();
  const due = new Date(dueDate);

  // Normaliza para início do dia para cálculo de dias
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();

  const diffMs = dueDateOnly - nowDateOnly;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      state: 'OVERDUE',
      label: `Vencido há ${Math.abs(diffDays)} dia(s)`,
      daysRemaining: diffDays,
      isOverdue: true,
      colorClass: {
        bg: 'bg-rose-50',
        text: 'text-rose-700 font-bold',
        border: 'border-rose-300',
        dot: 'bg-rose-600 animate-pulse'
      }
    };
  }

  if (diffDays === 0) {
    return {
      state: 'DUE_TODAY',
      label: 'Vence Hoje',
      daysRemaining: 0,
      isOverdue: false,
      colorClass: {
        bg: 'bg-amber-100',
        text: 'text-amber-900 font-bold',
        border: 'border-amber-400',
        dot: 'bg-amber-500 animate-ping'
      }
    };
  }

  if (diffDays <= alertDaysBefore) {
    return {
      state: 'NEAR_DUE',
      label: `Vence em ${diffDays} dia(s)`,
      daysRemaining: diffDays,
      isOverdue: false,
      colorClass: {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        dot: 'bg-amber-400'
      }
    };
  }

  return {
    state: 'IN_TIME',
    label: `No Prazo (${diffDays} dias)`,
    daysRemaining: diffDays,
    isOverdue: false,
    colorClass: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200'
    }
  };
}

/**
 * Calcula o progresso ponderado de um plano de ação a partir de suas tarefas/subações.
 * Se nenhuma tarefa estiver cadastrada, o progresso é 100% se COMPLETED, ou 0% caso contrário.
 */
export function calculatePlanProgress(tasks: Array<{ status: string; weight?: number }>, planStatus?: ActionPlanStatus): number {
  if (!tasks || tasks.length === 0) {
    return planStatus === 'COMPLETED' ? 100 : planStatus === 'IN_PROGRESS' ? 30 : 0;
  }

  let totalWeight = 0;
  let completedWeight = 0;

  for (const t of tasks) {
    const weight = t.weight && t.weight > 0 ? t.weight : 1;
    totalWeight += weight;
    if (t.status === 'COMPLETED') {
      completedWeight += weight;
    } else if (t.status === 'IN_PROGRESS' || t.status === 'AWAITING_VALIDATION') {
      completedWeight += weight * 0.5; // Crédito proporcional para etapas em andamento
    }
  }

  if (totalWeight === 0) return 0;
  return Math.min(100, Math.round((completedWeight / totalWeight) * 100));
}

/**
 * Gera código automático sequencial formatado no padrão:
 * PA-YYYYMMDD-0001
 */
export function formatActionPlanCode(date: Date, sequenceNumber: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const seq = String(sequenceNumber).padStart(4, '0');
  return `PA-${y}${m}${d}-${seq}`;
}

/**
 * Labels amigáveis para Enums
 */
export const STATUS_LABELS: Record<ActionPlanStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em Andamento',
  AWAITING_VALIDATION: 'Aguardando Validação',
  COMPLETED: 'Concluído',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
  REOPENED: 'Reaberto'
};

export const PRIORITY_LABELS: Record<ActionPlanPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica'
};

export const CRITICALITY_LABELS: Record<ActionPlanCriticality, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  VERY_HIGH: 'Muito Alta / Iminente'
};

export const ORIGIN_LABELS: Record<string, string> = {
  DDS: 'DDS (Diálogo Diário de Segurança)',
  INSPECTION: 'Inspeção de Segurança',
  AUDIT: 'Auditoria de Processo / NR',
  NON_CONFORMITY: 'Não Conformidade (RNC)',
  INCIDENT: 'Incidente / Quase Acidente',
  ACCIDENT: 'Acidente de Trabalho',
  PREVENTIVE_OBSERVATION: 'Observação Preventiva',
  QUESTIONNAIRE: 'Avaliação / Questionário',
  OTHER: 'Outro'
};

export const VERIFICATION_LABELS: Record<VerificationResult, string> = {
  EFFECTIVE: 'Eficaz',
  PARTIALLY_EFFECTIVE: 'Parcialmente Eficaz',
  INEFFECTIVE: 'Ineficaz (Requer Nova Ação)',
  PENDING: 'Pendente de Verificação'
};
