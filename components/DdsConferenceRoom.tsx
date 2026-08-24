 'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  Monitor, MonitorOff, Users, AlertCircle
} from 'lucide-react';

interface Attendee {
  id: string;
  name: string;
  cpf: string;
  status: string;
  createdAt: string;
}

interface DdsConferenceRoomProps {
  roomName: string;
  userName: string;
  isAdmin?: boolean;
  attendees?: Attendee[];
}

export default function DdsConferenceRoom({ 
  roomName, 
  userName, 
  isAdmin = false, 
  attendees = [] 
}: DdsConferenceRoomProps) {
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasMediaError, setHasMediaError] = useState(false);

  // Elementos de Vídeo
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const pipCameraVideoRef = useRef<HTMLVideoElement>(null);

  // Streams de Mídia
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // 1. INICIALIZAR CÂMERA E MICROFONE
  const initLocalMedia = useCallback(async () => {
    try {
      setHasMediaError(false);
      
      // Se já existir stream ativo, para as tracks anteriores
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

      // Conecta ao vídeo principal
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play().catch(() => {});
      }
      // Conecta ao vídeo em miniatura (PiP)
      if (pipCameraVideoRef.current) {
        pipCameraVideoRef.current.srcObject = stream;
        pipCameraVideoRef.current.play().catch(() => {});
      }

    } catch (err) {
      console.error("Erro ao acessar câmera/microfone:", err);
      setHasMediaError(true);
    }
  }, []);

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

  // 2. SINCRONIZAÇÃO AUTOMÁTICA DOS VÍDEOS QUANDO MUDA O ESTADO
  useEffect(() => {
    if (isScreenSharing) {
      if (screenVideoRef.current && screenStreamRef.current) {
        screenVideoRef.current.srcObject = screenStreamRef.current;
        screenVideoRef.current.play().catch(() => {});
      }
      if (pipCameraVideoRef.current && localStreamRef.current) {
        pipCameraVideoRef.current.srcObject = localStreamRef.current;
        pipCameraVideoRef.current.play().catch(() => {});
      }
    } else {
      if (cameraVideoRef.current && localStreamRef.current) {
        cameraVideoRef.current.srcObject = localStreamRef.current;
        cameraVideoRef.current.play().catch(() => {});
      }
    }
  }, [isScreenSharing]);

  // 3. LIGAR / DESLIGAR MICROFONE
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // 4. LIGAR / DESLIGAR CÂMERA (CORRIGIDO: A imagem volta instantaneamente)
  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setIsVideoOff(!nextState);

        // Garante que o elemento de vídeo continue reproduzindo
        if (nextState) {
          if (cameraVideoRef.current) cameraVideoRef.current.play().catch(() => {});
          if (pipCameraVideoRef.current) pipCameraVideoRef.current.play().catch(() => {});
        }
      } else {
        // Se a track foi perdida, reinicia a mídia suavemente
        await initLocalMedia();
        setIsVideoOff(false);
      }
    } else {
      await initLocalMedia();
      setIsVideoOff(false);
    }
  };

  // 5. INICIAR / PARAR COMPARTILHAMENTO DE TELA (CORRIGIDO: Sem tela preta)
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          displaySurface: 'monitor',
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      // Evento disparado caso o usuário clique em "Parar Compartilhamento" na barra do Windows/Chrome
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6 space-y-4 shadow-2xl relative overflow-hidden">
      
      {/* CABEÇALHO DA SALA */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Transmissão Ao Vivo: <span className="font-mono text-green-400 font-bold">{roomName.slice(0, 8)}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-slate-950 px-3 py-1 rounded-xl text-xs text-slate-300 font-semibold border border-slate-800 flex items-center gap-1.5">
            <Users size={13} className="text-green-400" /> {attendees.length + 1} online
          </span>
        </div>
      </div>

      {/* ÁREA CENTRAL DE VÍDEO (GOOGLE MEET STYLE) */}
      <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
        
        {/* ========================================================================= */}
        {/* MODO 1: TRANSMISSÃO DE TELA ATIVA */}
        {/* ========================================================================= */}
        {isScreenSharing ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {/* TELA PRINCIPAL COMPARTILHADA */}
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />

            {/* SELO DE TRANSMISSÃO */}
            <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-green-500/30 flex items-center gap-2 z-10 shadow-lg">
              <Monitor size={14} className="text-green-400 animate-pulse" />
              <span className="text-xs font-bold text-white">Você está transmitindo sua tela</span>
            </div>

            {/* MINIATURA FLUTUANTE DA CÂMERA (PiP) */}
            <div className="absolute bottom-4 right-4 w-40 sm:w-52 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-green-500 z-20 transition-all hover:scale-105">
              <video
                ref={pipCameraVideoRef}
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
              <div className="absolute bottom-1.5 left-2 bg-black/70 px-2 py-0.5 rounded-md text-[10px] font-bold text-white truncate max-w-[90%]">
                {userName} (Você)
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* MODO 2: CÂMERA EM TELA CHEIA */
          /* ========================================================================= */
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Tag de Vídeo sempre montada (evita travamento ao religar) */}
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff || hasMediaError ? 'hidden' : 'block'}`}
            />

            {/* Overlay quando a câmera estiver pausada ou bloqueada */}
            {(isVideoOff || hasMediaError) && (
              <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
                  {hasMediaError ? <AlertCircle size={36} className="text-amber-400" /> : <VideoOff size={36} className="text-slate-600" />}
                </div>
                <p className="text-xs font-bold text-slate-300">
                  {hasMediaError ? 'Permissão de câmera bloqueada' : 'Sua câmera está pausada'}
                </p>
                {hasMediaError && (
                  <button onClick={initLocalMedia} className="text-[11px] text-green-400 hover:underline">
                    Autorizar Câmera
                  </button>
                )}
              </div>
            )}

            {/* Identificação do Usuário */}
            <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white border border-slate-700/60 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              {userName} {isAdmin && <span className="text-[10px] text-green-400 font-normal">(Organizador)</span>}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BARRA DE CONTROLES */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-center gap-3 pt-2">
        {/* Botão Microfone */}
        <button
          type="button"
          onClick={toggleAudio}
          className={`p-3.5 rounded-2xl font-bold text-xs flex items-center justify-center transition-all shadow-md ${
            isAudioMuted 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={isAudioMuted ? 'Ativar Microfone' : 'Silenciar Microfone'}
        >
          {isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Botão Câmera */}
        <button
          type="button"
          onClick={toggleVideo}
          className={`p-3.5 rounded-2xl font-bold text-xs flex items-center justify-center transition-all shadow-md ${
            isVideoOff 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={isVideoOff ? 'Ligar Câmera' : 'Desligar Câmera'}
        >
          {isVideoOff ? <VideoOff size={18} /> : <VideoIcon size={18} />}
        </button>

        {/* Botão Transmissão de Tela (Apenas para o Organizador) */}
        {isAdmin && (
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`px-5 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              isScreenSharing 
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-orange-600/20 animate-pulse' 
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-green-600/25'
            }`}
            title={isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Apresentar Tela com a Equipe'}
          >
            {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
            <span>{isScreenSharing ? 'Parar Tela' : 'Apresentar Tela'}</span>
          </button>
        )}
      </div>

    </div>
  );
}