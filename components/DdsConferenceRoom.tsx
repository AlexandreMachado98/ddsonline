 'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  Monitor, MonitorOff, Users, Hand, Crown, 
  Check, Sparkles, Wifi, WifiOff, Maximize, Minimize
} from 'lucide-react';

interface RemoteParticipant {
  peerId: string;
  name: string;
  stream?: MediaStream;
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

// Emissor de som de notificação de mão levantada (Web Audio API nativo)
function playHandRaiseBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // Nota Lá (A5)
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1); // Nota Ré (D6)

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

// Componente para renderizar os cards dos participantes no Mosaico
function ParticipantVideoCard({ 
  participant, 
  isAdmin, 
  onModerateMute, 
  onModerateVideo, 
  onLowerHand 
}: { 
  participant: RemoteParticipant;
  isAdmin: boolean;
  onModerateMute: (id: string) => void;
  onModerateVideo: (id: string) => void;
  onLowerHand: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [participant.stream]);

  return (
    <div 
      className={`relative h-48 sm:h-52 bg-slate-950 rounded-3xl overflow-hidden border-2 flex flex-col justify-between p-3 transition-all duration-300 shadow-xl ${
        participant.isHandRaised 
          ? 'border-amber-400 ring-4 ring-amber-400/20 bg-gradient-to-b from-amber-950/30 to-slate-950 scale-[1.02] z-20' 
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* VÍDEO DO PARTICIPANTE OU AVATAR */}
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
        {participant.stream && !participant.isVideoOff ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-lg shadow-md ${
              participant.isHandRaised 
                ? 'bg-amber-500 text-slate-950 border-2 border-amber-300 shadow-amber-500/20' 
                : 'bg-green-500/20 border border-green-500/40 text-green-400'
            }`}>
              {participant.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {participant.isVideoOff ? 'Câmera Desativada' : 'Ao Vivo'}
            </span>
          </div>
        )}
      </div>

      {/* TOPO: BADGE DE MÃO LEVANTADA */}
      <div className="relative z-10 flex items-center justify-between">
        {participant.isHandRaised ? (
          <span className="bg-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-xl text-[10px] flex items-center gap-1 shadow-md animate-bounce">
            <Hand size={12} /> Pediu a Palavra
          </span>
        ) : (
          <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
            <Check size={10} /> Presente
          </span>
        )}

        {participant.isMuted && (
          <span className="bg-red-500/20 text-red-400 p-1.5 rounded-lg border border-red-500/30">
            <MicOff size={13} />
          </span>
        )}
      </div>

      {/* RODAPÉ COM NOME E CONTROLES */}
      <div className="relative z-10 space-y-1.5">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-white truncate">{participant.name}</p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {participant.isHandRaised && (
              <button
                type="button"
                onClick={() => onLowerHand(participant.peerId)}
                className="flex-1 py-1 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1"
                title="Baixar a mão do participante"
              >
                <Hand size={10} /> Atender
              </button>
            )}

            <button
              type="button"
              onClick={() => onModerateMute(participant.peerId)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                participant.isMuted 
                  ? 'bg-red-600 text-white' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={participant.isMuted ? 'Desmutar' : 'Silenciar'}
            >
              {participant.isMuted ? <MicOff size={11} /> : <Mic size={11} />}
            </button>

            <button
              type="button"
              onClick={() => onModerateVideo(participant.peerId)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                participant.isVideoOff 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={participant.isVideoOff ? 'Permitir Câmera' : 'Cortar Câmera'}
            >
              {participant.isVideoOff ? <VideoOff size={11} /> : <VideoIcon size={11} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DdsConferenceRoom({ 
  roomName, 
  userName, 
  isAdmin = false, 
  attendees = [] 
}: DdsConferenceRoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasMediaError, setHasMediaError] = useState(false);
  const [isMyHandRaised, setIsMyHandRaised] = useState(false);
  const [handRaiseAlert, setHandRaiseAlert] = useState<{ peerId: string; name: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Streams
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [remoteOrganizerStream, setRemoteOrganizerStream] = useState<MediaStream | null>(null);

  // WebRTC PeerJS
  const peerInstance = useRef<any>(null);
  const hostDataConn = useRef<any>(null);
  const participantConns = useRef<Map<string, any>>(new Map());
  const activeCalls = useRef<Map<string, any>>(new Map());

  // Elementos de Vídeo
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const localMainVideoRef = useRef<HTMLVideoElement>(null);
  const localPipVideoRef = useRef<HTMLVideoElement>(null);
  const localParticipantMosaicRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const organizerVideoRef = useRef<HTMLVideoElement>(null);

  // Participantes Remotos
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

  const cleanRoomId = roomName.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const hostPeerId = `dds-${cleanRoomId}-host`;

  // 1. CARREGAR MOTOR WEBRTC (PEERJS)
  const loadPeerJs = useCallback((): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).Peer) {
        resolve((window as any).Peer);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      script.async = true;
      script.onload = () => resolve((window as any).Peer);
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  }, []);

  // 2. INICIALIZAR MÍDIA LOCAL (COM FILTRO ANTI-ECO E CANCELAMENTO DE RUÍDO)
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
        audio: {
          echoCancellation: true,    // Cancela o próprio eco (Anti-Microfonia)
          noiseSuppression: true,    // Remove ruído de fundo
          autoGainControl: true      // Ajuste automático de volume
        }
      });

      localStreamRef.current = stream;

      // Organizador: Conecta ao palco principal
      if (isAdmin && localMainVideoRef.current && !isScreenSharing) {
        localMainVideoRef.current.srcObject = stream;
        localMainVideoRef.current.play().catch(() => {});
      }
      if (isAdmin && localPipVideoRef.current) {
        localPipVideoRef.current.srcObject = stream;
        localPipVideoRef.current.play().catch(() => {});
      }

      // Participante: Conecta ao seu card no Mosaico
      if (!isAdmin && localParticipantMosaicRef.current) {
        localParticipantMosaicRef.current.srcObject = stream;
        localParticipantMosaicRef.current.play().catch(() => {});
      }

      return stream;
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      setHasMediaError(true);
      return null;
    }
  }, [isAdmin, isScreenSharing]);

  // 3. SINCRONIZAÇÃO DA TELA DO ORGANIZADOR
  useEffect(() => {
    if (isScreenSharing && screenStreamRef.current) {
      if (screenShareVideoRef.current) {
        screenShareVideoRef.current.srcObject = screenStreamRef.current;
        screenShareVideoRef.current.muted = true;
        screenShareVideoRef.current.play().catch(() => {});
      }
      if (localPipVideoRef.current && localStreamRef.current) {
        localPipVideoRef.current.srcObject = localStreamRef.current;
        localPipVideoRef.current.play().catch(() => {});
      }
    } else if (isAdmin && localMainVideoRef.current && localStreamRef.current) {
      localMainVideoRef.current.srcObject = localStreamRef.current;
      localMainVideoRef.current.play().catch(() => {});
    }
  }, [isScreenSharing, isAdmin]);

  // 4. SINCRONIZAÇÃO DO VÍDEO DO PARTICIPANTE NO MOSAICO
  useEffect(() => {
    if (!isAdmin && localParticipantMosaicRef.current && localStreamRef.current) {
      localParticipantMosaicRef.current.srcObject = localStreamRef.current;
      localParticipantMosaicRef.current.play().catch(() => {});
    }
  }, [isAdmin, isVideoOff]);

  // 5. CONEXÃO WEBRTC PEER-TO-PEER
  useEffect(() => {
    let isMounted = true;

    async function startConference() {
      const stream = await initLocalMedia();
      const PeerClass = await loadPeerJs().catch(() => null);

      if (!PeerClass || !isMounted) return;

      if (isAdmin) {
        // MODO ORGANIZADOR (HOST DA SALA)
        const peer = new PeerClass(hostPeerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        peerInstance.current = peer;

        peer.on('open', () => {
          if (isMounted) setIsConnected(true);
        });

        peer.on('call', (call: any) => {
          const currentOutStream = isScreenSharing && screenStreamRef.current 
            ? screenStreamRef.current 
            : localStreamRef.current;

          call.answer(currentOutStream);
          activeCalls.current.set(call.peer, call);

          call.on('stream', (remoteStream: MediaStream) => {
            if (!isMounted) return;
            setRemoteParticipants(prev => {
              const exists = prev.some(p => p.peerId === call.peer);
              if (exists) {
                return prev.map(p => p.peerId === call.peer ? { ...p, stream: remoteStream } : p);
              }
              return [...prev, {
                peerId: call.peer,
                name: 'Participante',
                stream: remoteStream,
                isHandRaised: false
              }];
            });
          });

          call.on('close', () => {
            setRemoteParticipants(prev => prev.filter(p => p.peerId !== call.peer));
            activeCalls.current.delete(call.peer);
          });
        });

        peer.on('connection', (conn: any) => {
          participantConns.current.set(conn.peer, conn);

          conn.on('data', (data: any) => {
            if (!isMounted) return;

            if (data.type === 'USER_INFO') {
              setRemoteParticipants(prev => {
                const exists = prev.some(p => p.peerId === conn.peer);
                if (exists) {
                  return prev.map(p => p.peerId === conn.peer ? { ...p, name: data.name } : p);
                }
                return [...prev, { peerId: conn.peer, name: data.name, isHandRaised: false }];
              });
            }

            if (data.type === 'HAND_RAISE') {
              setRemoteParticipants(prev => {
                const exists = prev.some(p => p.peerId === conn.peer);
                if (exists) {
                  return prev.map(p => p.peerId === conn.peer ? { 
                    ...p, 
                    name: data.name || p.name,
                    isHandRaised: data.isHandRaised, 
                    handRaisedAt: data.isHandRaised ? Date.now() : undefined 
                  } : p);
                }
                return [...prev, {
                  peerId: conn.peer,
                  name: data.name || 'Participante',
                  isHandRaised: data.isHandRaised,
                  handRaisedAt: data.isHandRaised ? Date.now() : undefined
                }];
              });

              if (data.isHandRaised) {
                playHandRaiseBeep();
                setHandRaiseAlert({ peerId: conn.peer, name: data.name || 'Colaborador' });
              } else {
                setHandRaiseAlert(prev => prev?.peerId === conn.peer ? null : prev);
              }
            }
          });

          conn.on('close', () => {
            participantConns.current.delete(conn.peer);
          });
        });

        peer.on('error', (err: any) => {
          console.warn("Aviso PeerJS Host:", err?.type || err);
        });

      } else {
        // MODO PARTICIPANTE (COLABORADOR)
        const randomId = `dds-${cleanRoomId}-user-${Math.random().toString(36).substring(2, 7)}`;
        const peer = new PeerClass(randomId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        peerInstance.current = peer;

        peer.on('open', () => {
          if (!isMounted) return;
          setIsConnected(true);

          const conn = peer.connect(hostPeerId);
          hostDataConn.current = conn;

          conn.on('open', () => {
            conn.send({ type: 'USER_INFO', name: userName });
          });

          conn.on('data', (data: any) => {
            if (data.type === 'LOWER_HAND') {
              setIsMyHandRaised(false);
            }
            if (data.type === 'FORCE_MUTE') {
              if (localStreamRef.current) {
                const track = localStreamRef.current.getAudioTracks()[0];
                if (track) { track.enabled = false; setIsAudioMuted(true); }
              }
            }
            if (data.type === 'FORCE_VIDEO') {
              if (localStreamRef.current) {
                const track = localStreamRef.current.getVideoTracks()[0];
                if (track) { track.enabled = false; setIsVideoOff(true); }
              }
            }
          });

          if (stream) {
            const call = peer.call(hostPeerId, stream);
            call.on('stream', (organizerStream: MediaStream) => {
              if (!isMounted) return;
              setRemoteOrganizerStream(organizerStream);
              if (organizerVideoRef.current) {
                organizerVideoRef.current.srcObject = organizerStream;
                organizerVideoRef.current.play().catch(() => {});
              }
            });
          }
        });

        peer.on('error', (err: any) => {
          console.warn("Aviso PeerJS Participante:", err?.type || err);
        });
      }
    }

    startConference();

    return () => {
      isMounted = false;
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
    };
  }, [cleanRoomId, hostPeerId, isAdmin, userName, initLocalMedia, loadPeerJs]);

  // 6. SINCRONIZA VÍDEO DO ORGANIZADOR NO PARTICIPANTE
  useEffect(() => {
    if (!isAdmin && remoteOrganizerStream && organizerVideoRef.current) {
      organizerVideoRef.current.srcObject = remoteOrganizerStream;
      organizerVideoRef.current.play().catch(() => {});
    }
  }, [isAdmin, remoteOrganizerStream]);

  // 7. APRESENTAÇÃO DE TELA (ORGANIZADOR)
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

      const screenTrack = screenStream.getVideoTracks()[0];

      activeCalls.current.forEach((call) => {
        try {
          const pc = call.peerConnection;
          if (pc) {
            const senders = pc.getSenders();
            const videoSender = senders.find((s: any) => 
              (s.track && s.track.kind === 'video') || s.kind === 'video'
            );
            if (videoSender) {
              videoSender.replaceTrack(screenTrack);
            }
          }
        } catch (err) {
          console.warn("Erro ao substituir track para peer:", err);
        }
      });

      screenTrack.onended = () => {
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

    if (localStreamRef.current) {
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      if (camTrack) {
        activeCalls.current.forEach((call) => {
          try {
            const pc = call.peerConnection;
            if (pc) {
              const senders = pc.getSenders();
              const videoSender = senders.find((s: any) => 
                (s.track && s.track.kind === 'video') || s.kind === 'video'
              );
              if (videoSender) {
                videoSender.replaceTrack(camTrack);
              }
            }
          } catch (err) {}
        });
      }
    }
  };

  // 8. LEVANTAR A MÃO (PARTICIPANTE)
  const toggleRaiseHand = () => {
    const nextState = !isMyHandRaised;
    setIsMyHandRaised(nextState);

    if (hostDataConn.current && hostDataConn.current.open) {
      hostDataConn.current.send({
        type: 'HAND_RAISE',
        isHandRaised: nextState,
        name: userName
      });
    }
  };

  // 9. MODERAÇÃO DO ORGANIZADOR
  const handleModerateMute = (peerId: string) => {
    const conn = participantConns.current.get(peerId);
    if (conn && conn.open) {
      conn.send({ type: 'FORCE_MUTE' });
    }
    setRemoteParticipants(prev => prev.map(p => p.peerId === peerId ? { ...p, isMuted: true } : p));
  };

  const handleModerateVideo = (peerId: string) => {
    const conn = participantConns.current.get(peerId);
    if (conn && conn.open) {
      conn.send({ type: 'FORCE_VIDEO' });
    }
    setRemoteParticipants(prev => prev.map(p => p.peerId === peerId ? { ...p, isVideoOff: true } : p));
  };

  const handleLowerHand = (peerId: string) => {
    const conn = participantConns.current.get(peerId);
    if (conn && conn.open) {
      conn.send({ type: 'LOWER_HAND' });
    }
    setRemoteParticipants(prev => prev.map(p => p.peerId === peerId ? { ...p, isHandRaised: false } : p));
    if (handRaiseAlert?.peerId === peerId) {
      setHandRaiseAlert(null);
    }
  };

  // 10. CONTROLES DE ÁUDIO E VÍDEO LOCAL
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioMuted(!track.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoOff(!track.enabled);
      }
    }
  };

  // 11. CONTROLE DE TELA CHEIA (FULLSCREEN)
  const toggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // 12. ORDENAÇÃO DO MOSAICO
  const sortedParticipants = [...remoteParticipants].sort((a, b) => {
    if (a.isHandRaised && !b.isHandRaised) return -1;
    if (!a.isHandRaised && b.isHandRaised) return 1;
    if (a.isHandRaised && b.isHandRaised) return (b.handRaisedAt || 0) - (a.handRaisedAt || 0);
    return 0;
  });

  const totalHandsRaised = remoteParticipants.filter(p => p.isHandRaised).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      
      {/* BANNER DE NOTIFICAÇÃO COM SOM E BOTÃO ATENDER (ORGANIZADOR) */}
      {isAdmin && handRaiseAlert && (
        <div className="bg-amber-500 text-slate-950 p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-top-3 duration-300 border-2 border-amber-300">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-950 text-amber-400 rounded-xl animate-bounce">
              <Hand size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide">Pedido de Palavra!</p>
              <p className="text-sm font-bold"><strong>{handRaiseAlert.name}</strong> levantou a mão para falar.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleLowerHand(handRaiseAlert.peerId)}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Atender / Baixar Mão
            </button>
          </div>
        </div>
      )}

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
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              {isConnected ? (
                <span className="text-green-400 flex items-center gap-1"><Wifi size={11} /> Conexão P2P Ativa</span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1"><WifiOff size={11} /> Conectando à sala...</span>
              )}
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
            <Users size={13} className="text-green-400" /> {remoteParticipants.length + 1} na chamada
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PALCO PRINCIPAL (TRANSMISSÃO DO ORGANIZADOR + BOTÃO TELA CHEIA) */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Crown size={15} className="text-amber-400" /> 
            {isAdmin ? (isScreenSharing ? 'Sua Apresentação de Tela' : 'Sua Câmera (Instrutor)') : 'Transmissão do Instrutor (Ao Vivo)'}
          </span>

          <div className="flex items-center gap-2">
            {isScreenSharing && (
              <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                <Sparkles size={11} /> Apresentação em Destaque
              </span>
            )}
            
            {/* BOTÃO DE TELA CHEIA (FULLSCREEN) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors flex items-center gap-1 text-xs"
              title={isFullscreen ? 'Sair da Tela Cheia' : 'Abrir Apresentação em Tela Cheia'}
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              <span className="hidden sm:inline text-[11px] font-semibold">{isFullscreen ? 'Minimizar' : 'Tela Cheia'}</span>
            </button>
          </div>
        </div>

        <div 
          ref={stageContainerRef}
          className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl flex items-center justify-center"
        >
          {/* VISÃO DO ORGANIZADOR */}
          {isAdmin ? (
            isScreenSharing ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video
                  ref={screenShareVideoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => e.currentTarget.play()}
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-green-500/30 flex items-center gap-2 z-10 shadow-lg">
                  <Monitor size={14} className="text-green-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">Transmitindo Tela para os Colaboradores</span>
                </div>
                {/* Miniatura do Organizador no Canto */}
                <div className="absolute bottom-4 right-4 w-44 sm:w-60 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-green-500 z-20">
                  <video
                    ref={localPipVideoRef}
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
                    <Crown size={10} className="text-amber-400" /> Você (Instrutor)
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={localMainVideoRef}
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
                    <p className="text-xs font-bold text-slate-300">Sua Câmera está Pausada</p>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-bold text-white border border-slate-700/60 flex items-center gap-2">
                  <Crown size={14} className="text-amber-400" />
                  <span>{userName}</span>
                  <span className="text-[10px] text-green-400 font-normal bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">Instrutor</span>
                </div>
              </div>
            )
          ) : (
            /* VISÃO DO PARTICIPANTE: 100% LIMPA (SEM NENHUMA JANELA TAMPANDO) */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {remoteOrganizerStream ? (
                <video
                  ref={organizerVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 space-y-3 p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 text-green-400 flex items-center justify-center animate-pulse">
                    <Crown size={28} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Conectando à Transmissão do Instrutor...</h4>
                    <p className="text-xs text-slate-400">Aguarde o início do vídeo e da apresentação.</p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOSAICO DOS PARTICIPANTES (1º LUGAR PARA O PRÓPRIO PARTICIPANTE) */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 px-1">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-green-400" /> Mosaico dos Participantes ({sortedParticipants.length + (!isAdmin ? 1 : 0)})
            </h4>
            <p className="text-xs text-slate-400">
              Colaboradores presentes • Quem levanta a mão fica em destaque
            </p>
          </div>

          {isAdmin && (
            <span className="text-[11px] font-semibold text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              🛡️ Painel de Moderação Ativo
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* CARD DO PRÓPRIO PARTICIPANTE (SEMPRE EM 1º LUGAR NO MOSAICO DELE) */}
          {!isAdmin && (
            <div 
              className={`relative h-48 sm:h-52 bg-slate-950 rounded-3xl overflow-hidden border-2 flex flex-col justify-between p-3 transition-all duration-300 shadow-xl ${
                isMyHandRaised 
                  ? 'border-amber-400 ring-4 ring-amber-400/20 bg-gradient-to-b from-amber-950/30 to-slate-950 scale-[1.02] z-20' 
                  : 'border-green-500/60 ring-2 ring-green-500/10'
              }`}
            >
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                <video
                  ref={localParticipantMosaicRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : 'block'}`}
                />
                {isVideoOff && (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-14 h-14 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-black text-lg">
                      {userName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">Sua Câmera está Desligada</span>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="relative z-10 flex items-center justify-between">
                {isMyHandRaised ? (
                  <span className="bg-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-xl text-[10px] flex items-center gap-1 shadow-md animate-bounce">
                    <Hand size={12} /> Sua Mão está Levantada
                  </span>
                ) : (
                  <span className="bg-green-500 text-slate-950 font-bold px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1">
                    <Check size={10} /> Você (Conectado)
                  </span>
                )}

                {isAudioMuted && (
                  <span className="bg-red-500/20 text-red-400 p-1.5 rounded-lg border border-red-500/30">
                    <MicOff size={13} />
                  </span>
                )}
              </div>

              {/* Rodapé */}
              <div className="relative z-10">
                <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
                  <p className="text-xs font-bold text-white truncate">{userName} (Você)</p>
                  <span className="text-[9px] text-green-400 font-bold uppercase tracking-wider">Seu Vídeo</span>
                </div>
              </div>
            </div>
          )}

          {/* DEMAIS PARTICIPANTES */}
          {sortedParticipants.map((p) => (
            <ParticipantVideoCard
              key={p.peerId}
              participant={p}
              isAdmin={isAdmin}
              onModerateMute={handleModerateMute}
              onModerateVideo={handleModerateVideo}
              onLowerHand={handleLowerHand}
            />
          ))}

          {isAdmin && sortedParticipants.length === 0 && (
            <div className="col-span-full bg-slate-950/60 border border-slate-800 rounded-3xl p-10 text-center space-y-2">
              <Users size={36} className="mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-300">Aguardando colaboradores entrarem na chamada...</p>
              <p className="text-xs text-slate-500">Assim que os participantes acessarem o link, suas câmeras aparecerão aqui no mosaico.</p>
            </div>
          )}
        </div>
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

        {/* BOTÃO LEVANTAR A MÃO (PARTICIPANTE) */}
        {!isAdmin && (
          <button
            type="button"
            onClick={toggleRaiseHand}
            className={`px-5 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              isMyHandRaised 
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'
            }`}
          >
            <Hand size={18} />
            <span>{isMyHandRaised ? 'Mão Levantada ✋' : 'Pedir a Palavra'}</span>
          </button>
        )}

        {/* BOTÃO APRESENTAR TELA (ORGANIZADOR) */}
        {isAdmin && (
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`px-5 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              isScreenSharing 
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-orange-600/20 animate-pulse' 
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-green-600/25'
            }`}
          >
            {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
            <span>{isScreenSharing ? 'Parar Apresentação' : 'Apresentar Tela'}</span>
          </button>
        )}
      </div>

    </div>
  );
}