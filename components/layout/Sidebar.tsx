'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, FileText, PlusCircle, Award, 
  Trophy, BookOpen, BarChart3, User, LogOut, 
  ChevronRight, Shield, X
} from 'lucide-react';
import DdsLogo from '@/components/DdsLogo';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile?: () => void;
}

export default function Sidebar({ isOpen, onClose, onOpenProfile }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const action = searchParams.get('action');
  const view = searchParams.get('view');
  const { user, logout } = useAuth();

  const isPainelGeral = pathname === '/admin' && !action && !view && !currentTab;
  const isNovoDds = pathname === '/admin' && action === 'new';
  const isHistorico = pathname === '/admin' && view === 'history';

  const navGroups = [
    {
      label: 'PRINCIPAL',
      items: [
        {
          label: 'Painel Geral',
          href: '/admin',
          icon: LayoutDashboard,
          active: isPainelGeral
        },
        {
          label: 'Novo DDS',
          href: '/admin?action=new',
          icon: PlusCircle,
          active: isNovoDds
        },
        {
          label: 'Histórico & Atas',
          href: '/admin?view=history',
          icon: FileText,
          active: isHistorico
        }
      ]
    },
    {
      label: 'AVALIAÇÕES & DESEMPENHO',
      items: [
        {
          label: 'Questionários',
          href: '/admin/questionarios?tab=QUIZZES',
          icon: Award,
          active: pathname === '/admin/questionarios' && (currentTab === 'QUIZZES' || !currentTab)
        },
        {
          label: 'Ranking & Pódio',
          href: '/admin/questionarios?tab=RANKING',
          icon: Trophy,
          badge: 'Live',
          active: pathname === '/admin/questionarios' && currentTab === 'RANKING'
        },
        {
          label: 'Banco de Modelos NR',
          href: '/admin/questionarios?tab=TEMPLATES',
          icon: BookOpen,
          active: pathname === '/admin/questionarios' && currentTab === 'TEMPLATES'
        }
      ]
    },
    {
      label: 'GESTÃO & INDICADORES',
      items: [
        {
          label: 'BI & Analytics SST',
          href: '/admin/questionarios?tab=BI',
          icon: BarChart3,
          active: pathname === '/admin/questionarios' && currentTab === 'BI'
        }
      ]
    }
  ];

  return (
    <>
      {/* Backdrop para mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Container da Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0F1F38] text-white flex flex-col border-r border-slate-800/80 shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Branding Oficial DDS ON */}
        <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between">
          <div onClick={onClose}>
            <DdsLogo size="sm" showSubtitle={false} clickable href="/admin" />
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 lg:hidden"
            title="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              <h4 className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                {group.label}
              </h4>
              <div className="space-y-0.5 mt-1.5">
                {group.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={itemIdx}
                      href={item.href}
                      onClick={onClose}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                        item.active
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          size={17}
                          className={
                            item.active
                              ? 'text-white'
                              : 'text-slate-400 group-hover:text-emerald-400 transition-colors'
                          }
                        />
                        <span>{item.label}</span>
                      </div>

                      {item.badge && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card & Logout Bottom */}
        <div className="p-3 border-t border-white/10 bg-black/20">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenProfile?.();
              }}
              className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 transition-opacity cursor-pointer flex-1"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : <User size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {user?.name || 'Gestor SST'}
                </p>
                <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                  {user?.company || 'DDS ON Corporativo'}
                </p>
              </div>
            </button>

            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
              title="Encerrar Sessão"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
