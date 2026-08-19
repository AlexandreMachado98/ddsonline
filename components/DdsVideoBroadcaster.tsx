'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Video, VideoOff, Square, Circle, Download, Sparkles, Wifi, FlipHorizontal } from 'lucide-react';

export default function DdsVideoBroadcaster() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [resolution, setResolution] = useState<'480p' | '720p'>('480p');
  const [isMirrored, setIsMirrored] = useState(true);

  const startCamera = useCallback(async (selectedRes = resolution) => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const isHd = selectedRes === '720p';

      const constraints = {
        video: {
          width: { ideal: isHd ? 1280 : 640 },
          height: { ideal: isHd ? 720 : 480 },
          frameRate: { ideal: isHd ? 30 : 24 }
        },
        audio: true
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      alert("Não foi possível acessar a câmera ou microfone. Verifique as permissões.");
    }
  }, [resolution, stream]);

  const handleResolutionChange = (newRes: '480p' | '720p') => {
    if (isRecording) {
      alert("Não é possível alterar a qualidade durante uma gravação.");
      return;
    }
    setResolution(newRes);
    if (isCameraActive) {
      startCamera(newRes);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  };

  const startRecording = () => {
    if (!stream) return;

    setRecordedChunks([]);
    setVideoUrl(null);
    setRecordingTime(0);

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8,opus'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    };

    mediaRecorder.onstop = () => {
      setIsRecording(false);
    };

    mediaRecorder.start(1000);
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording && recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    }
  }, [isRecording, recordedChunks]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Video className="text-blue-600" size={20} />
          <h3 className="font-bold text-slate-800 text-sm">Transmissão de Vídeo</h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            title="Alternar Modo Espelho"
            className={`p-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1 ${
              isMirrored
                ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            <FlipHorizontal size={14} />
            <span className="hidden sm:inline">Espelho</span>
          </button>

          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => handleResolutionChange('480p')}
              disabled={isRecording}
              className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 ${
                resolution === '480p'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Wifi size={12} /> 480p
            </button>
            
            <button
              onClick={() => handleResolutionChange('720p')}
              disabled={isRecording}
              className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 ${
                resolution === '720p'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles size={12} /> 720p
            </button>
          </div>
        </div>
      </div>

      <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
        {videoUrl && !isCameraActive ? (
          <video src={videoUrl} controls className="w-full h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-transform duration-200 ${
              isMirrored ? '-scale-x-100' : 'scale-x-100'
            } ${!isCameraActive ? 'hidden' : ''}`}
          />
        )}

        {!isCameraActive && !videoUrl && (
          <div className="text-center p-6 text-slate-400">
            <VideoOff size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">Câmera desativada</p>
          </div>
        )}

        {isCameraActive && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/20">
            {resolution === '720p' ? '1280x720 (HD)' : '640x480 (Econômico)'}
          </div>
        )}

        {isRecording && (
          <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-lg animate-pulse">
            <Circle size={10} className="fill-white" />
            REC {formatTime(recordingTime)}
          </div>
        )}
      </div>

      <div className="mt-4 w-full flex flex-wrap gap-2">
        {!isCameraActive ? (
          <button
            onClick={() => startCamera(resolution)}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <Video size={16} /> Ligar Câmera ({resolution})
          </button>
        ) : (
          <>
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Circle size={14} className="fill-white" /> Iniciar Gravação
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm animate-bounce"
              >
                <Square size={14} className="fill-white" /> Parar Gravação
              </button>
            )}

            <button
              onClick={stopCamera}
              disabled={isRecording}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              Desligar
            </button>
          </>
        )}

        {videoUrl && (
          <a
            href={videoUrl}
            download={`DDS_${resolution}_${new Date().toISOString().slice(0, 10)}.webm`}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm mt-1"
          >
            <Download size={16} /> Baixar Vídeo ({resolution})
          </a>
        )}
      </div>
    </div>
  );
}