'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import WeeklyDdsManager from '@/components/WeeklyDdsManager';

function WeeklyDdsPageContent() {
  return (
    <AppShell breadcrumbs={[{ label: 'Painel Geral', href: '/admin' }, { label: 'DDS Semanal' }]}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">DDS Semanal</h1>
          <p className="text-sm text-slate-500">Programe os temas da semana e divulgue um único link para a equipe.</p>
        </div>
        <WeeklyDdsManager />
      </div>
    </AppShell>
  );
}

// Next.js 14 requires Suspense around clients that can reach useSearchParams
// through nested layout components (AppShell / Sidebar).
export default function WeeklyDdsPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#F5F7FB] p-8 text-sm text-slate-600" role="status">Carregando DDS Semanal...</div>}>
      <WeeklyDdsPageContent />
    </React.Suspense>
  );
}
