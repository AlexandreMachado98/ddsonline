 'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  Monitor, MonitorOff, Users, Hand, Crown, 
  AlertCircle, VolumeX, EyeOff, Check, Sparkles
} from 'lucide-react';

interface ParticipantPeer {
  id: string;
  name: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHandRaised?: boolean;
  handRaisedAt?: number;
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
  const [isMyHandRaised, setIsMyHandRaised] = useState(false);

  // Streams de Mídia
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Elementos de Vídeo
  const mainStageVideoRef = useRef<HTMLVideoElement>(null);
  const pipPresenterVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);

  // Lista de Participantes (Mosaico)
  const [participants, setParticipants] = useState<ParticipantPeer[]>([]);

  // 1. INICIALIZAR MÍDIA LOCAL
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

  // 2. SINCRONIZAÇÃO DE PARTICIPANTES VINDOS DA LISTA DE PRESENÇA
  useEffect(() => {
    if (attendees && attendees.length > 0) {
      const mapped = attendees.map((att: any) => ({
        id: att.id,
        name: att.name ? att.name.replace(/\(Saída:.*\)/, '') : 'Colaborador',
        isMuted: false,
        isVideoOff: false,
        isHandRaised: false
      }));
      setParticipants(mapped);
    }
  }, [attendees]);

  // 3. SINCRONIZAÇÃO DO VÍDEO PRINCIPAL E PiP
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

  // 4. CONTROLES DE ÁUDIO E CÂMERA LOCAL
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

  // 5. APRESENTAÇÃO DE TELA (EXCLUSIVO DO ORGANIZADOR)
  const toggleScreenShare = async () => {
    if (!isAdmin) return;

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

  // 6. RECURSO DE LEVANTAR A MÃO (PARTICIPANTE)
  const toggleRaiseHand = () => {
    const nextState = !isMyHandRaised;
    setIsMyHandRaised(nextState);

    // Se for participante, atualiza seu status no mosaico
    setParticipants(prev => {
      const exists = prev.some(p => p.name === userName);
      if (exists) {
        return prev.map(p => p.name === userName ? { ...p, isHandRaised: nextState, handRaisedAt: nextState ? Date.now() : undefined } : p);
      } else {
        return [...prev, { id: 'me', name: userName, isHandRaised: nextState, handRaisedAt: nextState ? Date.now() : undefined }];
      }
    });
  };

  // 7. MODERAÇÃO DO ORGANIZADOR (MUTAR, CORTAR CÂMERA E BAIXAR MÃO)
  const handleModerateMute = (id: string) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, isMuted: !p.isMuted } : p));
  };

  const handleModerateVideo = (id: string) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, isVideoOff: !p.isVideoOff } : p));
  };

  const handleLowerHand = (id: string) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, isHandRaised: false } : p));
  };

  // 8. ORDENAÇÃO DO MOSAICO: QUEM LEVANTOU A MÃO FICA EM 1º LUGAR NO TOPO
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.isHandRaised && !b.isHandRaised) return -1;
    if (!a.isHandRaised && b.isHandRaised) return 1;
    if (a.isHandRaised && b.isHandRaised) return (b.handRaisedAt || 0) - (a.handRaisedAt || 0);
    return 0;
  });

  const totalHandsRaised = participants.filter(p => p.isHandRaised).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      
      {/* CABEÇALHO DA SALA */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              DDS Ao Vivo • <span className="font-mono text-green-400">{roomName.slice(0, 8)}</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-normal">
              {isAdmin ? 'Você está como Instrutor / Organizador' : `Você está conectado como ${userName}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalHandsRaised > 0 && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-pulse">
              <Hand size={14} /> {totalHandsRaised} pedindo a palavra
            </span>
          )}
          <span className="bg-slate-950 px-3 py-1 rounded-xl text-xs text-slate-300 font-semibold border border-slate-800 flex items-center gap-1.5">
            <Users size={13} className="text-green-400" /> {participants.length + (isAdmin ? 1 : 0)} conectados
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PALCO PRINCIPAL (APRESENTAÇÃO DO INSTRUTOR) */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Crown size={15} className="text-amber-400" /> 
            {isScreenSharing ? 'Transmissão de Tela do Instrutor' : 'Transmissão do Treinamento (Instrutor)'}
          </span>
          {isScreenSharing && (
            <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-md flex items-center gap-1">
              <Sparkles size={11} /> Apresentação em Destaque
            </span>
          )}
        </div>

        <div className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl flex items-center justify-center">
          
          {/* MODO 1.1: APRESENTAÇÃO DE TELA ATIVA */}
          {isScreenSharing ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                ref={screenShareVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />

              <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-green-500/30 flex items-center gap-2 z-10 shadow-lg">
                <Monitor size={14} className="text-green-400 animate-pulse" />
                <span className="text-xs font-bold text-white">Tela do Treinamento</span>
              </div>

              {/* MINIATURA FLUTUANTE DO INSTRUTOR (GOOGLE MEET STYLE) */}
              <div className="absolute bottom-4 right-4 w-44 sm:w-60 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-green-500 z-20 transition-all hover:scale-105">
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
                <div className="absolute bottom-1.5 left-2 bg-black/80 px-2 py-0.5 rounded-md text-[10px] font-bold text-white truncate max-w-[90%] flex items-center gap-1">
                  <Crown size={10} className="text-amber-400" /> Instrutor (Ao Vivo)
                </div>
              </div>
            </div>
          ) : (
            /* MODO 1.2: CÂMERA DO INSTRUTOR EM DESTAQUE */
            <div className="relative w-full h-full flex items-center justify-center">
              {isAdmin ? (
                <video
                  ref={mainStageVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff || hasMediaError ? 'hidden' : 'block'}`}
                />
              ) : (
                /* VISÃO DO PARTICIPANTE: Simulação da Câmera do Instrutor Recebida */
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6 text-center space-y-3">
                  <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/40 text-green-400 flex items-center justify-center font-black text-2xl shadow-lg">
                    TÉCNICO
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white flex items-center justify-center gap-1.5">
                      <Crown size={18} className="text-amber-400" /> Instrutor de Segurança
                    </h4>
                    <p className="text-xs text-slate-400">Transmitindo o DDS ao vivo para a equipe</p>
                  </div>
                  <span className="text-[11px] bg-green-500/10 text-green-300 border border-green-500/30 px-3 py-1 rounded-full font-semibold">
                    Áudio e Vídeo Conectados
                  </span>
                </div>
              )}

              {isAdmin && (isVideoOff || hasMediaError) && (
                <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
                    <VideoOff size={36} className="text-slate-600" />
                  </div>
                  <p className="text-xs font-bold text-slate-300">
                    {hasMediaError ? 'Acesso à câmera bloqueado' : 'Câmera do Instrutor Pausada'}
                  </p>
                </div>
              )}

              {isAdmin && (
                <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-bold text-white border border-slate-700/60 flex items-center gap-2">
                  <Crown size={14} className="text-amber-400" />
                  <span>{userName}</span>
                  <span className="text-[10px] text-green-400 font-normal bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">Instrutor</span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOSAICO DE PARTICIPANTES (AMPLO, LEGÍVEL E COM PRIORIDADE PARA QUEM LEVANTA A MÃO) */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 px-1">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-green-400" /> Mosaico dos Participantes ({sortedParticipants.length})
            </h4>
            <p className="text-xs text-slate-400">
              Colaboradores presentes • Pessoas com a mão levantada aparecem em 1º lugar com destaque
            </p>
          </div>

          {isAdmin && (
            <span className="text-[11px] font-semibold text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              🛡️ Painel de Moderação Ativo
            </span>
          )}
        </div>

        {sortedParticipants.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-10 text-center space-y-2">
            <Users size={36} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-bold text-slate-300">Aguardando participantes na chamada...</p>
            <p className="text-xs text-slate-500">Conforme os colaboradores acessarem o link, suas câmeras e avatares aparecerão aqui no mosaico.</p>
          </div>
        ) : (
          /* GRADE RESPONSIVA AMPLA (CARDS GRANDES E VISÍVEIS) */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedParticipants.map((person) => (
              <div 
                key={person.id} 
                className={`relative h-48 sm:h-52 bg-slate-950 rounded-3xl overflow-hidden border-2 flex flex-col justify-between p-3 transition-all duration-300 shadow-xl ${
                  person.isHandRaised 
                    ? 'border-amber-400 ring-4 ring-amber-400/20 bg-gradient-to-b from-amber-950/30 to-slate-950 scale-[1.02] z-20' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* ÁREA CENTRAL DO CARD DO PARTICIPANTE */}
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2">
                  {!person.isVideoOff ? (
                    <>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-lg shadow-md ${
                        person.isHandRaised 
                          ? 'bg-amber-500 text-slate-950 border-2 border-amber-300 shadow-amber-500/20' 
                          : 'bg-green-500/20 border border-green-500/40 text-green-400'
                      }`}>
                        {person.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Ao Vivo na Reunião</span>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-600 space-y-1">
                      <VideoOff size={24} />
                      <span className="text-[10px]">Câmera Desativada</span>
                    </div>
                  )}
                </div>

                {/* TOPO DO CARD: BADGE DE MÃO LEVANTADA OU PRESENÇA */}
                <div className="relative z-10 flex items-center justify-between">
                  {person.isHandRaised ? (
                    <span className="bg-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-xl text-[10px] flex items-center gap-1 shadow-md animate-bounce">
                      <Hand size={12} /> Pediu a Palavra
                    </span>
                  ) : (
                    <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                      <Check size={10} /> Presente
                    </span>
                  )}

                  {person.isMuted && (
                    <span className="bg-red-500/20 text-red-400 p-1.5 rounded-lg border border-red-500/30" title="Microfone Mutado">
                      <MicOff size={13} />
                    </span>
                  )}
                </div>

                {/* RODAPÉ DO CARD: NOME + CONTROLES DO MODERADOR */}
                <div className="relative z-10 space-y-1.5">
                  <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm">
                    <p className="text-xs font-bold text-white truncate">{person.name}</p>
                  </div>

                  {/* CONTROLES DE MODERAÇÃO DO ORGANIZADOR */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {person.isHandRaised && (
                        <button
                          type="button"
                          onClick={() => handleLowerHand(person.id)}
                          className="flex-1 py-1 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1"
                          title="Baixar a mão do participante"
                        >
                          <Hand size={10} /> Atender
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleModerateMute(person.id)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                          person.isMuted 
                            ? 'bg-red-600 text-white' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                        title={person.isMuted ? 'Desmutar' : 'Silenciar'}
                      >
                        {person.isMuted ? <MicOff size={11} /> : <Mic size={11} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModerateVideo(person.id)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
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
        {/* Microfone */}
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

        {/* Câmera */}
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

        {/* BOTÃO LEVANTAR A MÃO (PARA OS PARTICIPANTES) */}
        {!isAdmin && (
          <button
            type="button"
            onClick={toggleRaiseHand}
            className={`px-5 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              isMyHandRaised 
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'
            }`}
            title={isMyHandRaised ? 'Abaixar minha mão' : 'Levantar a mão para falar'}
          >
            <Hand size={18} />
            <span>{isMyHandRaised ? 'Mão Levantada ✋' : 'Pedir a Palavra'}</span>
          </button>
        )}

        {/* APRESENTAR TELA (EXCLUSIVO DO ORGANIZADOR) */}
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