 'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  Monitor, MonitorOff, Users, AlertCircle, 
  VolumeX, EyeOff, Shield, Crown, Sparkles, Smartphone, Check
} from 'lucide-react';

interface ParticipantPeer {
  id: string;
  name: string;
  stream?: MediaStream | null;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isOrganizer?: boolean;
}

interface DdsConferenceRoomProps {
  roomName: string;
  userName: string;
  isAdmin?: boolean;
  attendees?: any[];
}

export default function DdsConferenceRoom({ 
  roomName, 
  userName, 
  isAdmin = false, 
  attendees = [] 
}: DdsConferenceRoomProps) {
  // Controles de Mídia Local
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasMediaError, setHasMediaError] = useState(false);

  // Streams Locais
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Elementos de Vídeo
  const mainStageVideoRef = useRef<HTMLVideoElement>(null);
  const pipPresenterVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);

  // Lista de Participantes Conectados (Mosaico)
  const [participants, setParticipants] = useState<ParticipantPeer[]>([]);

  // 1. INICIALIZAR MÍDIA LOCAL (CÂMERA E MICROFONE)
  const initLocalMedia = useCallback(async () => {
    try {
      setHasMediaError(false);
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: 'user' 
        },
        audio: true
      });

      localStreamRef.current = stream;

      // Se for o organizador e não estiver compartilhando tela, conecta no palco principal
      if (isAdmin && mainStageVideoRef.current && !isScreenSharing) {
        mainStageVideoRef.current.srcObject = stream;
        mainStageVideoRef.current.play().catch(() => {});
      }

      // Conecta na miniatura flutuante do apresentador
      if (pipPresenterVideoRef.current) {
        pipPresenterVideoRef.current.srcObject = stream;
        pipPresenterVideoRef.current.play().catch(() => {});
      }

    } catch (err) {
      console.error("Erro ao acessar câmera/microfone:", err);
      setHasMediaError(true);
    }
  }, [isAdmin, isScreenSharing]);

  useEffect(() => {
    initLocalMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [initLocalMedia]);

  // 2. SINCRONIZA PARTICIPANTES DA SALA
  useEffect(() => {
    if (attendees && attendees.length > 0) {
      const mapped = attendees.map((att: any) => ({
        id: att.id,
        name: att.name ? att.name.replace(/\(Saída:.*\)/, '') : 'Colaborador',
        isMuted: false,
        isVideoOff: false,
        isOrganizer: false
      }));
      setParticipants(mapped);
    }
  }, [attendees]);

  // 3. SINCRONIZAÇÃO DOS VÍDEOS QUANDO MUDA O ESTADO
  useEffect(() => {
    if (isScreenSharing) {
      if (screenShareVideoRef.current && screenStreamRef.current) {
        screenShareVideoRef.current.srcObject = screenStreamRef.current;
        screenShareVideoRef.current.play().catch(() => {});
      }
      if (pipPresenterVideoRef.current && localStreamRef.current) {
        pipPresenterVideoRef.current.srcObject = localStreamRef.current;
        pipPresenterVideoRef.current.play().catch(() => {});
      }
    } else {
      if (isAdmin && mainStageVideoRef.current && localStreamRef.current) {
        mainStageVideoRef.current.srcObject = localStreamRef.current;
        mainStageVideoRef.current.play().catch(() => {});
      }
    }
  }, [isScreenSharing, isAdmin]);

  // 4. CONTROLES DE MÍDIA LOCAL
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setIsVideoOff(!nextState);

        if (nextState) {
          if (mainStageVideoRef.current) mainStageVideoRef.current.play().catch(() => {});
          if (pipPresenterVideoRef.current) pipPresenterVideoRef.current.play().catch(() => {});
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', frameRate: { ideal: 30 } },
        audio: false
      });

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.warn("Compartilhamento cancelado:", err);
      setIsScreenSharing(false);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
  };

  // 5. AÇÕES DE MODERAÇÃO DO ORGANIZADOR SOBRE OS PARTICIPANTES
  const handleModerateMuteParticipant = (participantId: string) => {
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, isMuted: !p.isMuted } : p));
  };

  const handleModerateVideoParticipant = (participantId: string) => {
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, isVideoOff: !p.isVideoOff } : p));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      
      {/* CABEÇALHO DA SALA */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Sala DDS Ao Vivo: <span className="font-mono text-green-400 font-bold">{roomName.slice(0, 8)}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-slate-950 px-3 py-1 rounded-xl text-xs text-slate-300 font-semibold border border-slate-800 flex items-center gap-1.5">
            <Users size={13} className="text-green-400" /> {participants.length + 1} presentes
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PALCO PRINCIPAL (APRESENTAÇÃO / ORGANIZADOR) */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Crown size={14} className="text-amber-400" /> 
            {isScreenSharing ? 'Transmissão de Tela em Destaque' : 'Instrutor / Organizador do DDS'}
          </span>
          {isScreenSharing && (
            <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-md">
              Apresentação Ao Vivo
            </span>
          )}
        </div>

        <div className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl flex items-center justify-center">
          
          {/* MODO 1.1: TELA COMPARTILHADA COM MINIATURA DO APRESENTADOR */}
          {isScreenSharing ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                ref={screenShareVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />

              {/* Selo de Apresentação */}
              <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-green-500/30 flex items-center gap-2 z-10 shadow-lg">
                <Monitor size={14} className="text-green-400 animate-pulse" />
                <span className="text-xs font-bold text-white">Apresentando para toda a equipe</span>
              </div>

              {/* MINIATURA DO ORGANIZADOR FLUTUANTE (ESTILO GOOGLE MEET) */}
              <div className="absolute bottom-4 right-4 w-40 sm:w-56 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-green-500 z-20 transition-all hover:scale-105">
                <video
                  ref={pipPresenterVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : 'block'}`}
                />
                {isVideoOff && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500">
                    <VideoOff size={20} />
                    <span className="text-[10px] mt-1 font-semibold">Câmera Pausada</span>
                  </div>
                )}
                <div className="absolute bottom-1.5 left-2 bg-black/70 px-2 py-0.5 rounded-md text-[10px] font-bold text-white truncate max-w-[90%] flex items-center gap-1">
                  <Crown size={10} className="text-amber-400" /> {userName} (Instrutor)
                </div>
              </div>
            </div>
          ) : (
            /* MODO 1.2: CÂMERA DO ORGANIZADOR EM DESTAQUE */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={mainStageVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff || hasMediaError ? 'hidden' : 'block'}`}
              />

              {(isVideoOff || hasMediaError) && (
                <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
                    <VideoOff size={36} className="text-slate-600" />
                  </div>
                  <p className="text-xs font-bold text-slate-300">
                    {hasMediaError ? 'Acesso à câmera bloqueado no navegador' : 'Câmera do Instrutor Pausada'}
                  </p>
                </div>
              )}

              <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-bold text-white border border-slate-700/60 flex items-center gap-2">
                <Crown size={14} className="text-amber-400" />
                <span>{userName}</span>
                <span className="text-[10px] text-green-400 font-normal bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">Instrutor</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOSAICO DE PARTICIPANTES (GRADE SEPARADA COM MODERAÇÃO) */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 px-1">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-green-400" /> Mosaico dos Participantes ({participants.length})
            </h4>
            <p className="text-xs text-slate-400">Trabalhadores conectados ao vivo no treinamento</p>
          </div>

          {isAdmin && (
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              🛡️ Modo Moderador Ativo
            </span>
          )}
        </div>

        {participants.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-1">
            <Users size={28} className="mx-auto text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-300">Aguardando participantes entrarem na chamada...</p>
            <p className="text-[11px] text-slate-500">Assim que os colaboradores assinarem a lista, eles aparecerão aqui no mosaico.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {participants.map((person) => (
              <div 
                key={person.id} 
                className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 group shadow-md flex flex-col justify-between p-2.5"
              >
                {/* Simulação do Stream do Participante com Avatar Inteligente */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
                  {!person.isVideoOff ? (
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 flex items-center justify-center font-bold text-sm">
                        {person.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Ao Vivo</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-600">
                      <VideoOff size={20} />
                      <span className="text-[9px] mt-1">Vídeo Cortado</span>
                    </div>
                  )}
                </div>

                {/* Status Superior do Participante */}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                    <Check size={10} /> Presente
                  </span>

                  {person.isMuted && (
                    <span className="bg-red-500/20 text-red-400 p-1 rounded-md" title="Microfone Silenciado">
                      <MicOff size={11} />
                    </span>
                  )}
                </div>

                {/* Nome do Participante e Controles de Moderação do Técnico */}
                <div className="relative z-10 space-y-1">
                  <div className="bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800">
                    <p className="text-xs font-bold text-white truncate">{person.name}</p>
                  </div>

                  {/* PAINEL DE CONTROLE DO MODERADOR (ORGANIZADOR) */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 pt-0.5 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleModerateMuteParticipant(person.id)}
                        className={`flex-1 py-1 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                          person.isMuted 
                            ? 'bg-red-600 text-white' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                        title={person.isMuted ? 'Desmutar Participante' : 'Silenciar Participante'}
                      >
                        {person.isMuted ? <MicOff size={11} /> : <Mic size={11} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModerateVideoParticipant(person.id)}
                        className={`flex-1 py-1 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                          person.isVideoOff 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                        title={person.isVideoOff ? 'Permitir Câmera' : 'Cortar Câmera'}
                      >
                        {person.isVideoOff ? <VideoOff size={11} /> : <VideoIcon size={11} />}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. BARRA DE CONTROLES INFERIOR */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-800/80">
        <button
          type="button"
          onClick={toggleAudio}
          className={`p-3.5 rounded-2xl font-bold text-xs flex items-center justify-center transition-all shadow-md ${
            isAudioMuted 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={isAudioMuted ? 'Ativar Meu Microfone' : 'Silenciar Meu Microfone'}
        >
          {isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          type="button"
          onClick={toggleVideo}
          className={`p-3.5 rounded-2xl font-bold text-xs flex items-center justify-center transition-all shadow-md ${
            isVideoOff 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={isVideoOff ? 'Ligar Minha Câmera' : 'Desligar Minha Câmera'}
        >
          {isVideoOff ? <VideoOff size={18} /> : <VideoIcon size={18} />}
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`px-5 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              isScreenSharing 
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-orange-600/20 animate-pulse' 
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-green-600/25'
            }`}
            title={isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Apresentar Tela para Toda a Equipe'}
          >
            {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
            <span>{isScreenSharing ? 'Parar Apresentação' : 'Apresentar Tela'}</span>
          </button>
        )}
      </div>

    </div>
  );
}