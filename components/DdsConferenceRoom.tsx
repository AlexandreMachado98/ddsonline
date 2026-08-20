 'use client';

import React from 'react';
import { Video, ShieldCheck } from 'lucide-react';

interface DdsConferenceProps {
  roomName: string;
  userName: string;
  isAdmin?: boolean;
}

export default function DdsConferenceRoom({ roomName, userName, isAdmin = false }: DdsConferenceProps) {
  const cleanRoom = (roomName || 'dds-aovivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .toLowerCase();

  const finalUserName = userName?.trim() || (isAdmin ? 'Técnico de Segurança' : 'Colaborador');

// Substitua 'amtst' pelo nome do subdomínio que você escolheu no Daily!
  const dailyUrl = `https://ddsoline.daily.co/dds-aovivo?userName=${encodeURIComponent(finalUserName)}`;

  return (
    <div className="w-full h-full min-h-[440px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
      {/* Topo Oficial */}
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

      {/* Janela de Vídeo Corporativa do Daily (WebRTC Robusto) */}
      <div className="relative flex-1 w-full bg-black min-h-[400px]">
        <iframe
          src={dailyUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="w-full h-full border-0 min-h-[400px]"
          title="Transmissão DDS ON"
        />
      </div>
    </div>
  );
}