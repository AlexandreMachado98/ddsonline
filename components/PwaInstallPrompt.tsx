'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, X } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Se já estiver instalado como app independente, não mostra o banner
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowBanner(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] max-w-md mx-auto bg-gradient-to-r from-green-600 via-emerald-600 to-slate-900 text-white p-4 rounded-3xl shadow-2xl border border-green-400/40 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-white/20 rounded-2xl">
          <Smartphone size={22} className="animate-pulse text-green-300" />
        </div>
        <div>
          <p className="text-xs font-bold text-white">Instalar o App DDS ON</p>
          <p className="text-[10px] text-green-100">Adicione à tela inicial para acesso rápido</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all"
        >
          Instalar
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="p-1.5 text-slate-300 hover:text-white rounded-lg"
          title="Fechar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}