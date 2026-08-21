 'use client';

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, Smartphone, CameraOff } from 'lucide-react';

interface SelfieCaptureProps {
  onConfirm: (imageSrc: string | null) => void;
}

export default function SelfieCapture({ onConfirm }: SelfieCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasCameraError, setHasCameraError] = useState(false);

  // Configuração simples para garantir que abra em qualquer celular
  const videoConstraints = {
    facingMode: 'user'
  };

  // 1. Captura pela Webcam ao vivo
  const captureFromWebcam = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        onConfirm(imageSrc);
      }
    }
  }, [webcamRef, onConfirm]);

  // 2. Captura pela Câmera Nativa do Celular / Galeria
  const handleNativeCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const rawBase64 = reader.result as string;

      // Comprime a foto no navegador para carregar rápido
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setCapturedImage(compressed);
          onConfirm(compressed);
        }
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  const retake = () => {
    setCapturedImage(null);
    setHasCameraError(false);
    onConfirm(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center w-full space-y-4">
      
      {/* Quadro de Exibição da Foto / Câmera */}
      <div className="relative w-full max-w-[260px] overflow-hidden bg-slate-950 rounded-3xl shadow-lg aspect-square flex items-center justify-center border border-slate-700">
        
        {!capturedImage ? (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              mirrored={true}
              onUserMediaError={() => setHasCameraError(true)}
              className="w-full h-full object-cover"
            />

            {/* Aviso visual caso a câmera ao vivo não seja autorizada pelo navegador */}
            {hasCameraError && (
              <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-4 text-center z-10 space-y-2">
                <CameraOff size={32} className="text-slate-600" />
                <p className="text-xs font-bold text-slate-300">Câmera indisponível</p>
                <p className="text-[10px] text-slate-500">O navegador bloqueou a câmera ao vivo. Use o botão do celular abaixo.</p>
              </div>
            )}
          </>
        ) : (
          <img
            src={capturedImage}
            alt="Biometria Facial"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Input invisível que aciona a Câmera Frontal Nativa do Celular */}
      <input
        type="file"
        accept="image/*"
        capture="user"
        ref={fileInputRef}
        onChange={handleNativeCameraCapture}
        className="hidden"
      />

      {/* Botões de Ação */}
      <div className="w-full max-w-[260px] flex flex-col gap-2.5">
        {!capturedImage ? (
          <>
            {/* 1. Botão Câmera Ao Vivo (Fica bloqueado se der erro, mas continua na tela) */}
            <button
              type="button"
              onClick={captureFromWebcam}
              disabled={hasCameraError}
              className={`w-full py-3.5 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${
                hasCameraError 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white active:scale-95'
              }`}
            >
              <Camera size={16} /> Capturar (Ao Vivo)
            </button>

            <div className="flex items-center gap-2 w-full">
              <div className="h-[1px] bg-slate-800 flex-1"></div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">OU</span>
              <div className="h-[1px] bg-slate-800 flex-1"></div>
            </div>

            {/* 2. Botão Câmera Nativa do Celular (SEMPRE VISÍVEL) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-green-400 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700 shadow-sm"
            >
              <Smartphone size={16} /> Abrir Câmera do Aparelho
            </button>
          </>
        ) : (
          <div className="w-full space-y-3">
            <div className="text-xs text-green-400 font-bold flex items-center justify-center gap-1 bg-green-500/10 py-2 rounded-xl border border-green-500/20">
              <Check size={16} /> Biometria Facial Registrada
            </div>
            <button
              type="button"
              onClick={retake}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
            >
              <RefreshCw size={14} /> Tirar Outra Foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}