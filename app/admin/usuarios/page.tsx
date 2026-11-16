'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import CompanyUsersManager from '@/components/CompanyUsersManager';

function UsersPageContent() {
  return (
    <AppShell breadcrumbs={[{ label: 'Gestão', href: '/admin' }, { label: 'Usuários da empresa' }]}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Usuários da empresa</h1>
          <p className="text-sm text-slate-500">Quem tem acesso ao DDS ON da sua empresa. Novos cadastros sem a palavra-chave da empresa aguardam aprovação aqui.</p>
        </div>
        <CompanyUsersManager />
      </div>
    </AppShell>
  );
}

// Next.js 14 requires Suspense around clients that can reach useSearchParams
// through nested layout components (AppShell / Sidebar).
export default function UsersPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#F5F7FB] p-8 text-sm text-slate-600" role="status">Carregando usuários...</div>}>
      <UsersPageContent />
    </React.Suspense>
  );
}
