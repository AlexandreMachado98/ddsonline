'use client';

import React, { useState } from 'react';
import { RefreshCw, Trash2, Zap } from 'lucide-react';

export async function forceClearAppCache() {
  try {
    // 1. Desregistra todos os Service Workers ativos
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // 2. Limpa o Cache Storage da API de Caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }

    // 3. Remove chaves temporárias corrompidas do localStorage (preservando login)
    const preservedAuth = localStorage.getItem('dds_admin_auth');
    const preservedProfile = localStorage.getItem('dds_organizer_profile');
    
    sessionStorage.clear();

    if (preservedAuth) localStorage.setItem('dds_admin_auth', preservedAuth);
    if (preservedProfile) localStorage.setItem('dds_organizer_profile', preservedProfile);

    // 4. Força o recarregamento com timestamp único para ignorar qualquer cache HTTP
    const cleanUrl = window.location.href.split('?')[0];
    window.location.href = `${cleanUrl}?v=${Date.now()}`;
  } catch (err) {
    console.error('Erro ao limpar cache:', err);
    window.location.reload();
  }
}

export default function CacheBusterButton({ className = '' }: { className?: string }) {
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    await forceClearAppCache();
  };

  return (
    <button
      onClick={handleClear}
      disabled={clearing}
      title="Limpar arquivos temporários, resetar WebRTC e forçar atualização"
      className={`px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${className}`}
    >
      <Zap size={13} className={clearing ? 'animate-spin text-amber-400' : 'text-amber-400'} />
      <span>{clearing ? 'Limpando...' : 'Forçar Atualização'}</span>
    </button>
  );
}
