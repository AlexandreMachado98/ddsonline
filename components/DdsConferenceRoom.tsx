 'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { Loader2, Video, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface DdsConferenceProps {
  roomName: string;
  userName: string;
  isAdmin?: boolean;
}

export default function DdsConferenceRoom({ roomName, userName, isAdmin = false }: DdsConferenceProps) {
  const [token, setToken] = useState<string>('');
  const [wsUrl, setWsUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Nome da sala padronizado
  const cleanRoom = useMemo(() => {
    return (roomName || 'dds-sala')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .toLowerCase();
  }, [roomName]);

  const finalUserName = useMemo(() => {
    return userName?.trim() || (isAdmin ? 'Organizador' : 'Colaborador');
  }, [userName, isAdmin]);

  // Busca o token apenas UMA vez ao abrir a sala
  useEffect(() => {
    let isCancelled = false;

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(
          `/api/livekit/token?room=${encodeURIComponent(cleanRoom)}&username=${encodeURIComponent(
            finalUserName
          )}&_t=${Date.now()}`
        );

        const data = await res.json();

        if (!res.ok || !data.token) {
          throw new Error(data.error || 'Falha ao autenticar na sala do LiveKit.');
        }

        if (!isCancelled) {
          setToken(data.token);
          setWsUrl(data.wsUrl);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || 'Erro ao conectar à sala de transmissão.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchToken();

    return () => {
      isCancelled = true;
    };
  }, [cleanRoom, finalUserName]);

  if (loading) {
    return (
      <div className="w-full h-full min-h-[440px] bg-slate-950 rounded-3xl border border-slate-800 flex flex-col items-center justify-center space-y-3 p-6 text-center shadow-xl">
        <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
        <p className="text-sm font-bold text-white">Iniciando Transmissão Ao Vivo...</p>
        <p className="text-xs text-slate-400">Conectando aos servidores WebRTC do DDS ON</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full min-h-[440px] bg-slate-950 rounded-3xl border border-red-500/30 flex flex-col items-center justify-center space-y-3 p-6 text-center shadow-xl">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm font-bold text-white">Falha na Conexão do LiveKit</p>
        <p className="text-xs text-slate-400 max-w-md">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700"
        >
          <RefreshCw size={14} /> Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[440px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
      {/* Topo da Transmissão */}
      <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-white text-xs font-bold flex items-center gap-1.5">
            <Video size={14} className="text-green-400" />
            {isAdmin ? 'Transmissão Ao Vivo (Organizador)' : `Conectado: ${finalUserName}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <span className="text-[11px] bg-green-500/20 text-green-300 px-2.5 py-0.5 rounded-full font-semibold border border-green-500/30 flex items-center gap-1">
              <ShieldCheck size={12} /> Moderador Oficial
            </span>
          ) : (
            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/30">
              🎙️ Ao Vivo
            </span>
          )}
        </div>
      </div>

      {/* Sala Nativa LiveKit com Conexão Estável */}
      <div className="relative flex-1 w-full bg-black min-h-[400px]" data-lk-theme="default">
        {token && wsUrl && (
          <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={wsUrl}
            connect={true}
            className="w-full h-full"
            data-lk-theme="default"
          >
            <VideoConference />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}