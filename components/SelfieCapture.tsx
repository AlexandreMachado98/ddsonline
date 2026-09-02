'use client';

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, Upload, AlertCircle, SwitchCamera, Image as ImageIcon } from 'lucide-react';

interface SelfieCaptureProps {
  onConfirm: (imageSrc: string | null) => void;
}

export default function SelfieCapture({ onConfirm }: SelfieCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoConstraints = {
    width: { ideal: 480 },
    height: { ideal: 480 },
    facingMode: facingMode
  };

  // Captura foto da webcam
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      onConfirm(imageSrc);
    }
  }, [webcamRef, onConfirm]);

  // Recomeça a captura
  const retake = () => {
    setCapturedImage(null);
    onConfirm(null);
  };

  // Alterna câmera frontal e traseira
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Fallback para envio de foto da galeria ou câmera nativa do celular
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCapturedImage(result);
        onConfirm(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col items-center w-full space-y-3">
      {/* Moldura da Câmera / Imagem */}
      <div className="relative w-full max-w-[280px] overflow-hidden bg-slate-950 rounded-3xl shadow-xl aspect-square flex items-center justify-center border-2 border-slate-700/80 group">
        {!capturedImage ? (
          !cameraError ? (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                mirrored={facingMode === 'user'}
                onUserMediaError={() => setCameraError(true)}
                className="w-full h-full object-cover"
              />

              {/* Guia Visual Oval de Rosto */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-36 h-48 border-2 border-dashed border-white/40 rounded-full"></div>
              </div>

              {/* Botão de Alternar Câmera no canto */}
              <button
                type="button"
                onClick={toggleFacingMode}
                title="Alternar Câmera Frontal / Traseira"
                className="absolute top-2.5 right-2.5 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl backdrop-blur-md transition-all border border-white/10 active:scale-95"
              >
                <SwitchCamera size={16} />
              </button>
            </>
          ) : (
            /* Fallback se a câmera do navegador estiver bloqueada */
            <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
              <AlertCircle size={32} className="text-amber-400" />
              <p className="text-xs font-bold text-slate-200">Câmera bloqueada</p>
              <p className="text-[11px] text-slate-400 leading-tight">
                Use o botão abaixo para enviar uma foto do seu rosto.
              </p>
            </div>
          )
        ) : (
          <img
            src={capturedImage}
            alt="Selfie do colaborador"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Input oculto para upload de arquivo fallback */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="user"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Botões de Ação */}
      <div className="w-full max-w-[280px] flex flex-col gap-2">
        {!capturedImage ? (
          <>
            {!cameraError ? (
              <button
                type="button"
                onClick={capture}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/25 min-h-[44px]"
              >
                <Camera size={16} /> Tirar Foto do Rosto
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-semibold text-xs rounded-2xl flex items-center justify-center gap-2 transition-colors border border-slate-700 min-h-[44px]"
            >
              <Upload size={14} className="text-blue-400" /> Escolher Foto do Celular
            </button>
          </>
        ) : (
          <div className="w-full space-y-2 animate-in fade-in duration-200">
            <div className="bg-emerald-500/15 border border-emerald-500/30 p-2.5 rounded-2xl text-[11px] text-emerald-300 font-bold flex items-center justify-center gap-1.5 shadow-sm">
              <Check size={16} className="text-emerald-400" /> Foto Biometria Registrada
            </div>
            <button
              type="button"
              onClick={retake}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700 min-h-[44px]"
            >
              <RefreshCw size={14} /> Tirar Outra Foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}