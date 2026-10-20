'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import UserProfileModal from '@/components/UserProfileModal';
import { useAuth } from '@/context/AuthContext';

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
}

export default function AppShell({
  children,
  breadcrumbs,
  actions
}: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { user, updateUserLocal } = useAuth();

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#0F172A] flex flex-col antialiased">
      {/* Sidebar (Desktop fixa, Mobile gaveta) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Área Principal (deslocada à direita em desktop) */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
        <Header
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          breadcrumbs={breadcrumbs}
          actions={actions}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* Modal de Perfil e Empresa Global */}
      {user && (
        <UserProfileModal
          user={user}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onProfileUpdated={(updated) => updateUserLocal(updated)}
        />
      )}
    </div>
  );
}
