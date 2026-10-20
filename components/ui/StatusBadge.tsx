import React from 'react';

export type StatusType = 
  | 'LIVE' 
  | 'ENDED' 
  | 'DRAFT' 
  | 'PUBLISHED' 
  | 'CLOSED' 
  | 'PASSED' 
  | 'FAILED'
  | 'PRESENTIAL'
  | 'REMOTE'
  | 'TRAINING'
  | 'CAMPAIGN'
  | 'DDS';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StatusBadge({
  status,
  label,
  size = 'md',
  className = ''
}: StatusBadgeProps) {
  const normalized = (status || '').toUpperCase();

  const config: Record<string, { bg: string; text: string; border: string; defaultLabel: string; dot?: string }> = {
    LIVE: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      defaultLabel: 'Ao Vivo',
      dot: 'bg-emerald-500 animate-pulse'
    },
    ENDED: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200',
      defaultLabel: 'Encerrado'
    },
    PUBLISHED: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      defaultLabel: 'Publicado',
      dot: 'bg-blue-500'
    },
    DRAFT: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      defaultLabel: 'Rascunho'
    },
    CLOSED: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      defaultLabel: 'Finalizado'
    },
    PASSED: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      defaultLabel: 'Aprovado'
    },
    FAILED: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      defaultLabel: 'Insuficiente'
    },
    PRESENTIAL: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      defaultLabel: 'Presencial'
    },
    REMOTE: {
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200',
      defaultLabel: 'Remoto'
    },
    TRAINING: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      defaultLabel: 'Treinamento'
    },
    CAMPAIGN: {
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      border: 'border-teal-200',
      defaultLabel: 'Campanha'
    },
    DDS: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      defaultLabel: 'DDS'
    }
  };

  const item = config[normalized] || {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    defaultLabel: status || 'Desconhecido'
  };

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-2 py-0.5 gap-1 font-semibold'
    : 'text-xs px-2.5 py-1 gap-1.5 font-bold';

  return (
    <span
      className={`inline-flex items-center rounded-lg border uppercase tracking-wider ${sizeClasses} ${item.bg} ${item.text} ${item.border} ${className}`}
    >
      {item.dot && <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />}
      {label || item.defaultLabel}
    </span>
  );
}
