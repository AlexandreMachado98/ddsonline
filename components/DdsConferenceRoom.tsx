 'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  Monitor, MonitorOff, Users, PhoneOff, Maximize, 
  ShieldCheck, AlertCircle, Sparkles
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
  // Estados de Mídia
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasMediaError, setHasMediaError] = useState(false);

  // Streams de Vídeo
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const pipCameraVideoRef = useRef<HTMLVideoElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // 1. Inicializar Câmera e Microfone do Técnico/Participante
  const initLocalMedia = useCallback(async () => {
    try {
      setHasMediaError(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      });

      localStreamRef.current = stream;

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
      if (pipCameraVideoRef.current) {
        pipCameraVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Erro ao acessar câmera/microfone:", err);
      setHasMediaError(true);
    }
  }, []);

  useEffect(() => {
    initLocalMedia();

    return () => {
      // Limpeza ao desmontar componente
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initLocalMedia]);

  // 2. Ligar / Desligar Microfone
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // 3. Ligar / Desligar Câmera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // 4. Iniciar e Parar Compartilhamento de Tela (Com Câmera em PiP)
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false
      });

      screenStreamRef.current = screenStream;

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
      }

      setIsScreenSharing(true);

      // Conecta a câmera na miniatura flutuante (Google Meet style)
      if (pipCameraVideoRef.current && localStreamRef.current) {
        pipCameraVideoRef.current.srcObject = localStreamRef.current;
      }

      // Evento disparado quando o usuário clica em "Parar Compartilhamento" na barra do navegador
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

    } catch (err) {
      console.warn("Compartilhamento de tela cancelado ou não permitido:", err);
      setIsScreenSharing(false);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    // Restaura o stream da câmera no quadro principal
    setTimeout(() => {
      if (cameraVideoRef.current && localStreamRef.current) {
        cameraVideoRef.current.srcObject = localStreamRef.current;
      }
    }, 100);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6 space-y-4 shadow-2xl relative overflow-hidden">
      
      {/* CABEÇALHO DA SALA AO VIVO */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Sala Ao Vivo: <span className="font-mono text-green-400 font-bold">{roomName.slice(0, 8)}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-slate-950 px-3 py-1 rounded-xl text-xs text-slate-300 font-semibold border border-slate-800 flex items-center gap-1.5">
            <Users size={13} className="text-green-400" /> {attendees.length + 1} online
          </span>
        </div>
      </div>

      {/* ÁREA CENTRAL DE VÍDEO (LAYOUT ESTILO GOOGLE MEET) */}
      <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner group">
        
        {/* ========================================================================= */}
        {/* CENÁRIO A: TRANSMISSÃO DE TELA ATIVA COM CÂMERA FLUTUANTE EM MINIATURA */}
        {/* ========================================================================= */}
        {isScreenSharing ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {/* TELA PRINCIPAL TRANSMITIDA */}
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />

            {/* SELO DE TRANSMISSÃO */}
            <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-green-500/30 flex items-center gap-2 z-10">
              <Monitor size={14} className="text-green-400 animate-pulse" />
              <span className="text-xs font-bold text-white">Você está transmitindo sua tela</span>
            </div>

            {/* MINIATURA FLUTUANTE DA CÂMERA (GOOGLE MEET PiP) */}
            <div className="absolute bottom-4 right-4 w-40 sm:w-52 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-green-500/80 z-20 group/pip transition-transform hover:scale-105">
              {!isVideoOff ? (
                <video
                  ref={pipCameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
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
          /* CENÁRIO B: CÂMERA NORMAL EM TELA CHEIA */
          /* ========================================================================= */
          <div className="relative w-full h-full flex items-center justify-center">
            {!isVideoOff && !hasMediaError ? (
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
                  {hasMediaError ? <AlertCircle size={36} className="text-amber-400" /> : <VideoOff size={36} className="text-slate-600" />}
                </div>
                <p className="text-xs font-bold text-slate-300">
                  {hasMediaError ? 'Acesso à câmera bloqueado no navegador' : 'Sua câmera está desligada'}
                </p>
                {hasMediaError && (
                  <button onClick={initLocalMedia} className="text-[11px] text-green-400 hover:underline">
                    Tentar novamente
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
      {/* BARRA DE CONTROLES INFERIOR (ESTILO MEET) */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-center gap-3 pt-2">
        {/* Botão Microfone */}
        <button
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

        {/* Botão Transmissão de Tela (Screen Share) */}
        {isAdmin && (
          <button
            onClick={toggleScreenShare}
            className={`px-5 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              isScreenSharing 
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-orange-600/20 animate-pulse' 
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-green-600/25'
            }`}
            title={isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela com a Equipe'}
          >
            {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
            <span>{isScreenSharing ? 'Parar Tela' : 'Apresentar Tela'}</span>
          </button>
        )}
      </div>

    </div>
  );
}