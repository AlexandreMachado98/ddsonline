'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, ZoomIn, ZoomOut, Maximize2, RotateCcw, 
  ChevronLeft, ChevronRight, Loader2, AlertCircle, 
  Download, FileText, ExternalLink, HelpCircle
} from 'lucide-react';

export interface LightboxMediaItem {
  id?: string;
  url: string;
  title?: string;
  description?: string | null;
  mimeType?: string;
  fileSize?: number;
}

interface MediaLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  items: LightboxMediaItem[];
  initialIndex?: number;
}

export default function MediaLightbox({
  isOpen,
  onClose,
  items = [],
  initialIndex = 0
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Referências para cálculos de gestos e arrasto
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Estados de arrasto (drag/pan)
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [isCursorGrabbing, setIsCursorGrabbing] = useState(false);

  // Estados de Pinch-to-Zoom (2 dedos no mobile)
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);

  // Estados de Duplo Toque (Mobile Double-Tap)
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  // Touch swipe horizontal para trocar de foto quando zoom === 1
  const touchStartSwipeRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Atualiza índice caso initialIndex mude
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)));
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsLoading(true);
      setHasError(false);
    }
  }, [isOpen, initialIndex, items.length]);

  // Reseta zoom e pan ao mudar de slide
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsLoading(true);
    setHasError(false);
  }, [currentIndex]);

  const currentItem = items[currentIndex];
  const isPdf = currentItem?.mimeType === 'application/pdf' || currentItem?.url?.startsWith('data:application/pdf') || currentItem?.title?.toLowerCase().endsWith('.pdf');
  const hasMultiple = items.length > 1;

  // Limite de segurança de zoom: 1x a 4x
  const minZoom = 1;
  const maxZoom = 4;

  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const next = Math.min(maxZoom, Number((prev + 0.5).toFixed(1)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const next = Math.max(minZoom, Number((prev - 0.5).toFixed(1)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
  }, [items.length]);

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
  }, [items.length]);

  // =========================================================================
  // 1. GESTÃO DO BOTÃO VOLTAR DO ANDROID / PWA (HISTORY API)
  // =========================================================================
  useEffect(() => {
    if (!isOpen) return;

    // Empurra um estado no histórico para capturar o botão Voltar do dispositivo
    const historyState = { ddsMediaLightbox: true };
    window.history.pushState(historyState, '');

    const handlePopState = (event: PopStateEvent) => {
      // Se o usuário apertou o botão voltar do Android, fecha o modal sem sair do DDS
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Se fechou programaticamente (botão X ou ESC) e o estado ainda estiver no topo, volta o histórico
      if (window.history.state && window.history.state.ddsMediaLightbox) {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);

  // =========================================================================
  // 2. ACESSIBILIDADE E TECLADO (ESC, SETAS, FOCO)
  // =========================================================================
  useEffect(() => {
    if (!isOpen) return;

    // Trava scroll do body enquanto aberto
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Foco automático no botão de fechar para leitores de tela
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && zoom === 1) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && zoom === 1) {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleResetZoom, zoom]);

  // =========================================================================
  // 3. ZOOM VIA SCROLL DO MOUSE (DESKTOP WHEEL)
  // =========================================================================
  const handleWheel = (e: React.WheelEvent) => {
    if (isPdf) return;
    e.stopPropagation();

    // Rolar para cima = Zoom in; Rolar para baixo = Zoom out
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(maxZoom, Number((prev + 0.25).toFixed(2))));
    } else {
      setZoom(prev => {
        const next = Math.max(minZoom, Number((prev - 0.25).toFixed(2)));
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // =========================================================================
  // 4. ARRASTO COM MOUSE (DESKTOP PAN)
  // =========================================================================
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1 || isPdf) return;
    if (e.button !== 0) return; // apenas botão esquerdo

    e.preventDefault();
    isDraggingRef.current = true;
    setIsCursorGrabbing(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || zoom <= 1) return;
    e.preventDefault();

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    setPan({
      x: dragStartRef.current.panX + deltaX,
      y: dragStartRef.current.panY + deltaY
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsCursorGrabbing(false);
  };

  // =========================================================================
  // 5. GESTOS TOUCH NO MOBILE (PINCH-TO-ZOOM, DUPLO TOQUE, PAN E SWIPE)
  // =========================================================================
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isPdf) return;

    // A. DOIS DEDOS: PINCH TO ZOOM
    if (e.touches.length === 2) {
      pinchStartDistRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      pinchStartZoomRef.current = zoom;
      isDraggingRef.current = false;
      return;
    }

    // B. UM DEDO: PAN (SE ZOOM > 1) OU SWIPE / DUPLO TOQUE
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      const lastTap = lastTapRef.current;

      // Detecção de Duplo Toque (< 300ms e proximidade de 25px)
      if (now - lastTap.time < 300 && Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < 25) {
        if (zoom > 1) {
          handleResetZoom();
        } else {
          setZoom(2.2);
        }
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        return;
      }
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };

      if (zoom > 1) {
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          panX: pan.x,
          panY: pan.y
        };
      } else {
        // Guarda posição para possível swipe de troca de slide
        touchStartSwipeRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: now
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPdf) return;

    // A. Processando Pinch-to-Zoom
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
      const scaleFactor = currentDist / pinchStartDistRef.current;
      const newZoom = Math.min(maxZoom, Math.max(minZoom, pinchStartZoomRef.current * scaleFactor));
      setZoom(Number(newZoom.toFixed(2)));
      if (newZoom === 1) setPan({ x: 0, y: 0 });
      return;
    }

    // B. Processando Pan de 1 dedo
    if (e.touches.length === 1 && isDraggingRef.current && zoom > 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;

      setPan({
        x: dragStartRef.current.panX + deltaX,
        y: dragStartRef.current.panY + deltaY
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    pinchStartDistRef.current = null;
    isDraggingRef.current = false;

    // Detecção de Swipe horizontal para fotos quando zoom === 1
    if (zoom === 1 && touchStartSwipeRef.current && e.changedTouches.length > 0 && hasMultiple) {
      const endTouch = e.changedTouches[0];
      const dx = endTouch.clientX - touchStartSwipeRef.current.x;
      const dy = endTouch.clientY - touchStartSwipeRef.current.y;
      const dt = Date.now() - touchStartSwipeRef.current.time;

      // Se foi um deslize horizontal de pelo menos 45px em menos de 450ms
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 450) {
        if (dx < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }
    touchStartSwipeRef.current = null;
  };

  // Toggle de zoom ao clicar diretamente na imagem (desktop)
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom === 1) {
      setZoom(2.0);
    } else {
      handleResetZoom();
    }
  };

  if (!isOpen || !currentItem) return null;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador ampliado de imagem"
      className="fixed inset-0 z-[99999] flex flex-col bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-hidden touch-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 1. BARRA SUPERIOR (HEADER) */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-30 shadow-lg">
        {/* Título e Indicador de Slides */}
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {hasMultiple && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black shrink-0 font-mono">
              {currentIndex + 1} de {items.length}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-sm">
              {currentItem.title || `Material do DDS #${currentIndex + 1}`}
            </h3>
            {currentItem.description && (
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate italic">
                {currentItem.description}
              </p>
            )}
          </div>
        </div>

        {/* Ações da Barra Superior */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Botão Baixar */}
          {currentItem.url && (
            <a
              href={currentItem.url}
              download={currentItem.title || 'material-dds'}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer border border-transparent hover:border-slate-700"
              title="Baixar imagem original"
              aria-label="Baixar arquivo original"
            >
              <Download size={18} />
            </a>
          )}

          {/* Botão Fechar X com área de toque mínima de 44x44px */}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="p-2.5 bg-slate-800/80 hover:bg-red-500/20 text-slate-200 hover:text-red-300 rounded-xl border border-slate-700 hover:border-red-500/40 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
            title="Fechar visualização (ESC)"
            aria-label="Fechar visualização"
          >
            <X size={22} className="stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL DE VISUALIZAÇÃO DA MÍDIA */}
      <div 
        ref={containerRef}
        onClick={(e) => {
          // Fecha se clicar no backdrop fora da imagem quando não estiver em zoom/arrasto
          if (e.target === containerRef.current && zoom === 1) {
            onClose();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 relative flex items-center justify-center p-2 sm:p-4 min-h-0 overflow-hidden cursor-default"
      >
        {/* Loading Spinner */}
        {isLoading && !isPdf && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 z-10 pointer-events-none">
            <Loader2 size={36} className="animate-spin text-emerald-400" />
            <span className="text-xs text-slate-400 font-semibold">Carregando imagem em alta resolução...</span>
          </div>
        )}

        {/* Fallback de Erro */}
        {hasError && (
          <div className="p-6 bg-slate-900 border border-red-500/30 rounded-3xl max-w-sm text-center space-y-3 shadow-2xl z-10">
            <AlertCircle size={36} className="text-red-400 mx-auto" />
            <p className="text-sm font-bold text-white">Não foi possível carregar esta mídia.</p>
            <p className="text-xs text-slate-400">Verifique sua conexão ou tente novamente.</p>
            <button
              type="button"
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* MÍDIA: PDF OU IMAGEM */}
        {isPdf ? (
          <div className="w-full max-w-4xl h-full flex flex-col items-center justify-center gap-3 bg-slate-900/90 rounded-2xl p-2 border border-slate-800 shadow-2xl">
            <iframe 
              src={currentItem.url} 
              title={currentItem.title || 'Documento PDF'}
              className="w-full h-full rounded-xl border border-slate-800"
            />
            <div className="flex items-center gap-3 py-1">
              <a
                href={currentItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-400 hover:underline font-bold flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-xl"
              >
                <ExternalLink size={14} /> Abrir PDF em Nova Aba
              </a>
            </div>
          </div>
        ) : (
          !hasError && (
            <div
              className={`relative flex items-center justify-center max-w-full max-h-full transition-transform ease-out ${
                isDraggingRef.current ? 'duration-0' : 'duration-200'
              }`}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: zoom > 1 
                  ? (isCursorGrabbing ? 'grabbing' : 'grab') 
                  : 'zoom-in'
              }}
              onMouseDown={handleMouseDown}
              onClick={handleImageClick}
            >
              <img
                ref={imageRef}
                src={currentItem.url}
                alt={currentItem.title || 'Material do Diálogo Diário de Segurança'}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                className="max-w-[96vw] sm:max-w-[92vw] max-h-[calc(100vh-140px)] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-slate-800/80 bg-slate-950/40 pointer-events-auto transition-opacity"
                draggable={false}
              />
            </div>
          )
        )}

        {/* SETAS LATERAIS DE NAVEGAÇÃO ENTRE SLIDES (SE HOUVER MAIS DE 1) */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 sm:p-3.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white rounded-2xl border border-slate-700/80 backdrop-blur-md shadow-xl transition-all min-h-[48px] min-w-[48px] flex items-center justify-center z-20 active:scale-95 cursor-pointer"
              title="Mídia anterior (Seta esquerda)"
              aria-label="Mídia anterior"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 sm:p-3.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white rounded-2xl border border-slate-700/80 backdrop-blur-md shadow-xl transition-all min-h-[48px] min-w-[48px] flex items-center justify-center z-20 active:scale-95 cursor-pointer"
              title="Próxima mídia (Seta direita)"
              aria-label="Próxima mídia"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* 3. BARRA INFERIOR FLUTUANTE DE CONTROLES DE ZOOM E DICA DE USO */}
      {!isPdf && !hasError && (
        <footer className="h-16 px-4 bg-slate-900/90 border-t border-slate-800/80 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 z-30 shadow-2xl">
          {/* Dica de Interação Mobile / Desktop */}
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-xs">
            <ZoomIn size={14} className="text-emerald-400" />
            <span>Use o scroll do mouse para zoom ou clique e arraste para navegar.</span>
          </div>
          <div className="md:hidden flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
            <span className="text-emerald-400 font-bold">Dica:</span>
            <span className="truncate">Toque duplo ou use dois dedos para zoom.</span>
          </div>

          {/* Pílula de Controles de Zoom: − 100% + Ajustar */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-2xl shadow-inner ml-auto">
            {/* Diminuir Zoom (−) */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= minZoom}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              title="Diminuir Zoom (-)"
              aria-label="Diminuir Zoom"
            >
              <ZoomOut size={16} />
            </button>

            {/* Nível Atual / Reset */}
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2.5 py-1 text-xs font-mono font-bold text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors min-w-[50px] text-center"
              title="Clique para resetar zoom em 100%"
            >
              {Math.round(zoom * 100)}%
            </button>

            {/* Aumentar Zoom (+) */}
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= maxZoom}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              title="Aumentar Zoom (+)"
              aria-label="Aumentar Zoom"
            >
              <ZoomIn size={16} />
            </button>

            <div className="h-4 w-px bg-slate-800 mx-0.5" />

            {/* Ajustar à Tela */}
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1 min-h-[40px]"
              title="Ajustar à tela"
            >
              <RotateCcw size={14} className="text-teal-400" />
              <span className="hidden sm:inline">Ajustar</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
