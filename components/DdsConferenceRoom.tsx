 'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, Square, Circle, 
  Download, FlipHorizontal, ShieldCheck, LayoutGrid, Maximize2, Users, CheckCircle2, User
} from 'lucide-react';

interface Attendee {
  id: string;
  name: string;
  cpf: string;
  selfie?: string;
  createdAt: string;
  exitReason?: string;
}

interface DdsConferenceProps {
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
}: DdsConferenceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);

  // Alternância de Layout: 'MOSAIC' (Grade) ou 'SPOTLIGHT' (Foco no Apresentador)
  const [viewMode, setViewMode] = useState<'MOSAIC' | 'SPOTLIGHT'>('MOSAIC');

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  const finalUserName = userName?.trim() || (isAdmin ? 'Técnico de Segurança' : 'Colaborador');

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
    } catch {
      alert('Por favor, autorize o acesso à câmera e microfone no navegador.');
    }
  }, []);

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        screenStream.getVideoTracks()[0].onended = () => {
          startMedia();
        };

        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }

        setStream(screenStream);
        setIsScreenSharing(true);
        setIsMirrored(false);

        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
        }
      } catch {}
    } else {
      startMedia();
    }
  };

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const stopMedia = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
      setIsScreenSharing(false);
    }
  };

  const startRecording = () => {
    if (!stream) {
      alert('Ligue a câmera ou compartilhe a tela antes de gravar.');
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
      alert('Navegador não suporta este formato de gravação.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

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

  // Calcula a quantidade de colunas do mosaico dinamicamente
  const getGridCols = () => {
    const totalTiles = 1 + attendees.length;
    if (totalTiles <= 1) return 'grid-cols-1';
    if (totalTiles === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (totalTiles <= 4) return 'grid-cols-1 sm:grid-cols-2';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  };

  return (
    <div className="w-full h-full min-h-[480px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col justify-between">
      
      {/* Topo do Mosaico */}
      <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-white text-xs font-bold flex items-center gap-1.5">
            <Users size={15} className="text-green-400" />
            Mosaico de Participantes ({1 + attendees.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Alternar Layout Mosaico vs Foco */}
          <button
            onClick={() => setViewMode(viewMode === 'MOSAIC' ? 'SPOTLIGHT' : 'MOSAIC')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Alternar Modo de Exibição"
          >
            {viewMode === 'MOSAIC' ? (
              <>
                <Maximize2 size={13} /> Modo Foco
              </>
            ) : (
              <>
                <LayoutGrid size={13} /> Modo Grade
              </>
            )}
          </button>

          {isAdmin ? (
            <span className="text-[11px] bg-green-500/20 text-green-300 px-2.5 py-0.5 rounded-full font-semibold border border-green-500/30 flex items-center gap-1">
              <ShieldCheck size={12} /> Organizador
            </span>
          ) : (
            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/30">
              🎙️ Ao Vivo
            </span>
          )}
        </div>
      </div>

      {/* ÁREA DO MOSAICO DINÂMICO */}
      <div className="relative flex-1 w-full bg-slate-950 p-3 overflow-y-auto">
        
        {/* LAYOUT 1: MODO GRADE / MOSAICO (TODOS LADO A LADO) */}
        {viewMode === 'MOSAIC' && (
          <div className={`grid ${getGridCols()} gap-3 w-full h-full min-h-[380px]`}>
            
            {/* QUADRO 1: CÂMERA DO ORGANIZADOR / APRESENTADOR */}
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-lg flex items-center justify-center min-h-[200px]">
              {recordedVideoUrl && !isCameraActive ? (
                <video src={recordedVideoUrl} controls className="w-full h-full object-contain" />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={isAdmin}
                  className={`w-full h-full object-cover ${
                    isMirrored && !isScreenSharing ? '-scale-x-100' : 'scale-x-100'
                  } ${!isCameraActive ? 'hidden' : ''}`}
                />
              )}

              {!isCameraActive && !recordedVideoUrl && (
                <div className="text-center p-4 text-slate-500 space-y-2">
                  <VideoOff size={28} className="mx-auto text-slate-600" />
                  <p className="text-xs font-bold text-slate-400">Câmera do Organizador</p>
                  <button
                    onClick={startMedia}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-[11px] transition-colors"
                  >
                    Ligar Câmera
                  </button>
                </div>
              )}

              {/* Tag do Organizador */}
              <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 z-10">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-[11px] font-bold text-white truncate max-w-[140px]">{finalUserName} (Organizador)</span>
              </div>

              {isRecording && (
                <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse z-10">
                  <Circle size={8} className="fill-white" /> REC {formatTime(recordingTime)}
                </div>
              )}
            </div>

            {/* QUADROS DOS TRABALHADORES PRESENTES NO DDS */}
            {attendees.map((attendee) => {
              const isExited = Boolean(attendee.exitReason);
              return (
                <div 
                  key={attendee.id} 
                  className={`relative bg-slate-900 rounded-2xl overflow-hidden border shadow-lg flex items-center justify-center min-h-[200px] transition-all ${
                    isExited ? 'border-amber-500/30 opacity-70' : 'border-green-500/30'
                  }`}
                >
                  {/* Foto da Biometria Facial do Colaborador */}
                  {attendee.selfie ? (
                    <img 
                      src={attendee.selfie} 
                      alt={attendee.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4 text-slate-500">
                      <User size={36} className="mx-auto text-slate-600" />
                    </div>
                  )}

                  {/* Tag com Nome e Status do Colaborador */}
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-950/85 backdrop-blur-sm p-2 rounded-xl border border-slate-800/80 flex items-center justify-between z-10">
                    <div className="truncate mr-2">
                      <p className="text-xs font-bold text-white truncate">{attendee.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {isExited ? `⚠️ Saída: ${attendee.exitReason}` : `Entrada: ${new Date(attendee.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>

                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${isExited ? 'bg-amber-400' : 'bg-green-500 animate-pulse'}`}></span>
                  </div>
                </div>
              );
            })}

          </div>
        )}

        {/* LAYOUT 2: MODO FOCO (APRESENTADOR GRANDE + CARROSSEL EMBAIXO) */}
        {viewMode === 'SPOTLIGHT' && (
          <div className="flex flex-col h-full space-y-3">
            {/* Tela Central Grande */}
            <div className="relative flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center min-h-[280px]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isAdmin}
                className={`w-full h-full object-cover ${
                  isMirrored && !isScreenSharing ? '-scale-x-100' : 'scale-x-100'
                } ${!isCameraActive ? 'hidden' : ''}`}
              />

              {!isCameraActive && (
                <div className="text-center p-4 text-slate-500 space-y-2">
                  <p className="text-xs font-bold text-slate-400">Câmera Principal</p>
                  <button onClick={startMedia} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold">
                    Ligar Câmera
                  </button>
                </div>
              )}
            </div>

            {/* Fila de Participantes Embaixo */}
            {attendees.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 max-h-24">
                {attendees.map(a => (
                  <div key={a.id} className="relative w-20 h-20 bg-slate-900 rounded-xl overflow-hidden border border-green-500/30 shrink-0">
                    {a.selfie && <img src={a.selfie} alt={a.name} className="w-full h-full object-cover" />}
                    <span className="absolute bottom-1 left-1 right-1 text-[9px] font-bold text-white bg-slate-950/80 px-1 rounded truncate text-center">
                      {a.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Barra Inferior de Controles */}
      <div className="bg-slate-900 p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isCameraActive && (
            <>
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