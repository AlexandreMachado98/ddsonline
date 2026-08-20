 'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, Square, Circle, 
  Download, FlipHorizontal, ShieldCheck, AlertCircle 
} from 'lucide-react';

interface DdsConferenceProps {
  roomName: string;
  userName: string;
  isAdmin?: boolean;
}

export default function DdsConferenceRoom({ roomName, userName, isAdmin = false }: DdsConferenceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  const finalUserName = userName?.trim() || (isAdmin ? 'Técnico de Segurança' : 'Colaborador');

  // Inicia a Câmera e Microfone com resolução otimizada
  const startMedia = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24 }
        },
        audio: true
      });

      setStream(mediaStream);
      setIsCameraActive(true);
      setIsScreenSharing(false);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      alert('Permita o acesso à câmera e ao microfone no navegador.');
    }
  }, []);

  // Compartilhamento de Tela (Slides / Normas / PDFs)
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        // Se o usuário fechar o compartilhamento pela barra do navegador
        screenStream.getVideoTracks()[0].onended = () => {
          startMedia();
        };

        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }

        setStream(screenStream);
        setIsScreenSharing(true);
        setIsMirrored(false); // Tela compartilhada não deve ser espelhada

        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
        }
      } catch {
        // Cancelado pelo usuário
      }
    } else {
      startMedia();
    }
  };

  // Alternar Mudo
  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Parar Transmissão
  const stopMedia = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
      setIsScreenSharing(false);
    }
  };

  // Gravação do DDS
  const startRecording = () => {
    if (!stream) {
      alert('Ligue a câmera ou compartilhe a tela antes de iniciar a gravação.');
      return;
    }

    setRecordedChunks([]);
    setRecordedVideoUrl(null);
    setRecordingTime(0);

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch {
      alert('Seu navegador não suporta a gravação direta neste formato.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Cronômetro da Gravação
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Gera o arquivo final gravado
  useEffect(() => {
    if (!isRecording && recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
    }
  }, [isRecording, recordedChunks]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-full min-h-[440px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col justify-between">
      
      {/* Topo do Estúdio */}
      <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-white text-xs font-bold flex items-center gap-1.5">
            <Video size={14} className="text-green-400" />
            {isAdmin ? 'Estúdio de Transmissão AM TST' : `Conectado: ${finalUserName}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <span className="text-[11px] bg-green-500/20 text-green-300 px-2.5 py-0.5 rounded-full font-semibold border border-green-500/30 flex items-center gap-1">
              <ShieldCheck size={12} /> Organizador Oficial
            </span>
          ) : (
            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/30">
              🎙️ Transmissão Nativa
            </span>
          )}
        </div>
      </div>

      {/* Janela de Vídeo Principal */}
      <div className="relative flex-1 w-full bg-black min-h-[380px] flex items-center justify-center overflow-hidden">
        {recordedVideoUrl && !isCameraActive ? (
          <video src={recordedVideoUrl} controls className="w-full h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isAdmin} // Muta localmente para não dar eco no próprio técnico
            className={`w-full h-full object-cover transition-transform duration-200 ${
              isMirrored && !isScreenSharing ? '-scale-x-100' : 'scale-x-100'
            } ${!isCameraActive ? 'hidden' : ''}`}
          />
        )}

        {!isCameraActive && !recordedVideoUrl && (
          <div className="text-center p-6 text-slate-500 space-y-3">
            <div className="p-4 bg-slate-900 rounded-full inline-flex border border-slate-800">
              <VideoOff size={36} className="text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-300">Câmera e Microfone Desligados</p>
              <p className="text-xs text-slate-500 mt-0.5">Clique no botão abaixo para iniciar a transmissão</p>
            </div>
            <button
              onClick={startMedia}
              className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              Ligar Câmera e Microfone
            </button>
          </div>
        )}

        {/* Badge "REC" quando estiver gravando */}
        {isRecording && (
          <div className="absolute top-4 left-4 bg-red-600 text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-lg animate-pulse z-20">
            <Circle size={10} className="fill-white" />
            REC {formatTime(recordingTime)}
          </div>
        )}

        {/* Badge de Tela Compartilhada */}
        {isScreenSharing && (
          <div className="absolute top-4 right-4 bg-blue-600 text-white text-[11px] px-3 py-1 rounded-full font-bold shadow-lg z-20 flex items-center gap-1">
            <Monitor size={12} /> Apresentando Tela
          </div>
        )}
      </div>

      {/* Barra Inferior de Controles */}
      <div className="bg-slate-900 p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isCameraActive && (
            <>
              {/* Botão Microfone */}
              <button
                onClick={toggleMute}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isMicMuted
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-slate-800 text-white hover:bg-slate-700 border-slate-700'
                }`}
                title={isMicMuted ? 'Ativar Microfone' : 'Mutar Microfone'}
              >
                {isMicMuted ? <MicOff size={16} /> : <Mic size={16} className="text-green-400" />}
              </button>

              {/* Botão Apresentar Tela */}
              <button
                onClick={toggleScreenShare}
                className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isScreenSharing
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
                }`}
              >
                <Monitor size={16} className={isScreenSharing ? 'text-white' : 'text-blue-400'} />
                <span className="hidden sm:inline">{isScreenSharing ? 'Parar Apresentação' : 'Apresentar Tela'}</span>
              </button>

              {/* Botão Espelho */}
              {!isScreenSharing && (
                <button
                  onClick={() => setIsMirrored(!isMirrored)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    isMirrored
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title="Modo Espelho"
                >
                  <FlipHorizontal size={16} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Controles de Gravação */}
        <div className="flex items-center gap-2">
          {isCameraActive && (
            <>
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Circle size={12} className="fill-red-500" /> Iniciar Gravação
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg animate-pulse"
                >
                  <Square size={12} className="fill-white" /> Parar Gravação
                </button>
              )}

              <button
                onClick={stopMedia}
                disabled={isRecording}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 border border-slate-700"
              >
                Desligar
              </button>
            </>
          )}

          {/* Download do Vídeo Gravado */}
          {recordedVideoUrl && (
            <a
              href={recordedVideoUrl}
              download={`DDS_Gravacao_${new Date().toISOString().slice(0, 10)}.webm`}
              className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg"
            >
              <Download size={15} /> Baixar Vídeo Gravado
            </a>
          )}
        </div>
      </div>

    </div>
  );
}