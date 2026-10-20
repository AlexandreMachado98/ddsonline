import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export default function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className = ''
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-slate-400 mb-4">
        <Icon size={24} />
      </div>

      <h3 className="text-sm sm:text-base font-bold text-slate-800">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer"
        >
          {ActionIcon && <ActionIcon size={16} />}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
}
