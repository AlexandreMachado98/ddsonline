'use client';

import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Check, Trash2, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave?: (signatureDataUrl: string | null) => void;
  onConfirm?: (signatureDataUrl: string | null) => void;
}

export default function SignaturePad({ onSave, onConfirm }: SignaturePadProps) {
  const notifyChange = (dataUrl: string | null) => {
    lastSignatureRef.current = dataUrl;
    if (onSave) onSave(dataUrl);
    if (onConfirm) onConfirm(dataUrl);
  };
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastSignatureRef = useRef<string | null>(null);
  const lastWidthRef = useRef<number>(typeof window !== 'undefined' ? window.innerWidth : 0);

  // Protege a assinatura contra limpeza acidental em caso de rotação de tela no celular
  useEffect(() => {
    const handleResize = () => {
      const currentWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
      // Se apenas a altura mudou (abertura do teclado virtual do celular), ignora para não roubar foco nem re-renderizar
      if (Math.abs(currentWidth - lastWidthRef.current) < 15) {
        return;
      }
      lastWidthRef.current = currentWidth;

      if (lastSignatureRef.current && sigCanvas.current) {
        const saved = lastSignatureRef.current;
        setTimeout(() => {
          if (sigCanvas.current && sigCanvas.current.isEmpty()) {
            try {
              sigCanvas.current.fromDataURL(saved);
              setHasDrawn(true);
            } catch (e) {
              console.warn('Erro ao restaurar assinatura após rotação:', e);
            }
          }
        }, 150);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const clearCanvas = () => {
    sigCanvas.current?.clear();
    setHasDrawn(false);
    notifyChange(null);
  };

  // Salva automaticamente assim que o usuário termina o traço com proteção contra falhas de recorte
  const handleStrokeEnd = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;

    try {
      const trimmed = sigCanvas.current.getTrimmedCanvas();
      if (trimmed && trimmed.width > 0 && trimmed.height > 0) {
        const dataUrl = trimmed.toDataURL('image/png');
        if (dataUrl) {
          setHasDrawn(true);
          notifyChange(dataUrl);
          return;
        }
      }
    } catch (err) {
      console.warn('Falha no recorte getTrimmedCanvas, utilizando fallback completo:', err);
    }

    try {
      const rawCanvas = sigCanvas.current.getCanvas();
      if (rawCanvas) {
        const dataUrl = rawCanvas.toDataURL('image/png');
        if (dataUrl) {
          setHasDrawn(true);
          notifyChange(dataUrl);
        }
      }
    } catch (err2) {
      console.error('Falha ao serializar assinatura:', err2);
    }
  };

  return (
    <div className="flex flex-col items-center w-full space-y-2.5">
      <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-3xl overflow-hidden w-full bg-slate-950 shadow-inner touch-none relative transition-colors">
        <SignatureCanvas
          ref={sigCanvas}
          onEnd={handleStrokeEnd}
          penColor="#38bdf8" // Azul ciano de alta visibilidade e contraste
          canvasProps={{
            className: 'w-full h-40 sm:h-48 touch-none cursor-crosshair'
          }}
        />

        {/* Linha guia de assinatura */}
        <div className="absolute bottom-6 left-6 right-6 border-b border-slate-800/80 pointer-events-none"></div>

        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500 text-xs font-medium gap-1.5 select-none">
            <PenTool size={14} className="text-blue-400 opacity-60" />
            <span>Assine aqui com o dedo ou mouse</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between w-full px-1 pt-0.5">
        <span className="text-[11px] font-semibold flex items-center gap-1">
          {hasDrawn ? (
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <Check size={14} className="text-emerald-400" /> Assinatura Digital Registrada
            </span>
          ) : (
            <span className="text-slate-500 font-normal">Aguardando traço na tela...</span>
          )}
        </span>

        {hasDrawn && (
          <button
            type="button"
            onClick={clearCanvas}
            className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3.5 py-2 rounded-xl transition-all active:scale-95 min-h-[40px]"
          >
            <Trash2 size={13} /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}