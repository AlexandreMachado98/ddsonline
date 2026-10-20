import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'emerald' | 'blue' | 'amber' | 'navy';
  trend?: {
    value: string;
    isPositive: boolean;
    label?: string;
  };
  className?: string;
  onClick?: () => void;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  className = '',
  onClick
}: MetricCardProps) {
  const variantStyles = {
    default: {
      bg: 'bg-white',
      border: 'border-slate-200/80 hover:border-slate-300',
      iconBg: 'bg-slate-100 text-slate-700',
      valueColor: 'text-[#0F1F38]'
    },
    emerald: {
      bg: 'bg-emerald-50/40',
      border: 'border-emerald-200/80 hover:border-emerald-300',
      iconBg: 'bg-emerald-100 text-emerald-700',
      valueColor: 'text-emerald-950'
    },
    blue: {
      bg: 'bg-blue-50/40',
      border: 'border-blue-200/80 hover:border-blue-300',
      iconBg: 'bg-blue-100 text-blue-700',
      valueColor: 'text-blue-950'
    },
    amber: {
      bg: 'bg-amber-50/40',
      border: 'border-amber-200/80 hover:border-amber-300',
      iconBg: 'bg-amber-100 text-amber-700',
      valueColor: 'text-amber-950'
    },
    navy: {
      bg: 'bg-slate-900 text-white',
      border: 'border-slate-800 hover:border-slate-700',
      iconBg: 'bg-white/10 text-emerald-400',
      valueColor: 'text-white'
    }
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 shadow-sm ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      } ${style.bg} ${style.border} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 block">
            {title}
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black tracking-tight ${style.valueColor}`}>
              {value}
            </span>
            {subtitle && (
              <span className="text-xs text-slate-500 font-medium">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {Icon && (
          <div className={`p-2.5 rounded-xl shrink-0 ${style.iconBg}`}>
            <Icon size={20} />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs">
          <span
            className={`font-bold ${
              trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
          {trend.label && (
            <span className="text-slate-400 text-[11px]">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
