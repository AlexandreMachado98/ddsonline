'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  Monitor, MonitorOff, Users, Hand, Crown, 
  Check, Sparkles, Wifi, WifiOff, Maximize, Minimize, Volume2,
  PhoneOff, Eye, EyeOff, LayoutGrid, Radio, ShieldCheck, Clock
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
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1);

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
      className={`relative h-44 sm:h-48 bg-slate-950 rounded-2xl sm:rounded-3xl overflow-hidden border transition-all duration-300 shadow-lg flex flex-col justify-between p-2.5 sm:p-3 ${
        participant.isHandRaised 
          ? 'border-amber-400 ring-4 ring-amber-400/20 bg-gradient-to-b from-amber-950/40 to-slate-950 scale-[1.02] z-20 shadow-amber-500/10' 
          : 'border-slate-800/90 hover:border-slate-700 bg-slate-950/90'
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
          <div className="flex flex-col items-center justify-center space-y-2 p-2">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-sm sm:text-base shadow-md transition-all ${
              participant.isHandRaised 
                ? 'bg-amber-500 text-slate-950 border-2 border-amber-300 shadow-amber-500/30' 
                : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
            }`}>
              {participant.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
              {participant.isVideoOff ? 'Câmera Desativada' : 'Ao Vivo'}
            </span>
          </div>
        )}
      </div>

      {/* TOPO: BADGE DE MÃO LEVANTADA OU PRESENÇA */}
      <div className="relative z-10 flex items-center justify-between">
        {participant.isHandRaised ? (
          <span className="bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] flex items-center gap-1 shadow-md animate-bounce">
            <Hand size={11} /> Pediu a Palavra
          </span>
        ) : (
          <span className="bg-slate-900/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1">
            <Check size={9} /> Presente
          </span>
        )}

        {participant.isMuted && (
          <span className="bg-red-500/20 text-red-400 p-1 rounded-lg border border-red-500/30 backdrop-blur-md">
            <MicOff size={11} />
          </span>
        )}
      </div>

      {/* RODAPÉ COM NOME E CONTROLES */}
      <div className="relative z-10 space-y-1">
        <div className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-white truncate">{participant.name}</p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 pt-0.5">
            {participant.isHandRaised && (
              <button
                type="button"
                onClick={() => onLowerHand(participant.peerId)}
                className="flex-1 py-1 px-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[9px] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title="Atender pedido de palavra"
              >
                <Hand size={9} /> Atender
              </button>
            )}

            <button
              type="button"
              onClick={() => onModerateMute(participant.peerId)}
              className={`flex-1 py-1 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                participant.isMuted 
                  ? 'bg-red-600 text-white' 
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300'
              }`}
              title={participant.isMuted ? 'Desmutar' : 'Silenciar'}
            >
              {participant.isMuted ? <MicOff size={10} /> : <Mic size={10} />}
            </button>

            <button
              type="button"
              onClick={() => onModerateVideo(participant.peerId)}
              className={`flex-1 py-1 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                participant.isVideoOff 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300'
              }`}
              title={participant.isVideoOff ? 'Permitir Câmera' : 'Cortar Câmera'}
            >
              {participant.isVideoOff ? <VideoOff size={10} /> : <VideoIcon size={10} />}
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
  const [isHostScreenSharing, setIsHostScreenSharing] = useState(false);
  const [showPip, setShowPip] = useState(true); // Controle de Miniatura do Apresentador
  const [hasMediaError, setHasMediaError] = useState(false);
  const [isMyHandRaised, setIsMyHandRaised] = useState(false);
  const [handRaiseAlert, setHandRaiseAlert] = useState<{ peerId: string; name: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Streams
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
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

  // Timer de Duração do DDS
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. LIMPEZA TOTAL DE MÍDIA
  const cleanupAllMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      screenStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    [localMainVideoRef, localPipVideoRef, localParticipantMosaicRef, screenShareVideoRef, organizerVideoRef].forEach(ref => {
      if (ref.current) {
        ref.current.srcObject = null;
      }
    });
  }, []);

  // 2. CARREGAR MOTOR WEBRTC (PEERJS)
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

  // 3. INICIALIZAR MÍDIA LOCAL
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
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      localStreamRef.current = stream;

      // Organizador: Conecta ao palco principal
      if (isAdmin && localMainVideoRef.current && !isScreenSharing) {
        localMainVideoRef.current.srcObject = stream;
        localMainVideoRef.current.muted = true;
        localMainVideoRef.current.play().catch(() => {});
      }
      if (isAdmin && localPipVideoRef.current) {
        localPipVideoRef.current.srcObject = stream;
        localPipVideoRef.current.muted = true;
        localPipVideoRef.current.play().catch(() => {});
      }

      // Participante: Conecta ao seu card no Mosaico
      if (!isAdmin && localParticipantMosaicRef.current) {
        localParticipantMosaicRef.current.srcObject = stream;
        localParticipantMosaicRef.current.muted = true;
        localParticipantMosaicRef.current.play().catch(() => {});
      }

      return stream;
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      setHasMediaError(true);
      return null;
    }
  }, [isAdmin, isScreenSharing]);

  // 4. LIMPEZA AO DESMONTAR
  useEffect(() => {
    return () => {
      cleanupAllMedia();
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
    };
  }, [cleanupAllMedia]);

  // 5. SINCRONIZAÇÃO DA TELA DO ORGANIZADOR
  useEffect(() => {
    if (isScreenSharing && screenStreamRef.current) {
      if (screenShareVideoRef.current) {
        screenShareVideoRef.current.srcObject = screenStreamRef.current;
        screenShareVideoRef.current.muted = true;
        screenShareVideoRef.current.playsInline = true;
        screenShareVideoRef.current.onloadedmetadata = () => {
          screenShareVideoRef.current?.play().catch(() => {});
        };
        screenShareVideoRef.current.play().catch(() => {});
      }
      if (localPipVideoRef.current && localStreamRef.current) {
        localPipVideoRef.current.srcObject = localStreamRef.current;
        localPipVideoRef.current.muted = true;
        localPipVideoRef.current.play().catch(() => {});
      }
    } else if (isAdmin && localMainVideoRef.current && localStreamRef.current) {
      localMainVideoRef.current.srcObject = localStreamRef.current;
      localMainVideoRef.current.muted = true;
      localMainVideoRef.current.play().catch(() => {});
    }
  }, [isScreenSharing, isAdmin]);

  // 6. SINCRONIZAÇÃO DO VÍDEO DO PARTICIPANTE NO MOSAICO
  useEffect(() => {
    if (!isAdmin && localParticipantMosaicRef.current && localStreamRef.current) {
      localParticipantMosaicRef.current.srcObject = localStreamRef.current;
      localParticipantMosaicRef.current.muted = true;
      localParticipantMosaicRef.current.play().catch(() => {});
    }
  }, [isAdmin, isVideoOff]);

  // 7. CONEXÃO WEBRTC PEER-TO-PEER
  useEffect(() => {
    let isMounted = true;

    async function startConference() {
      const stream = await initLocalMedia();
      const PeerClass = await loadPeerJs().catch(() => null);

      if (!PeerClass || !isMounted) return;

      if (isAdmin) {
        // MODO ORGANIZADOR (HOST)
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
          let currentOutStream: MediaStream | null = localStreamRef.current;

          if (isScreenSharing && screenStreamRef.current && localStreamRef.current) {
            const screenVid = screenStreamRef.current.getVideoTracks()[0];
            const micAud = localStreamRef.current.getAudioTracks()[0];
            const tracks: MediaStreamTrack[] = [];
            if (screenVid) tracks.push(screenVid);
            if (micAud) tracks.push(micAud);
            currentOutStream = new MediaStream(tracks);
          } else if (isScreenSharing && screenStreamRef.current) {
            currentOutStream = screenStreamRef.current;
          }

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
            if (data.type === 'SCREEN_SHARE_STATE') {
              setIsHostScreenSharing(Boolean(data.isSharing));
              if (organizerVideoRef.current && remoteOrganizerStream) {
                organizerVideoRef.current.srcObject = remoteOrganizerStream;
                organizerVideoRef.current.play().catch(() => {});
              }
            }
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
      cleanupAllMedia();
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
    };
  }, [cleanRoomId, hostPeerId, isAdmin, userName, initLocalMedia, loadPeerJs, cleanupAllMedia]);

  // 8. SINCRONIZA VÍDEO DO ORGANIZADOR NO PARTICIPANTE
  useEffect(() => {
    if (!isAdmin && remoteOrganizerStream && organizerVideoRef.current) {
      organizerVideoRef.current.srcObject = remoteOrganizerStream;
      organizerVideoRef.current.play().catch(() => {});

      const vTrack = remoteOrganizerStream.getVideoTracks()[0];
      if (vTrack) {
        vTrack.onunmute = () => {
          if (organizerVideoRef.current) {
            organizerVideoRef.current.play().catch(() => {});
          }
        };
      }
    }
  }, [isAdmin, remoteOrganizerStream, isHostScreenSharing]);

  // 9. APRESENTAÇÃO DE TELA COM ÁUDIO DO VÍDEO + VOZ DO INSTRUTOR MIXADOS
  const toggleScreenShare = async () => {
    if (!isAdmin) return;

    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      // CAPTURA VÍDEO (Compatível com Janela, Guia ou Monitor Inteiro) + ÁUDIO OPCIONAL
      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 60 },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 }
          },
          audio: true
        });
      } catch (displayErr) {
        // Fallback caso o navegador não suporte captura de áudio com a tela
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 60 }
          }
        });
      }

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const screenAudioTrack = screenStream.getAudioTracks()[0];

      // MIXER DE ÁUDIO (Voz do Instrutor + Som do Vídeo)
      let mixedAudioTrack: MediaStreamTrack | null = null;

      if (screenAudioTrack && localStreamRef.current) {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;

          const destination = audioCtx.createMediaStreamDestination();

          // Conecta o microfone do técnico
          const micAudioTrack = localStreamRef.current.getAudioTracks()[0];
          if (micAudioTrack) {
            const micStream = new MediaStream([micAudioTrack]);
            const micSource = audioCtx.createMediaStreamSource(micStream);
            micSource.connect(destination);
          }

          // Conecta o som do vídeo / apresentação
          const sysStream = new MediaStream([screenAudioTrack]);
          const sysSource = audioCtx.createMediaStreamSource(sysStream);
          sysSource.connect(destination);

          mixedAudioTrack = destination.stream.getAudioTracks()[0];
        } catch (mixErr) {
          console.warn("Mixer de áudio indisponível, usando áudio da tela direto:", mixErr);
          mixedAudioTrack = screenAudioTrack;
        }
      }

      // Substitui as trilhas de vídeo e áudio nos celulares dos colaboradores
      activeCalls.current.forEach((call) => {
        try {
          const pc = call.peerConnection;
          if (pc) {
            const senders = pc.getSenders();
            
            // Substitui Vídeo
            const videoSender = senders.find((s: any) => 
              (s.track && s.track.kind === 'video') || s.kind === 'video'
            );
            if (videoSender && screenVideoTrack) {
              videoSender.replaceTrack(screenVideoTrack);
            }

            // Substitui Áudio (com som do vídeo)
            if (mixedAudioTrack) {
              const audioSender = senders.find((s: any) => 
                (s.track && s.track.kind === 'audio') || s.kind === 'audio'
              );
              if (audioSender) {
                audioSender.replaceTrack(mixedAudioTrack);
              }
            }
          }
        } catch (err) {
          console.warn("Erro ao substituir track para peer:", err);
        }
      });

      // Notifica todos os participantes conectados via DataChannel
      participantConns.current.forEach((conn) => {
        if (conn && conn.open) {
          conn.send({ type: 'SCREEN_SHARE_STATE', isSharing: true });
        }
      });

      screenVideoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.warn("Compartilhamento cancelado ou não permitido:", err);
      setIsScreenSharing(false);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsScreenSharing(false);

    // Restaura a câmera e o microfone do organizador para todos
    if (localStreamRef.current) {
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      const micTrack = localStreamRef.current.getAudioTracks()[0];

      activeCalls.current.forEach((call) => {
        try {
          const pc = call.peerConnection;
          if (pc) {
            const senders = pc.getSenders();
            if (camTrack) {
              const videoSender = senders.find((s: any) => (s.track && s.track.kind === 'video') || s.kind === 'video');
              if (videoSender) videoSender.replaceTrack(camTrack);
            }
            if (micTrack) {
              const audioSender = senders.find((s: any) => (s.track && s.track.kind === 'audio') || s.kind === 'audio');
              if (audioSender) audioSender.replaceTrack(micTrack);
            }
          }
        } catch (err) {}
      });
    }

    // Notifica todos os participantes que o compartilhamento encerrou
    participantConns.current.forEach((conn) => {
      if (conn && conn.open) {
        conn.send({ type: 'SCREEN_SHARE_STATE', isSharing: false });
      }
    });
  };

  // 10. LEVANTAR A MÃO (PARTICIPANTE)
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

  // 11. MODERAÇÃO DO ORGANIZADOR
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

  // 12. CONTROLES DE ÁUDIO E VÍDEO LOCAL
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

  // 13. TELA CHEIA (FULLSCREEN)
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

  // 14. ORDENAÇÃO DO MOSAICO
  const sortedParticipants = [...remoteParticipants].sort((a, b) => {
    if (a.isHandRaised && !b.isHandRaised) return -1;
    if (!a.isHandRaised && b.isHandRaised) return 1;
    if (a.isHandRaised && b.isHandRaised) return (b.handRaisedAt || 0) - (a.handRaisedAt || 0);
    return 0;
  });

  const totalHandsRaised = remoteParticipants.filter(p => p.isHandRaised).length;

  return (
    <div className="bg-slate-900 border border-slate-800/90 rounded-3xl p-3 sm:p-5 space-y-4 sm:space-y-5 shadow-2xl relative overflow-hidden text-slate-100 font-sans">
      
      {/* BANNER DE NOTIFICAÇÃO DE MÃO LEVANTADA (ORGANIZADOR) */}
      {isAdmin && handRaiseAlert && (
        <div className="bg-amber-500 text-slate-950 p-3 sm:p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 animate-in slide-in-from-top-3 duration-300 border-2 border-amber-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-slate-950 text-amber-400 rounded-xl shrink-0">
              <Hand size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider">Pedido de Palavra!</p>
              <p className="text-xs sm:text-sm font-bold truncate"><strong>{handRaiseAlert.name}</strong> quer falar.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleLowerHand(handRaiseAlert.peerId)}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
          >
            Atender
          </button>
        </div>
      )}

      {/* HEADER DA SALA (TIMER, STATUS, CONTADOR DE PRESENTES) */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide flex items-center gap-1.5 truncate">
              <span>DDS Ao Vivo</span>
              <span className="text-slate-500 font-normal">•</span>
              <span className="font-mono text-emerald-400">{roomName.slice(0, 10)}</span>
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock size={10} className="text-slate-500" />
                <span className="font-mono">{formatElapsed(elapsedSeconds)}</span>
              </span>
              <span>•</span>
              {isConnected ? (
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <Wifi size={10} /> Conectado
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1 font-bold">
                  <WifiOff size={10} /> Conectando...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {totalHandsRaised > 0 && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-xl text-[10px] sm:text-xs font-black flex items-center gap-1 animate-pulse">
              <Hand size={12} /> {totalHandsRaised}
            </span>
          )}
          <span className="bg-slate-950 px-2.5 py-1 rounded-xl text-[11px] text-slate-300 font-bold border border-slate-800 flex items-center gap-1.5">
            <Users size={12} className="text-emerald-400" /> {remoteParticipants.length + 1}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PALCO PRINCIPAL (TRANSMISSÃO DO ORGANIZADOR / TELA COMPARTILHADA)      */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] sm:text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Crown size={14} className="text-amber-400 shrink-0" /> 
            {isAdmin 
              ? (isScreenSharing ? 'Sua Apresentação de Tela' : 'Sua Câmera (Instrutor)') 
              : (isHostScreenSharing ? 'Apresentação do Instrutor' : 'Transmissão do Instrutor')}
          </span>

          <div className="flex items-center gap-1.5">
            {isScreenSharing && (
              <button
                type="button"
                onClick={() => setShowPip(!showPip)}
                className="p-1 sm:px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title={showPip ? 'Ocultar Miniatura da Câmera (Modo Foco)' : 'Exibir Miniatura da Câmera'}
              >
                {showPip ? <EyeOff size={12} /> : <Eye size={12} />}
                <span className="hidden sm:inline">{showPip ? 'Foco na Tela' : 'Ver Câmera'}</span>
              </button>
            )}

            {/* BOTÃO TELA CHEIA */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1 sm:px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
              title={isFullscreen ? 'Sair da Tela Cheia' : 'Abrir em Tela Cheia'}
            >
              {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Normal' : 'Tela Cheia'}</span>
            </button>
          </div>
        </div>

        {/* CONTAINER DO PALCO COM PROPORÇÃO RESPONSIVA */}
        <div 
          ref={stageContainerRef}
          className="relative w-full aspect-video sm:max-h-[520px] bg-slate-950 rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl flex items-center justify-center"
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
                  className="w-full h-full object-contain"
                />
                
                {/* Badge de Transmissão de Tela */}
                <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-xl border border-emerald-500/30 flex items-center gap-1.5 z-10 shadow-lg">
                  <Monitor size={12} className="text-emerald-400 animate-pulse" />
                  <span className="text-[10px] sm:text-xs font-extrabold text-white">Transmitindo Tela em Alta Definição</span>
                </div>

                {/* Miniatura do Organizador (PiP Flutuante com Toggle) */}
                {showPip && (
                  <div className="absolute bottom-3 right-3 w-36 sm:w-52 aspect-video bg-slate-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border-2 border-emerald-500 z-20 transition-all">
                    <video
                      ref={localPipVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : 'block'}`}
                    />
                    {isVideoOff && (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500">
                        <VideoOff size={16} />
                        <span className="text-[9px] mt-0.5 font-bold">Câmera Pausada</span>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-1">
                      <Crown size={9} className="text-amber-400" /> Você
                    </div>
                  </div>
                )}
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
                  <div className="flex flex-col items-center justify-center text-slate-500 space-y-2 p-4 text-center">
                    <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
                      <VideoOff size={28} className="text-slate-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-300">Sua Câmera está Desativada</p>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white border border-slate-700/60 flex items-center gap-1.5">
                  <Crown size={12} className="text-amber-400" />
                  <span>{userName}</span>
                  <span className="text-[9px] text-emerald-400 font-black bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">Instrutor</span>
                </div>
              </div>
            )
          ) : (
            /* VISÃO DO PARTICIPANTE (COM STREAM DO INSTRUTOR) */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {remoteOrganizerStream ? (
                <video
                  ref={organizerVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 space-y-2.5 p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center animate-pulse">
                    <Crown size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">Aguardando o Instrutor...</h4>
                    <p className="text-[11px] text-slate-400">A transmissão ao vivo começará em instantes.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DOCK ERGONÔMICO DE CONTROLES INFERIORES (TOUCH & MOBILE-FIRST)          */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 py-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-2 shadow-inner">
        {/* Microfone */}
        <button
          type="button"
          onClick={toggleAudio}
          className={`p-3 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
            isAudioMuted
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/50'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
          }`}
          title={isAudioMuted ? 'Ativar Microfone' : 'Silenciar Microfone'}
        >
          {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />}
          <span className="hidden sm:inline">{isAudioMuted ? 'Mutado' : 'Microfone'}</span>
        </button>

        {/* Câmera */}
        <button
          type="button"
          onClick={toggleVideo}
          className={`p-3 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
            isVideoOff
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/50'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
          }`}
          title={isVideoOff ? 'Ligar Câmera' : 'Desligar Câmera'}
        >
          {isVideoOff ? <VideoOff size={16} /> : <VideoIcon size={16} />}
          <span className="hidden sm:inline">{isVideoOff ? 'Sem Vídeo' : 'Câmera'}</span>
        </button>

        {/* Compartilhamento de Tela (Exclusivo Instrutor) */}
        {isAdmin && (
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`p-3 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              isScreenSharing
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400 shadow-lg shadow-emerald-950/50'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
            title={isScreenSharing ? 'Parar Apresentação de Tela' : 'Apresentar Tela / Vídeo'}
          >
            {isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
            <span className="hidden sm:inline">{isScreenSharing ? 'Parar Tela' : 'Compartilhar Tela'}</span>
          </button>
        )}

        {/* Levantar a Mão (Participante) */}
        {!isAdmin && (
          <button
            type="button"
            onClick={toggleRaiseHand}
            className={`p-3 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              isMyHandRaised
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300 shadow-lg'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isMyHandRaised ? 'Baixar a Mão' : 'Pedir a Palavra'}
          >
            <Hand size={16} />
            <span className="hidden sm:inline">{isMyHandRaised ? 'Mão Levantada' : 'Pedir Palavra'}</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MOSAICO DINÂMICO DOS PARTICIPANTES (GRID MOBILE-FIRST)                 */}
      {/* ========================================================================= */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 px-1">
          <span className="text-[11px] sm:text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <LayoutGrid size={13} className="text-emerald-400" />
            <span>Mosaico da Equipe ({remoteParticipants.length + (isAdmin ? 0 : 1)})</span>
          </span>

          <span className="text-[10px] text-slate-400">
            {remoteParticipants.length === 0 ? 'Aguardando colaboradores...' : 'Todos online'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {/* Card do próprio participante caso seja colaborador */}
          {!isAdmin && (
            <div className="relative h-44 sm:h-48 bg-slate-950 rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-emerald-500/40 flex flex-col justify-between p-2.5 sm:p-3 shadow-lg">
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                <video
                  ref={localParticipantMosaicRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : 'block'}`}
                />
                {isVideoOff && (
                  <div className="flex flex-col items-center justify-center space-y-1 text-slate-500 p-2">
                    <VideoOff size={20} />
                    <span className="text-[9px] font-bold text-slate-400">Sua Câmera</span>
                  </div>
                )}
              </div>

              <div className="relative z-10 flex items-center justify-between">
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[9px] font-black">
                  VOCÊ
                </span>
                {isAudioMuted && (
                  <span className="bg-red-500/20 text-red-400 p-1 rounded-lg border border-red-500/30">
                    <MicOff size={10} />
                  </span>
                )}
              </div>

              <div className="relative z-10 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-800">
                <p className="text-[11px] font-bold text-white truncate">{userName} (Você)</p>
              </div>
            </div>
          )}

          {/* Cards dos outros participantes */}
          {sortedParticipants.map(participant => (
            <ParticipantVideoCard
              key={participant.peerId}
              participant={participant}
              isAdmin={Boolean(isAdmin)}
              onModerateMute={handleModerateMute}
              onModerateVideo={handleModerateVideo}
              onLowerHand={handleLowerHand}
            />
          ))}
        </div>
      </div>

    </div>
  );
}