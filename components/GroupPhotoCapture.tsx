'use client';

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, Trash2, SwitchCamera, Check, Image as ImageIcon, Users, AlertCircle, Plus, Eye, X } from 'lucide-react';

interface GroupPhotoCaptureProps {
  initialPhotos?: string[] | string | null;
  initialPhoto?: string | null;
  onPhotosChange?: (photos: string[]) => void;
  onPhotoChange?: (photoDataUrl: string | null) => void;
}

export function parseGroupPhotos(groupPhoto?: string | string[] | null): string[] {
  if (!groupPhoto) return [];
  if (Array.isArray(groupPhoto)) return groupPhoto.filter((p): p is string => typeof p === 'string' && p.length > 50);
  if (typeof groupPhoto !== 'string') return [];
  const trimmed = groupPhoto.trim();
  if (!trimmed || trimmed.length < 50) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((p: any): p is string => typeof p === 'string' && p.length > 50);
      }
    } catch (e) {}
  }
  return [trimmed];
}

export function serializeGroupPhotos(photos: string[]): string | null {
  const valid = photos.filter(p => typeof p === 'string' && p.length > 50);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];
  return JSON.stringify(valid);
}

export default function GroupPhotoCapture({ initialPhotos, initialPhoto, onPhotosChange, onPhotoChange }: GroupPhotoCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialList = parseGroupPhotos(initialPhotos || initialPhoto);
  const [photos, setPhotos] = useState<string[]>(initialList);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: facingMode
  };

  // Redimensiona e comprime imagens mantendo proporção e qualidade
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

  const updatePhotosList = (newPhotos: string[]) => {
    setPhotos(newPhotos);
    if (onPhotosChange) {
      onPhotosChange(newPhotos);
    }
    if (onPhotoChange) {
      onPhotoChange(newPhotos.length > 0 ? newPhotos[0] : null);
    }
  };

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      compressImage(imageSrc, (compressed) => {
        const updated = [...photos, compressed];
        updatePhotosList(updated);
        setIsCameraOpen(false);
      });
    }
  }, [webcamRef, photos]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    let processedCount = 0;
    const newCompressedList: string[] = [];

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const rawResult = reader.result as string;
        compressImage(rawResult, (compressed) => {
          newCompressedList.push(compressed);
          processedCount++;
          if (processedCount === fileList.length) {
            const updated = [...photos, ...newCompressedList];
            updatePhotosList(updated);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveOne = (indexToRemove: number) => {
    const updated = photos.filter((_, idx) => idx !== indexToRemove);
    updatePhotosList(updated);
  };

  const handleClearAll = () => {
    updatePhotosList([]);
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
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Modal de Zoom da Foto */}
      {zoomPhoto && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button 
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-red-400 transition-colors"
            >
              <X size={24} />
            </button>
            <img 
              src={zoomPhoto} 
              alt="Foto Ampliada" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* CÂMERA ABERTA */}
      {isCameraOpen && (
        <div className="space-y-3 animate-in fade-in duration-200 bg-slate-950 p-4 rounded-3xl border border-slate-800">
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
                <p className="text-[11px] text-slate-500">Selecione fotos do seu aparelho abaixo.</p>
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
                <Camera size={16} /> Tirar Foto da Equipe
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCameraOpen(false)}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs rounded-xl border border-slate-700 min-h-[44px]"
            >
              Fechar Câmera
            </button>
          </div>
        </div>
      )}

      {/* GALERIA DE FOTOS REGISTRADAS */}
      {photos.length > 0 ? (
        <div className="space-y-3 bg-slate-950/60 border border-slate-800/90 rounded-3xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Users size={16} />
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">Fotos da Equipe Registradas</h4>
                <p className="text-[10px] text-emerald-400 font-medium">
                  {photos.length} {photos.length === 1 ? 'foto anexada' : 'fotos anexadas'} • Serão organizadas no PDF
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-red-400 hover:text-red-300 font-bold hover:underline"
            >
              Remover todas
            </button>
          </div>

          {/* Grid de Miniaturas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {photos.map((p, idx) => (
              <div 
                key={idx}
                className="group relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-emerald-500/50 shadow-sm transition-all"
              >
                <img 
                  src={p} 
                  alt={`Foto da Equipe #${idx + 1}`} 
                  className="w-full h-full object-cover"
                />
                
                <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  #{idx + 1}
                </span>

                {/* Ações na foto */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoomPhoto(p)}
                    className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-md transition-colors"
                    title="Ampliar Foto"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveOne(idx)}
                    className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-md transition-colors"
                    title="Excluir Foto"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Botões para adicionar mais fotos */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-1.5 min-h-[38px]"
            >
              <Camera size={14} className="text-blue-400" /> Tirar Mais Uma Foto
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-1.5 min-h-[38px]"
            >
              <Plus size={14} className="text-emerald-400" /> Adicionar da Galeria
            </button>
          </div>
        </div>
      ) : !isCameraOpen && (
        /* ESTADO VAZIO */
        <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-3xl p-5 text-center bg-slate-950/40 space-y-3 transition-colors">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl inline-flex border border-blue-500/20">
            <Users size={24} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">Fotos da Equipe (Opcional)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Adicione quantas fotos desejar do grupo reunido para comprovação na ata em PDF
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
              <Upload size={14} className="text-blue-400" /> Adicionar Fotos (Múltiplas)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
