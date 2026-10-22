'use client';

import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  User, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { calculateDeadlineState, ActionPlanStatus } from '@/lib/actionPlanUtils';

interface ActionPlanCalendarProps {
  plans: any[];
  onSelectPlan: (plan: any) => void;
}

export default function ActionPlanCalendar({
  plans,
  onSelectPlan
}: ActionPlanCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Dias do mês
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Mapeia planos por dia do vencimento no mês atual
  const plansByDay: Record<number, any[]> = {};
  plans.forEach(p => {
    if (p.dueDate) {
      const d = new Date(p.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!plansByDay[day]) plansByDay[day] = [];
        plansByDay[day].push(p);
      }
    }
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm space-y-4 p-4 sm:p-5">
      {/* Controles de Mês */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-blue-600" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            {monthNames[month]} de {year}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Hoje
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Grade do Calendário */}
      <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200 text-center">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
          <div key={idx} className="bg-slate-50 py-2 text-[11px] font-black uppercase text-slate-500">
            {day}
          </div>
        ))}

        {/* Células vazias do início do mês */}
        {Array.from({ length: firstDayIndex }).map((_, idx) => (
          <div key={`empty-${idx}`} className="bg-slate-50/50 min-h-[90px] p-1" />
        ))}

        {/* Dias do mês */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const dayPlans = plansByDay[day] || [];
          const isToday = 
            new Date().getDate() === day && 
            new Date().getMonth() === month && 
            new Date().getFullYear() === year;

          return (
            <div
              key={`day-${day}`}
              className={`bg-white min-h-[95px] p-1.5 flex flex-col justify-start text-left transition-colors hover:bg-blue-50/20 ${
                isToday ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/10' : ''
              }`}
            >
              <span className={`text-[11px] font-bold inline-block px-1.5 py-0.5 rounded-full ${
                isToday ? 'bg-blue-600 text-white w-fit' : 'text-slate-700'
              }`}>
                {day}
              </span>

              {/* Lista compacta de planos com vencimento neste dia */}
              <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[80px]">
                {dayPlans.map(p => {
                  const deadline = calculateDeadlineState(p.dueDate, p.completedAt, p.status, p.alertDaysBefore || 7);
                  return (
                    <div
                      key={p.id}
                      onClick={() => onSelectPlan(p)}
                      className={`px-1.5 py-1 rounded text-[10px] font-bold truncate cursor-pointer transition-all border ${
                        p.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : deadline.isOverdue
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}
                      title={`${p.code}: ${p.title}`}
                    >
                      {p.code} - {p.title}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
