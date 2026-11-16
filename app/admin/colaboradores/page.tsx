'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import CollaboratorManager from '@/components/CollaboratorManager';

function CollaboratorsPageContent() {
  return (
    <AppShell breadcrumbs={[{ label: 'Gestão', href: '/admin' }, { label: 'Colaboradores' }]}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Colaboradores</h1>
          <p className="text-sm text-slate-500">Cadastre matrícula, nome e função. Na assinatura, o colaborador digita só a matrícula.</p>
        </div>
        <CollaboratorManager />
      </div>
    </AppShell>
  );
}

// Next.js 14 requires Suspense around clients that can reach useSearchParams
// through nested layout components (AppShell / Sidebar).
export default function CollaboratorsPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#F5F7FB] p-8 text-sm text-slate-600" role="status">Carregando colaboradores...</div>}>
      <CollaboratorsPageContent />
    </React.Suspense>
  );
}
