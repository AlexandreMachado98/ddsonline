'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import CacheBusterButton from '@/components/CacheBuster';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, 
  FlipHorizontal, Maximize2, Minimize2, RefreshCw, 
  AlertCircle, Users, Radio, 
  Volume2, VolumeX, Eye, Laptop, CheckCircle2, Play, Lock, HelpCircle
} from 'lucide-react';

// Cada stream remoto recebe um elemento de vídeo independente; alterações de sala
// desmontam o componente e liberam os tracks, sem misturar participantes.
function ParticipantTile({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (video) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
    return () => { if (video) video.srcObject = null; };
  }, [stream]);
  return (
    <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-700 overflow-hidden">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-1 left-1 right-1 bg-black/65 text-white text-[10px] px-2 py-1 rounded truncate">{label}</div>
      <button type="button" onClick={() => { if (ref.current) { ref.current.muted = false; ref.current.play().catch(() => {}); } }}
        aria-label={`Ativar áudio de ${label}`}
        className="absolute top-1 right-1 bg-slate-950/80 hover:bg-slate-900 text-white text-[10px] rounded px-2 py-1">
        Ouvir
      </button>
    </div>
  );
}

interface DdsConferenceProps {
  roomName: string;
  userName: string;
  isAdmin?: boolean;
}

