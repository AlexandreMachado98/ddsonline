 'use client';

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Check, Trash2 } from 'lucide-react';

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

  // Salva automaticamente assim que o usuário termina o traço com o dedo
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
    <div className="flex flex-col items-center w-full space-y-2">
      <div className="border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden w-full bg-white shadow-inner touch-none relative">
        <SignatureCanvas
          ref={sigCanvas}
          onEnd={handleStrokeEnd}
          penColor="black"
          canvasProps={{
            className: 'w-full h-44 sm:h-52 touch-none cursor-crosshair'
          }}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs font-medium">
            ✍️ Assine aqui com o dedo ou mouse
          </div>
        )}
      </div>

      <div className="flex items-center justify-between w-full px-1">
        <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
          {hasDrawn ? (
            <>
              <Check size={14} className="text-emerald-600" /> Assinatura Registrada
            </>
          ) : (
            <span className="text-slate-400 font-normal">Aguardando assinatura...</span>
          )}
        </span>

        {hasDrawn && (
          <button
            type="button"
            onClick={clearCanvas}
            className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Trash2 size={12} /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}