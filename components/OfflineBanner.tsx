'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white text-[11px] sm:text-xs font-bold py-2 px-3 sm:px-4 flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top duration-300 text-center leading-tight">
        <Wifi size={15} className="shrink-0" />
        <span className="break-words">Conexão restabelecida. Sincronizando dados...</span>
      </div>
    );
  }

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-[11px] sm:text-xs font-bold py-2 px-3 sm:px-4 flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top duration-300 text-center leading-tight">
      <WifiOff size={15} className="animate-pulse shrink-0" />
      <span className="break-words">Você está sem internet. O aplicativo tentará reconectar automaticamente.</span>
    </div>
  );
}
