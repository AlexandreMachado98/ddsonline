 'use client';

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check } from 'lucide-react';

interface SelfieCaptureProps {
  onConfirm: (imageSrc: string | null) => void;
}

export default function SelfieCapture({ onConfirm }: SelfieCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const videoConstraints = {
    width: 400,
    height: 400,
    facingMode: "user"
  };

  // Salva a selfie na hora em que tira a foto
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      onConfirm(imageSrc);
    }
  }, [webcamRef, onConfirm]);

  const retake = () => {
    setCapturedImage(null);
    onConfirm(null);
  };

  return (
    <div className="flex flex-col items-center w-full space-y-3">
      <div className="relative w-full max-w-[260px] overflow-hidden bg-black rounded-2xl shadow-md aspect-square flex items-center justify-center border-2 border-slate-200">
        {!capturedImage ? (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            mirrored={true}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={capturedImage}
            alt="Selfie capturada"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="w-full max-w-[260px] flex gap-2">
        {!capturedImage ? (
          <button
            type="button"
            onClick={capture}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <Camera size={16} /> Tirar Foto
          </button>
        ) : (
          <div className="w-full space-y-2">
            <div className="text-[11px] text-emerald-600 font-bold flex items-center justify-center gap-1">
              <Check size={14} /> Foto Capturada com Sucesso
            </div>
            <button
              type="button"
              onClick={retake}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw size={13} /> Tirar Outra Foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}