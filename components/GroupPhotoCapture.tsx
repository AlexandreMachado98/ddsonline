'use client';

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, Trash2, SwitchCamera, Check, Image as ImageIcon, Users, AlertCircle } from 'lucide-react';

interface GroupPhotoCaptureProps {
  initialPhoto?: string | null;
  onPhotoChange: (photoDataUrl: string | null) => void;
}

export default function GroupPhotoCapture({ initialPhoto, onPhotoChange }: GroupPhotoCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(initialPhoto || null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment'); // Câmera traseira por padrão para foto do grupo
  const [cameraError, setCameraError] = useState(false);

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: facingMode
  };

  // Redimensiona e comprime imagens muito pesadas mantendo a proporção exata
  const compressImage = (dataUrl: string, callback: (compressed: string) => void) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDimension = 1200;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        callback(compressedDataUrl);
      } else {
        callback(dataUrl);
      }
    };
    img.src = dataUrl;
  };

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      compressImage(imageSrc, (compressed) => {
        setPhoto(compressed);
        setIsCameraOpen(false);
        onPhotoChange(compressed);
      });
    }
  }, [webcamRef, onPhotoChange]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const rawResult = reader.result as string;
        compressImage(rawResult, (compressed) => {
          setPhoto(compressed);
          setIsCameraOpen(false);
          onPhotoChange(compressed);
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    setPhoto(null);
    setIsCameraOpen(false);
    onPhotoChange(null);
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="w-full space-y-3 font-sans">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* 1. SE JÁ EXISTIR FOTO */}
      {photo ? (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="relative w-full aspect-video sm:aspect-[16/9] max-h-56 bg-slate-950 rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-xl flex items-center justify-center">
            <img
              src={photo}
              alt="Foto em Grupo do DDS"
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2.5 left-2.5 bg-emerald-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-1 shadow-md">
              <Check size={12} /> Foto em Grupo Vinculada
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              <Camera size={14} className="text-blue-400" /> Tirar Outra Foto
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              <Upload size={14} className="text-blue-400" /> Trocar Imagem
            </button>

            <button
              type="button"
              onClick={handleRemove}
              className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors border border-red-500/20 flex items-center justify-center min-h-[40px] min-w-[40px]"
              title="Remover Foto"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : isCameraOpen ? (
        /* 2. CÂMERA ABERTA PARA TIRAR A FOTO */
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="relative w-full aspect-video max-h-64 bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-xl flex items-center justify-center">
            {!cameraError ? (
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
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title="Alternar Câmera"
                  className="absolute top-2.5 right-2.5 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl backdrop-blur-md border border-white/10"
                >
                  <SwitchCamera size={16} />
                </button>
              </>
            ) : (
              <div className="p-4 text-center text-slate-400 space-y-1">
                <AlertCircle size={28} className="mx-auto text-amber-400" />
                <p className="text-xs font-bold text-slate-200">Câmera indisponível</p>
                <p className="text-[11px] text-slate-500">Selecione uma foto do seu aparelho abaixo.</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!cameraError && (
              <button
                type="button"
                onClick={handleCapture}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Camera size={16} /> Capturar Foto da Equipe
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Upload size={14} className="text-blue-400" /> Do Aparelho
            </button>

            <button
              type="button"
              onClick={() => setIsCameraOpen(false)}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs rounded-xl border border-slate-700 min-h-[44px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        /* 3. ESTADO VAZIO / BOTÕES DE INSERÇÃO */
        <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-3xl p-5 text-center bg-slate-950/40 space-y-3 transition-colors">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl inline-flex border border-blue-500/20">
            <Users size={24} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">Foto Coletiva da Equipe (Opcional)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tire uma foto do grupo reunido para anexar como evidência no relatório PDF
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 min-h-[40px]"
            >
              <Camera size={14} /> Abrir Câmera
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 min-h-[40px]"
            >
              <Upload size={14} className="text-blue-400" /> Enviar da Galeria
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
