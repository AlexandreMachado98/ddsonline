 'use client';

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, Square, Circle, 
  Download, FlipHorizontal, ShieldCheck, LayoutGrid, Maximize2, Users, CheckCircle2, User, Loader2
} from 'lucide-react';

interface RemoteParticipant {
  peerId: string;
  userName: string;
  stream: MediaStream;
}

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

function RemoteVideoTile({ participant }: { participant: RemoteParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-green-500/30 shadow-lg flex items-center justify-center min-h-[200px] aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 right-2 bg-slate-950/85 backdrop-blur-sm p-2 rounded-xl border border-slate-800 flex items-center justify-between z-10">
        <div className="truncate mr-2">
          <p className="text-xs font-bold text-white truncate">{participant.userName}</p>
          <span className="text-[10px] text-green-400 font-semibold">● Câmera Ao Vivo</span>
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse shrink-0"></span>
      </div>
    </div>
  );
}

function DdsConferenceRoomComponent({ 
  roomName, 
  userName, 
  isAdmin = false, 
  attendees = [] 
}: DdsConferenceProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const peerInstanceRef = useRef<any>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);

  const [viewMode, setViewMode] = useState<'MOSAIC' | 'SPOTLIGHT'>('MOSAIC');

  // Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  const finalUserName = userName?.trim() || (isAdmin ? 'Técnico de Segurança' : 'Colaborador');
  const cleanRoom = (roomName || 'dds-principal')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .toLowerCase();

  // Inicia a Câmera Local e o WebRTC P2P
  useEffect(() => {
    let isMounted = true;
    let streamInstance: MediaStream | null = null;

    const setupConference = async () => {
      try {
        setIsConnecting(true);

        // 1. Liga a câmera e microfone locais
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 }
          },
          audio: true
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamInstance = stream;
        setLocalStream(stream);
        setIsCameraActive(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Importa o PeerJS dinamicamente
        const { default: Peer } = await import('peerjs');

        // Se for o organizador, usa o ID fixo da sala. Se for colaborador, gera ID único
        const peerId = isAdmin 
          ? `ddson-host-${cleanRoom}` 
          : `ddson-user-${cleanRoom}-${Math.random().toString(36).substring(2, 7)}`;

        const peer = new Peer(peerId, {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        peerInstanceRef.current = peer;

        peer.on('open', () => {
          if (!isMounted) return;
          setIsConnecting(false);

          // Se for colaborador, liga diretamente para o Organizador (Host da sala)
          if (!isAdmin) {
            const hostPeerId = `ddson-host-${cleanRoom}`;
            const call = peer.call(hostPeerId, stream, {
              metadata: { userName: finalUserName }
            });

            call.on('stream', (remoteStream) => {
              if (!isMounted) return;
              setRemoteParticipants([{
                peerId: hostPeerId,
                userName: 'Técnico de Segurança (Apresentador)',
                stream: remoteStream
              }]);
            });
          }
        });

        // Se for o Organizador, atende as chamadas de vídeo dos colaboradores que entram
        peer.on('call', (call) => {
          call.answer(stream); // Responde com o vídeo do técnico

          const callerName = call.metadata?.userName || 'Colaborador';

          call.on('stream', (remoteStream) => {
            if (!isMounted) return;
            setRemoteParticipants(prev => {
              if (prev.some(p => p.peerId === call.peer)) return prev;
              return [...prev, {
                peerId: call.peer,
                userName: callerName,
                stream: remoteStream
              }];
            });
          });

          call.on('close', () => {
            if (!isMounted) return;
            setRemoteParticipants(prev => prev.filter(p => p.peerId !== call.peer));
          });
        });

      } catch (err) {
        console.error("Erro ao iniciar conferência:", err);
        setIsConnecting(false);
      }
    };

    setupConference();

    return () => {
      isMounted = false;
      if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop());
      }
      if (peerInstanceRef.current) {
        peerInstanceRef.current.destroy();
      }
    };
  }, [cleanRoom, finalUserName, isAdmin]);

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
        };

        setIsScreenSharing(true);
        setIsMirrored(false);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
      } catch {}
    } else {
      setIsScreenSharing(false);
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const startRecording = () => {
    if (!localStream) return;
    setRecordedChunks([]);
    setRecordedVideoUrl(null);
    setRecordingTime(0);

    try {
      const mediaRecorder = new MediaRecorder(localStream, {
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
    } catch {}
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

  const totalVideoTiles = 1 + remoteParticipants.length;

  const getGridCols = () => {
    if (totalVideoTiles <= 1) return 'grid-cols-1';
    if (totalVideoTiles === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (totalVideoTiles <= 4) return 'grid-cols-1 sm:grid-cols-2';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  };

  return (
    <div className="w-full h-full min-h-[480px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col justify-between">
      
      {/* Topo da Transmissão */}
      <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-white text-xs font-bold flex items-center gap-1.5">
            <Users size={15} className="text-green-400" />
            Mosaico Ao Vivo ({totalVideoTiles} {totalVideoTiles === 1 ? 'câmera' : 'câmeras'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'MOSAIC' ? 'SPOTLIGHT' : 'MOSAIC')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            {viewMode === 'MOSAIC' ? <><Maximize2 size={13} /> Foco</> : <><LayoutGrid size={13} /> Grade</>}
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

      {/* ÁREA DO MOSAICO COM TRANSMISSÕES DE VÍDEO REAIS */}
      <div className="relative flex-1 w-full bg-slate-950 p-3 overflow-y-auto">
        
        {isConnecting && (
          <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
            <p className="text-xs text-slate-300 font-bold">Conectando Câmeras Ao Vivo...</p>
          </div>
        )}

        {/* GRADE DE MOSAICO COM TODAS AS CÂMERAS AO VIVO */}
        <div className={`grid ${getGridCols()} gap-3 w-full h-full min-h-[380px]`}>
          
          {/* CÂMERA LOCAL (SEU VÍDEO AO VIVO) */}
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-green-500/40 shadow-lg flex items-center justify-center min-h-[200px] aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted={true}
              className={`w-full h-full object-cover ${
                isMirrored && !isScreenSharing ? '-scale-x-100' : 'scale-x-100'
              } ${!isCameraActive ? 'hidden' : ''}`}
            />

            {!isCameraActive && (
              <div className="text-center p-4 text-slate-500">
                <VideoOff size={28} className="mx-auto text-slate-600 mb-1" />
                <p className="text-xs font-bold text-slate-400">Sua Câmera</p>
              </div>
            )}

            <div className="absolute bottom-2 left-2 bg-slate-950/85 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 z-10">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-[11px] font-bold text-white truncate max-w-[140px]">
                {finalUserName} {isAdmin ? '(Você - Organizador)' : '(Você)'}
              </span>
            </div>

            {isRecording && (
              <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse z-10">
                <Circle size={8} className="fill-white" /> REC {formatTime(recordingTime)}
              </div>
            )}
          </div>

          {/* CÂMERAS TRANSMITIDAS AO VIVO DOS OUTROS PARTICIPANTES */}
          {remoteParticipants.map((participant) => (
            <RemoteVideoTile key={participant.peerId} participant={participant} />
          ))}

          {/* Slots de Espera se ninguém mais conectou a câmera ainda */}
          {remoteParticipants.length === 0 && (
            <div className="relative bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-1.5 min-h-[200px] aspect-video">
              <Users size={32} className="text-slate-700 mx-auto" />
              <p className="text-xs font-semibold text-slate-400">Aguardando participantes...</p>
              <p className="text-[10px] text-slate-600 max-w-[200px]">
                {isAdmin ? 'Conforme os colaboradores entrarem pelo celular, os vídeos ao vivo deles aparecerão aqui no mosaico.' : 'Conectado à sala do técnico.'}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Controles */}
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

              {isAdmin && (
                <button
                  onClick={toggleScreenShare}
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isScreenSharing
                      ? 'bg-green-600 text-white border-green-500'
                      : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
                  }`}
                >
                  <Monitor size={16} className={isScreenSharing ? 'text-white' : 'text-green-400'} />
                  <span className="hidden sm:inline">{isScreenSharing ? 'Parar Tela' : 'Apresentar Tela'}</span>
                </button>
              )}

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

        {/* Controles de Gravação (Apenas no Organizador) */}
        {isAdmin && isCameraActive && (
          <div className="flex items-center gap-2">
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

            {recordedVideoUrl && (
              <a
                href={recordedVideoUrl}
                download={`DDS_Gravacao_${new Date().toISOString().slice(0, 10)}.webm`}
                className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg"
              >
                <Download size={15} /> Baixar Vídeo
              </a>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

export default memo(DdsConferenceRoomComponent);