 'use client';

import React from 'react';
import { Video, ShieldCheck } from 'lucide-react';

interface DdsConferenceProps {
  roomName: string;
  userName: string;
  isAdmin?: boolean;
}

export default function DdsConferenceRoom({ roomName, userName, isAdmin = false }: DdsConferenceProps) {
  const cleanRoom = (roomName || 'dds-principal')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .toLowerCase();

  const finalUserName = userName?.trim() || (isAdmin ? 'Técnico de Segurança (Organizador)' : 'Colaborador');

  const adminButtons = "['microphone','camera','desktop','tileview','chat','raisehand','mute-everyone','fullscreen']";
  const userButtons = "['microphone','camera','raisehand','chat','tileview','fullscreen']";

  const jitsiUrl = `https://meet.jit.si/dds-seguranca-${cleanRoom}#userInfo.displayName="${encodeURIComponent(
    finalUserName
  )}"&config.prejoinConfig.enabled=false&config.prejoinPageEnabled=false&config.requireDisplayName=false&config.startWithAudioMuted=${!isAdmin}&config.startWithVideoMuted=false&config.disableDeepLinking=true&interfaceConfig.TOOLBAR_BUTTONS=${
    isAdmin ? adminButtons : userButtons
  }`;

  return (
    <div className="w-full h-full min-h-[440px] bg-slate-950 rounded-2xl overflow-hidden shadow-xl border border-slate-800 flex flex-col">
      {/* Topo da Sala */}
      <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <span className="text-white text-xs font-bold flex items-center gap-1.5">
            <Video size={14} className="text-blue-400" />
            {isAdmin ? 'Mosaico de Transmissão e Apresentação' : `Conectado: ${finalUserName}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <span className="text-[11px] bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full font-semibold border border-blue-500/30 flex items-center gap-1">
              <ShieldCheck size={12} /> Moderador do DDS
            </span>
          ) : (
            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/30">
              ✋ Use o botão da mão para falar
            </span>
          )}
        </div>
      </div>

      {/* Frame de Videoconferência */}
      <div className="relative flex-1 w-full bg-black min-h-[400px]">
        <iframe
          src={jitsiUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="w-full h-full border-0 min-h-[400px]"
          title="Videoconferência DDS Online"
        />
      </div>
    </div>
  );
}