export default function DdsConferenceRoom({ roomName, userName, isAdmin = false }: DdsConferenceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);

  // Streams de mídia
  const currentStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // PeerJS
  const peerRef = useRef<any>(null);
  const activeCallsRef = useRef<any[]>([]);
  const viewerCallRef = useRef<any>(null);
  const viewerMediaRef = useRef<MediaStream | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const connectedRef = useRef(false);
  const viewerMediaEnabledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedAudioRef = useRef<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<{ id: string; stream: MediaStream }[]>([]);
  const [viewerMicOn, setViewerMicOn] = useState(false);
  const [viewerCameraOn, setViewerCameraOn] = useState(false);
  const [isJoiningMedia, setIsJoiningMedia] = useState(false);

  // Estados gerais
  const [isConnected, setIsConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [statusText, setStatusText] = useState<string>('Inicializando transmissão...');

  // Controles do Apresentador (Admin)
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Controles do Espectador (Colaborador)
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);

  // Limpa o nome da sala para ID de sinalização WebRTC
  const cleanRoomId = (roomName || 'principal')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  const hostPeerId = `dds-host-${cleanRoomId}`;
  // TURN opcional: sem credenciais o P2P ainda pode falhar em redes corporativas.
  const rtcIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    ...(process.env.NEXT_PUBLIC_DDS_TURN_URL && process.env.NEXT_PUBLIC_DDS_TURN_USERNAME && process.env.NEXT_PUBLIC_DDS_TURN_CREDENTIAL
      ? [{ urls: process.env.NEXT_PUBLIC_DDS_TURN_URL, username: process.env.NEXT_PUBLIC_DDS_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_DDS_TURN_CREDENTIAL }]
      : [])
  ];

  // =========================================================================
  // 1. ORGANIZADOR (ADMIN / BROADCASTER)
  // =========================================================================
  const initBroadcaster = useCallback(async () => {
    try {
      setStatusText('Abrindo câmera e microfone...');
      setErrorMessage(null);
      setPermissionBlocked(false);

      // 1. Obtém câmera e microfone locais
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user'
        },
        audio: true
      });

      cameraStreamRef.current = stream;
      currentStreamRef.current = stream;
      setIsCameraOn(true);
      setIsMicOn(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // 2. Conecta ao PeerJS como Host
      setStatusText('Conectando servidor de transmissão...');
      const { default: Peer } = await import('peerjs');

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      const peer = new Peer(hostPeerId, {
        config: {
          iceServers: rtcIceServers
        }
      });

      peerRef.current = peer;

      peer.on('open', () => {
        setIsConnected(true);
        setIsLive(true);
        setStatusText('Transmissão Ao Vivo Iniciada');
      });

      // Atende chamadas dos colaboradores que entram na sala
      peer.on('call', (call) => {
        if (currentStreamRef.current) {
          call.answer(currentStreamRef.current);
          activeCallsRef.current.push(call);
          setViewerCount(activeCallsRef.current.length);
          call.on('stream', (incoming: MediaStream) => {
            // Não exibir o canvas fictício de 1px usado por espectadores sem câmera.
            const realVideo = incoming.getVideoTracks().some(track => (track.getSettings().width || 0) > 1);
            const realAudio = incoming.getAudioTracks().length > 0;
            if (realVideo || realAudio) {
              setRemoteParticipants(prev => [...prev.filter(p => p.id !== call.peer), { id: call.peer, stream: incoming }]);
            }
          });

          call.on('close', () => {
            activeCallsRef.current = activeCallsRef.current.filter((c) => c !== call);
            setViewerCount(activeCallsRef.current.length);
            setRemoteParticipants(prev => prev.filter(p => p.id !== call.peer));
          });

          call.on('error', () => {
            activeCallsRef.current = activeCallsRef.current.filter((c) => c !== call);
            setViewerCount(activeCallsRef.current.length);
            setRemoteParticipants(prev => prev.filter(p => p.id !== call.peer));
          });
        }
      });

      peer.on('error', (err: any) => {
        console.warn('Aviso PeerJS Host:', err);
        setIsLive(false);
        setErrorMessage(err?.type === 'unavailable-id' ? 'Esta transmissão já está aberta em outra aba. Feche a outra transmissão e tente novamente.' : 'Falha de sinalização da transmissão. Verifique sua conexão.');
      });

    } catch (err: any) {
      console.error('Erro ao iniciar transmissor:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionBlocked(true);
        setErrorMessage('Permissão de câmera/microfone bloqueada no seu navegador.');
      } else {
        setErrorMessage('Câmera ocupada ou indisponível em outro aplicativo.');
      }
    }
  }, [hostPeerId]);

  // =========================================================================
  // 2. COLABORADOR (VIEWER / ESPECTADOR)
  // =========================================================================
  const initViewer = useCallback(async () => {
    try {
      setStatusText('Conectando ao DDS Ao Vivo...');
      setErrorMessage(null);

      const { default: Peer } = await import('peerjs');

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      const randomViewerId = `dds-viewer-${cleanRoomId}-${Math.random().toString(36).substring(2, 9)}`;
      const peer = new Peer(randomViewerId, {
        config: {
          iceServers: rtcIceServers
        }
      });

      peerRef.current = peer;

      peer.on('open', () => {
        setIsConnected(true);
        connectToHost(peer);
      });

      peer.on('error', (err: any) => {
        console.warn('Aviso PeerJS Viewer:', err);
      });

    } catch (err) {
      console.error('Erro ao conectar espectador:', err);
      setErrorMessage('Erro ao conectar ao DDS. Tente recarregar.');
    }
  }, [cleanRoomId]);

  // Chamada única com reconexão limitada: impede loops de ligações P2P duplicadas.
  const connectToHost = (peerInstance: any) => {
    if (!mountedRef.current || peerInstance?.destroyed || connectedRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    setStatusText('Conectando ao técnico de segurança...');

    let outgoing = viewerMediaRef.current;
    if (!outgoing) {
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 1;
      dummyCanvas.height = 1;
      outgoing = dummyCanvas.captureStream(1);
    }

    const previousCall = viewerCallRef.current;
    viewerCallRef.current = null;
    previousCall?.close();
    const call = peerInstance.call(hostPeerId, outgoing);
    if (!call) return;
    viewerCallRef.current = call;
    let received = false;

    const scheduleRetry = () => {
      if (!mountedRef.current || peerInstance.destroyed || viewerCallRef.current !== call) return;
      connectedRef.current = false;
      setIsLive(false);
      setStatusText('Aguardando reconexão com o instrutor...');
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current && !peerInstance.destroyed) connectToHost(peerInstance);
      }, 4000);
    };

    call.on('stream', (remoteStream: MediaStream) => {
      received = true;
      connectedRef.current = true;
      setIsLive(true);
      setStatusText('Transmissão Ao Vivo');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().then(() => setHasStartedPlayback(true))
          .catch(() => setHasStartedPlayback(false));
      }
    });
    call.on('close', scheduleRetry);
    call.on('error', scheduleRetry);
    // Host ainda não abriu: expira uma única tentativa, em vez de multiplicar chamadas.
    reconnectTimerRef.current = setTimeout(() => {
      if (!received && mountedRef.current && viewerCallRef.current === call) {
        call.close();
        scheduleRetry();
      }
    }, 9000);
  };

  const handleJoinWithMedia = async (enableVideo = true) => {
    if (isJoiningMedia || viewerMediaEnabledRef.current) return;
    setIsJoiningMedia(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: enableVideo ? { width: { ideal: 640 }, height: { ideal: 360 } } : false
      });
      if (!mountedRef.current) { media.getTracks().forEach(t => t.stop()); return; }
      viewerMediaRef.current = media;
      viewerMediaEnabledRef.current = true;
      setViewerMicOn(true);
      setViewerCameraOn(media.getVideoTracks().length > 0);
      connectedRef.current = false;
      const peer = peerRef.current;
      if (peer && !peer.destroyed) connectToHost(peer);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.name === 'NotAllowedError'
        ? 'Permita câmera e microfone no navegador para participar com áudio/vídeo.'
        : 'Não foi possível acessar a câmera ou microfone do colaborador.');
    } finally {
      setIsJoiningMedia(false);
    }
  };

  const toggleViewerMic = () => {
    const track = viewerMediaRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setViewerMicOn(track.enabled);
  };

  const toggleViewerCamera = () => {
    const track = viewerMediaRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setViewerCameraOn(track.enabled);
  };

  useEffect(() => {
    mountedRef.current = true;
    if (isAdmin) initBroadcaster();
    else initViewer();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      viewerCallRef.current?.close();
      activeCallsRef.current.forEach(c => c.close());
      activeCallsRef.current = [];
      peerRef.current?.destroy();
      peerRef.current = null;
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      viewerMediaRef.current?.getTracks().forEach(t => t.stop());
      mixedAudioRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close().catch(() => {});
    };
  }, [isAdmin, initBroadcaster, initViewer]);

  // O React substitui os elementos <video> ao alternar câmera/apresentação.
  // Reassocie os streams após a montagem para evitar uma prévia preta.
  useEffect(() => {
    if (!isAdmin) return;
    const preview = screenPreviewRef.current;
    if (isSharingScreen && preview && screenStreamRef.current) {
      preview.srcObject = screenStreamRef.current;
      preview.play().catch(() => {});
    }
    const camera = localVideoRef.current;
    if (camera && cameraStreamRef.current) {
      camera.srcObject = cameraStreamRef.current;
      camera.play().catch(() => {});
    }
  }, [isAdmin, isSharingScreen]);

  // =========================================================================
  // 3. COMPARTILHAMENTO DE TELA DIRETO (ZERO TELA PRETA)
  // =========================================================================
  const handleStartScreenShare = async () => {
    try {
      setErrorMessage(null);
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 30, max: 60 }
        },
        audio: true
      });

      screenStreamRef.current = displayStream;
      const screenVideo = displayStream.getVideoTracks()[0];
      const microphone = cameraStreamRef.current?.getAudioTracks()[0];
      const presentationAudio = displayStream.getAudioTracks()[0];
      let audio = microphone || presentationAudio;
      if (microphone && presentationAudio) {
        const context = new AudioContext();
        audioContextRef.current = context;
        const mixed = context.createMediaStreamDestination();
        context.createMediaStreamSource(new MediaStream([microphone])).connect(mixed);
        context.createMediaStreamSource(new MediaStream([presentationAudio])).connect(mixed);
        mixedAudioRef.current = mixed.stream;
        audio = mixed.stream.getAudioTracks()[0];
      }
      currentStreamRef.current = new MediaStream([...(screenVideo ? [screenVideo] : []), ...(audio ? [audio] : [])]);
      setIsSharingScreen(true);

      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = displayStream;
        screenPreviewRef.current.play().catch(() => {});
      }

      // Substitui o track de vídeo para todos os colaboradores em tempo real
      const newVideoTrack = displayStream.getVideoTracks()[0];
      if (newVideoTrack) {
        activeCallsRef.current.forEach((call) => {
          try {
            const sender = call.peerConnection?.getSenders()?.find((s: any) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(newVideoTrack).catch(console.warn);
            const audioSender = call.peerConnection?.getSenders()?.find((s: any) => s.track?.kind === 'audio');
            const nextAudio = currentStreamRef.current?.getAudioTracks()[0];
            if (audioSender && nextAudio) audioSender.replaceTrack(nextAudio).catch(console.warn);
          } catch (e) {}
        });

        newVideoTrack.onended = () => {
          handleStopScreenShare();
        };
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.error('Erro ao compartilhar tela:', err);
        setErrorMessage('Não foi possível iniciar o compartilhamento de tela.');
      }
    }
  };

  const handleStopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    mixedAudioRef.current?.getTracks().forEach(track => track.stop());
    mixedAudioRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;

    // Restaura a câmera
    if (cameraStreamRef.current) {
      currentStreamRef.current = cameraStreamRef.current;
      const cameraVideoTrack = cameraStreamRef.current.getVideoTracks()[0];

      if (cameraVideoTrack) {
        activeCallsRef.current.forEach((call) => {
          try {
            const sender = call.peerConnection?.getSenders()?.find((s: any) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(cameraVideoTrack).catch(console.warn);
            const audioSender = call.peerConnection?.getSenders()?.find((s: any) => s.track?.kind === 'audio');
            const mic = cameraStreamRef.current?.getAudioTracks()[0];
            if (audioSender && mic) audioSender.replaceTrack(mic).catch(console.warn);
          } catch (e) {}
        });
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = cameraStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
    }

    setIsSharingScreen(false);
  };

  const toggleCamera = () => {
    if (cameraStreamRef.current) {
      const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (cameraStreamRef.current) {
      const audioTrack = cameraStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleStartViewerAudio = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.play().then(() => {
        setHasStartedPlayback(true);
        setIsAudioMuted(false);
      }).catch(() => {});
    }
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full min-h-[380px] sm:min-h-[500px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col relative font-sans select-none"
    >
      {/* 1. BARRA SUPERIOR DE STATUS */}
      <div className="bg-slate-900/90 backdrop-blur-md px-3.5 sm:px-5 py-3 flex items-center justify-between border-b border-slate-800 z-20">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLive ? 'bg-red-400 opacity-75' : 'bg-amber-400 opacity-50'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isLive ? 'bg-red-500' : 'bg-amber-500'}`}></span>
          </span>
          <div className="flex items-center gap-2 truncate">
            <span className="text-white text-xs font-bold flex items-center gap-1.5 truncate">
              <Radio size={14} className={`shrink-0 ${isLive ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
              <span className="truncate">{isAdmin ? 'Transmissão Ao Vivo (DDS)' : `DDS Ao Vivo - ${userName || 'Colaborador'}`}</span>
            </span>
            {isSharingScreen && (
              <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                <Laptop size={11} /> Apresentando Slides / Tela
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <CacheBusterButton />

          {isAdmin ? (
            <span className="text-[11px] bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-xl font-semibold border border-blue-500/30 flex items-center gap-1.5">
              <Eye size={12} className="text-blue-400" />
              <strong>{viewerCount}</strong> <span className="hidden sm:inline">espectador(es)</span>
            </span>
          ) : (
            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-xl font-semibold border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 size={12} /> <span className="hidden sm:inline">Presença Conectada</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. ÁREA DE TRANSMISSÃO */}
      <div className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden min-h-[300px] sm:min-h-[420px]">
        
        {/* Alerta de Permissão Bloqueada com Guia Passo a Passo */}
        {permissionBlocked && (
          <div className="absolute inset-0 bg-slate-950/95 z-30 p-6 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto animate-in fade-in">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Lock size={32} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Acesso à Câmera Bloqueado</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Clique no ícone de <strong>Cadeado 🔒</strong> na barra de endereços do seu navegador e mude a permissão de Câmera/Microfone para <strong>"Permitir"</strong>.
              </p>
            </div>
            <button
              onClick={initBroadcaster}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2"
            >
              <RefreshCw size={14} /> Já Permiti, Tentar Novamente
            </button>
          </div>
        )}

        {/* Mensagem de Erro Geral */}
        {errorMessage && !permissionBlocked && (
          <div className="absolute top-4 left-4 right-4 z-30 bg-red-500/20 border border-red-500/40 text-red-300 text-xs p-3 rounded-2xl flex items-center justify-between gap-2 shadow-lg backdrop-blur-md">
            <span className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              {errorMessage}
            </span>
            {isAdmin && (
              <button 
                onClick={initBroadcaster}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg shrink-0"
              >
                Reconectar
              </button>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VISÃO DO ORGANIZADOR                                                      */}
        {/* ========================================================================= */}
        {isAdmin ? (
          <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4">
            {isSharingScreen ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                <video
                  ref={screenPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />

                {/* Picture-in-Picture do Instrutor */}
                {isCameraOn && (
                  <div className="absolute bottom-4 right-4 w-32 sm:w-48 aspect-video rounded-2xl overflow-hidden border-2 border-blue-500 shadow-2xl bg-black z-20">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isMirrored ? '-scale-x-100' : 'scale-x-100'}`}
                    />
                    <div className="absolute bottom-1 left-2 text-[9px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded">
                      Você (Instrutor)
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full h-full max-w-4xl aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isMirrored ? '-scale-x-100' : 'scale-x-100'} ${!isCameraOn ? 'hidden' : ''}`}
                />

                {!isCameraOn && (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-2">
                    <VideoOff size={44} className="opacity-40" />
                    <p className="text-sm font-semibold text-slate-400">Sua câmera está desligada</p>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  {userName || 'Técnico de Segurança'}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* VISÃO DO COLABORADOR                                                      */
          /* ========================================================================= */
          <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-contain rounded-2xl ${!isLive ? 'hidden' : ''}`}
            />

            {!isLive && (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3 max-w-sm">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse">
                  <Radio size={36} className="text-blue-400" />
                </div>
                <h4 className="text-white font-bold text-base">Aguardando Início do DDS</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  O Técnico de Segurança está preparando a sala. A transmissão começará automaticamente assim que a câmera ou apresentação for ligada.
                </p>
              </div>
            )}

            {/* Desbloqueio de Áudio para Mobile */}
            {isLive && !hasStartedPlayback && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-30">
                <button
                  onClick={handleStartViewerAudio}
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm rounded-2xl flex items-center gap-2 shadow-2xl transition-all"
                >
                  <Play size={18} /> Clique para Ativar Áudio e Vídeo
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {isAdmin && (
        <section className="bg-slate-950 border-t border-slate-800 px-3 sm:px-5 py-3 space-y-2">
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs font-bold text-slate-200">Mosaico de participantes ({remoteParticipants.length})</span>
            <span className="text-[10px] text-slate-400">Vídeo e áudio opcionais</span>
          </div>
          {remoteParticipants.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {remoteParticipants.map((person, index) => (
                <ParticipantTile key={person.id} stream={person.stream} label={`Participante ${index + 1}`} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Nenhum participante transmitindo câmera no momento.</p>
          )}
        </section>
      )}

      {/* 3. BARRA INFERIOR DE CONTROLES */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md px-3 sm:px-5 py-3 flex items-center justify-between border-t border-slate-800 z-20 flex-wrap gap-2">
        
        {isAdmin ? (
          <div className="flex items-center justify-center w-full sm:w-auto gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={toggleMic}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md min-h-[44px] ${
                isMicOn 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
              }`}
            >
              {isMicOn ? <Mic size={16} className="text-emerald-400" /> : <MicOff size={16} className="text-red-400" />}
              <span className="hidden sm:inline">{isMicOn ? 'Mudo' : 'Ativar Mic'}</span>
            </button>

            <button
              onClick={toggleCamera}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md min-h-[44px] ${
                isCameraOn 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
              }`}
            >
              {isCameraOn ? <Video size={16} className="text-blue-400" /> : <VideoOff size={16} className="text-red-400" />}
              <span className="hidden sm:inline">{isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera'}</span>
            </button>

            <button
              onClick={isSharingScreen ? handleStopScreenShare : handleStartScreenShare}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg min-h-[44px] ${
                isSharingScreen
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-blue-600/30'
              }`}
            >
              {isSharingScreen ? <MonitorOff size={16} /> : <Monitor size={16} />}
              <span>{isSharingScreen ? 'Parar Apresentação' : 'Compartilhar Tela / Slides'}</span>
            </button>

            <button
              onClick={() => setIsMirrored(!isMirrored)}
              title="Alternar modo espelho da câmera"
              className={`p-2.5 rounded-2xl text-xs font-semibold transition-all border min-h-[44px] min-w-[44px] flex items-center justify-center ${
                isMirrored
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <FlipHorizontal size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {!viewerMediaEnabledRef.current ? (
              <>
                <button type="button" onClick={() => handleJoinWithMedia(false)} disabled={isJoiningMedia}
                  className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold min-h-[44px]">
                  {isJoiningMedia ? 'Solicitando permissão...' : 'Participar somente com microfone'}
                </button>
                <button type="button" onClick={() => handleJoinWithMedia(true)} disabled={isJoiningMedia}
                  className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold min-h-[44px]">
                  Participar com câmera e microfone
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={toggleViewerMic}
                  className="px-3 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold min-h-[44px]">
                  {viewerMicOn ? 'Silenciar microfone' : 'Ativar microfone'}
                </button>
                <button type="button" onClick={toggleViewerCamera}
                  className="px-3 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold min-h-[44px]">
                  {viewerCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
                </button>
              </>
            )}
            <button
              onClick={() => {
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
                  setIsAudioMuted(remoteVideoRef.current.muted);
                }
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold flex items-center gap-2 border border-slate-700 transition-all min-h-[44px]"
            >
              {isAudioMuted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} className="text-emerald-400" />}
              <span>{isAudioMuted ? 'Desmutar Áudio' : 'Áudio Ativo'}</span>
            </button>
          </div>
        )}

        <button
          onClick={toggleFullscreen}
          title="Alternar Tela Cheia"
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-semibold border border-slate-700 transition-all ml-auto min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

      </div>

    </div>
  );
}