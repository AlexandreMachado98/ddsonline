 'use client';

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, Smartphone, AlertCircle } from 'lucide-react';

interface SelfieCaptureProps {
  onConfirm: (imageSrc: string | null) => void;
}

export default function SelfieCapture({ onConfirm }: SelfieCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasCameraError, setHasCameraError] = useState(false);

  // Resolução flexível para evitar OverconstrainedError em qualquer celular
  const videoConstraints = {
    facingMode: 'user',
    width: { ideal: 640 },
    height: { ideal: 640 }
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

  // 2. Captura pela Câmera Nativa do Celular (Infalível em 100% dos aparelhos e no WhatsApp)
  const handleNativeCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const rawBase64 = reader.result as string;

      // Comprime a foto no navegador para carregar rápido no 4G/Starlink
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
    onConfirm(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center w-full space-y-3">
      
      {/* Quadro de Exibição da Foto / Câmera */}
      <div className="relative w-full max-w-[260px] overflow-hidden bg-black rounded-3xl shadow-lg aspect-square flex items-center justify-center border border-slate-700">
        {!capturedImage ? (
          !hasCameraError ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              mirrored={true}
              onUserMediaError={() => setHasCameraError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-4 text-center text-slate-400 space-y-2">
              <Smartphone size={32} className="mx-auto text-green-400" />
              <p className="text-xs font-semibold text-white">Usar Câmera do Aparelho</p>
              <p className="text-[10px] text-slate-400">Clique no botão abaixo para abrir a câmera nativa do seu celular.</p>
            </div>
          )
        ) : (
          <img
            src={capturedImage}
            alt="Biometria Facial"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Input invisível que aciona a Câmera Frontal do Celular */}
      <input
        type="file"
        accept="image/*"
        capture="user"
        ref={fileInputRef}
        onChange={handleNativeCameraCapture}
        className="hidden"
      />

      {/* Botões de Ação */}
      <div className="w-full max-w-[260px] space-y-2">
        {!capturedImage ? (
          <>
            {!hasCameraError ? (
              <button
                type="button"
                onClick={captureFromWebcam}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Camera size={16} /> Tirar Foto
              </button>
            ) : null}

            {/* Botão de Câmera Nativa (Garante que funcione em qualquer celular) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
            >
              <Smartphone size={14} className="text-green-400" />
              {hasCameraError ? 'Abrir Câmera do Celular' : 'Usar Câmera do Celular'}
            </button>
          </>
        ) : (
          <div className="w-full space-y-2">
            <div className="text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-1">
              <Check size={14} /> Biometria Facial Registrada
            </div>
            <button
              type="button"
              onClick={retake}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
            >
              <RefreshCw size={13} /> Tirar Outra Foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}