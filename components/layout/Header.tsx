'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, ChevronRight, User, PlusCircle, Shield, Award, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  onToggleSidebar: () => void;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  onOpenProfile?: () => void;
}

export default function Header({
  onToggleSidebar,
  breadcrumbs = [{ label: 'Painel Geral' }],
  actions,
  onOpenProfile
}: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 transition-all shadow-sm">
      {/* Left: Mobile trigger & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden transition-colors"
          title="Abrir Menu de Navegação"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb contextual */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link
            href="/admin"
            className="hover:text-blue-600 transition-colors hidden sm:inline"
          >
            DDS ON
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight size={14} className="text-slate-300 hidden sm:inline" />
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-blue-600 transition-colors truncate max-w-[150px] sm:max-w-xs"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[#0F1F38] font-black truncate max-w-[180px] sm:max-w-md">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: Page Actions & User Profile Trigger */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {actions}

        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 p-1 sm:p-1.5 pl-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer group"
          title="Meu Perfil e Dados da Empresa"
        >
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-slate-800 leading-tight">
              {user?.name?.split(' ')[0] || 'Usuário'}
            </p>
            <p className="text-[10px] text-slate-400 font-medium leading-tight">
              {user?.company || 'Corporativo'}
            </p>
          </div>

          <div className="w-8 h-8 rounded-lg bg-[#0F1F38] text-white flex items-center justify-center font-black text-xs group-hover:bg-blue-600 transition-colors">
            {user?.name ? user.name.slice(0, 1).toUpperCase() : <User size={15} />}
          </div>
        </button>
      </div>
    </header>
  );
}
