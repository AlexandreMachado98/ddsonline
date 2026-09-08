'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, UploadCloud, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';
import { getPendingAttendances, syncOfflineQueue, OfflineAttendance } from '@/lib/offlineStorage';

interface OfflineSyncBadgeProps {
  meetingId?: string;
  onSyncComplete?: (count: number) => void;
  className?: string;
}

export default function OfflineSyncBadge({
  meetingId,
  onSyncComplete,
  className = ''
}: OfflineSyncBadgeProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncSuccess, setLastSyncSuccess] = useState<number | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingAttendances(meetingId);
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, [meetingId]);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);

    try {
      const res = await syncOfflineQueue(meetingId);
      if (res.success > 0) {
        setLastSyncSuccess(res.success);
        setTimeout(() => setLastSyncSuccess(null), 5000);
        if (onSyncComplete) {
          onSyncComplete(res.success);
        }
      }
      await refreshPendingCount();
    } catch (e) {
      console.error('Erro na sincronização de presenças offline:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [meetingId, isSyncing, onSyncComplete, refreshPendingCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Checagem periódica a cada 10s
    const interval = setInterval(() => {
      setIsOnline(navigator.onLine);
      refreshPendingCount();
      if (navigator.onLine && pendingCount > 0 && !isSyncing) {
        triggerSync();
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [pendingCount, isSyncing, triggerSync, refreshPendingCount]);

  if (isOnline && pendingCount === 0 && !lastSyncSuccess) {
    return null;
  }

  return (
    <div className={`w-full transition-all duration-300 animate-in fade-in ${className}`}>
      {/* Aviso quando Offline */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-500/40 p-3 sm:p-3.5 rounded-2xl flex items-center justify-between gap-2.5 text-amber-200 text-xs shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <WifiOff size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-white text-xs">Modo Campo (Offline)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Sem Internet
                </span>
              </div>
              <p className="text-[11px] text-amber-300/80 mt-0.5 truncate">
                {pendingCount > 0 
                  ? `${pendingCount} ${pendingCount === 1 ? 'presença salva' : 'presenças salvas'} na memória do aparelho.` 
                  : 'Coleta de assinaturas liberada. Os dados serão guardados no celular.'}
              </p>
            </div>
          </div>

          {pendingCount > 0 && (
            <span className="text-xs font-black px-2.5 py-1 bg-amber-500 text-slate-950 rounded-xl shrink-0 shadow-md">
              {pendingCount}
            </span>
          )}
        </div>
      )}

      {/* Aviso quando Online mas com presenças pendentes */}
      {isOnline && pendingCount > 0 && (
        <div className="bg-gradient-to-r from-emerald-950/90 to-teal-950/90 border border-emerald-500/50 p-3 sm:p-3.5 rounded-2xl flex items-center justify-between gap-2.5 text-emerald-200 text-xs shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <UploadCloud size={16} className={isSyncing ? "animate-bounce" : ""} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-white text-xs">Internet Reconectada!</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-300/80 mt-0.5 truncate">
                {isSyncing ? 'Sincronizando presenças com o banco...' : 'Pronto para enviar presenças para a nuvem.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={triggerSync}
            disabled={isSyncing}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 min-h-[38px]"
          >
            {isSyncing ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <RefreshCw size={13} />
                <span>Sincronizar</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Notificação Temporária de Sucesso após Sincronização */}
      {lastSyncSuccess && lastSyncSuccess > 0 && (
        <div className="bg-emerald-900/80 border border-emerald-500/40 p-2.5 rounded-2xl flex items-center gap-2 text-emerald-200 text-xs shadow-md">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>✓ {lastSyncSuccess} {lastSyncSuccess === 1 ? 'presença sincronizada' : 'presenças sincronizadas'} com o banco de dados!</span>
        </div>
      )}
    </div>
  );
}
