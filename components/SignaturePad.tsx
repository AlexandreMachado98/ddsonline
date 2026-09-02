'use client';

import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Check, Trash2, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string | null) => void;
}

export default function SignaturePad({ onSave }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const clearCanvas = () => {
    sigCanvas.current?.clear();
    setHasDrawn(false);
    onSave(null);
  };

  // Salva automaticamente assim que o usuário termina o traço
  const handleStrokeEnd = () => {
    if (!sigCanvas.current?.isEmpty()) {
      const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
      if (dataUrl) {
        setHasDrawn(true);
        onSave(dataUrl);
      }
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

      <div className="flex items-center justify-between w-full px-1">
        <span className="text-[11px] font-semibold flex items-center gap-1">
          {hasDrawn ? (
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <Check size={14} className="text-emerald-400" /> Assinatura Digital Registrada
            </span>
          ) : (
            <span className="text-slate-500 font-normal">Aguardando traço...</span>
          )}
        </span>

        {hasDrawn && (
          <button
            type="button"
            onClick={clearCanvas}
            className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-xl transition-all active:scale-95"
          >
            <Trash2 size={12} /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}