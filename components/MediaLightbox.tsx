'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, ZoomIn, ZoomOut, RotateCcw, 
  ChevronLeft, ChevronRight, Loader2, AlertCircle, 
  Download, ExternalLink
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

// Limites seguros de zoom para evitar overflow de memória e distorções
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 3.0;

export default function MediaLightbox({
  isOpen,
  onClose,
  items = [],
  initialIndex = 0
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState<number>(MIN_ZOOM);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  // Referências para cálculos de gestos e arrasto
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Estados mutáveis para gestos (sem re-renderizar desnecessariamente)
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [isCursorGrabbing, setIsCursorGrabbing] = useState(false);

  // Gestos Pinch (dois dedos)
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(MIN_ZOOM);

  // Gestos Duplo Toque
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  // Swipe para próxima foto
  const touchStartSwipeRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Timestamp do último término de toque para suprimir cliques sintéticos do navegador
  const touchEndTimeRef = useRef<number>(0);

  // Flag para controle do histórico (Android Back Button)
  const pushedHistoryRef = useRef(false);

  // =========================================================================
  // 1. RESET CENTRALIZADO DE ESTADO DO VISUALIZADOR
  // =========================================================================
  const resetViewerState = useCallback(() => {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
    isDraggingRef.current = false;
    pinchStartDistRef.current = null;
    pinchStartZoomRef.current = MIN_ZOOM;
    lastTapRef.current = { time: 0, x: 0, y: 0 };
    touchStartSwipeRef.current = null;
    setIsCursorGrabbing(false);
    setIsLoading(false);
    setHasError(false);
  }, []);

  // Sincroniza initialIndex e reseta estado ao abrir
  useEffect(() => {
    if (isOpen) {
      const validIndex = Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0));
      setCurrentIndex(validIndex);
      resetViewerState();
      setIsLoading(true);
      console.log(`[DDS_MEDIA] MEDIA_VIEWER_OPEN (index: ${validIndex}, total: ${items.length})`);
    } else {
      resetViewerState();
    }
  }, [isOpen, initialIndex, items.length, resetViewerState]);

  // Reseta zoom e pan ao mudar de slide
  useEffect(() => {
    resetViewerState();
    setIsLoading(true);
  }, [currentIndex, resetViewerState]);

  const currentItem = items[currentIndex];
  const isPdf = currentItem?.mimeType === 'application/pdf' || 
                currentItem?.url?.startsWith('data:application/pdf') || 
                currentItem?.title?.toLowerCase().endsWith('.pdf');
  const hasMultiple = items.length > 1;

  // Clamping seguro para pan (mantém imagem na tela sem NaN ou Infinity)
  const clampPan = useCallback((rawX: number, rawY: number, currentZoom: number) => {
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || currentZoom <= MIN_ZOOM) {
      return { x: 0, y: 0 };
    }
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
    const winHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
    const maxPanX = Math.round(((currentZoom - 1) * winWidth) / 2);
    const maxPanY = Math.round(((currentZoom - 1) * winHeight) / 2);

    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, Math.round(rawX))),
      y: Math.max(-maxPanY, Math.min(maxPanY, Math.round(rawY)))
    };
  }, []);

  // Controles de zoom seguros com validação numérica estrita
  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const target = Math.min(MAX_ZOOM, Number((prev + 0.4).toFixed(1)));
      console.log(`[DDS_MEDIA] ZOOM_CHANGE: ${prev} -> ${target}`);
      return target;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const target = Math.max(MIN_ZOOM, Number((prev - 0.4).toFixed(1)));
      if (target === MIN_ZOOM) setPan({ x: 0, y: 0 });
      console.log(`[DDS_MEDIA] ZOOM_CHANGE: ${prev} -> ${target}`);
      return target;
    });
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
  // 2. CONTROLE DO BOTÃO VOLTAR DO ANDROID / PWA (HISTORY API)
  // =========================================================================
  useEffect(() => {
    if (!isOpen) return;

    pushedHistoryRef.current = true;
    window.history.pushState({ ddsMediaViewer: true }, '');

    const handlePopState = () => {
      pushedHistoryRef.current = false;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        try {
          if (window.history.state && window.history.state.ddsMediaViewer) {
            window.history.back();
          }
        } catch {
          // Ignora se o histórico já estiver no estado correto
        }
      }
    };
  }, [isOpen, onClose]);

  // =========================================================================
  // 3. ACESSIBILIDADE, TECLADO E TRAVAMENTO DE BODY SCROLL COM RESTAURAÇÃO
  // =========================================================================
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && zoom === MIN_ZOOM) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && zoom === MIN_ZOOM) {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        resetViewerState();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      resetViewerState();
      console.log('[DDS_MEDIA] MEDIA_VIEWER_CLOSE');
    };
  }, [isOpen, onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, resetViewerState, zoom]);

  // =========================================================================
  // 4. MOUSE WHEEL ZOOM (DESKTOP)
  // =========================================================================
  const handleWheel = (e: React.WheelEvent) => {
    if (isPdf) return;
    e.stopPropagation();

    if (e.deltaY < 0) {
      setZoom(prev => Math.min(MAX_ZOOM, Number((prev + 0.25).toFixed(2))));
    } else {
      setZoom(prev => {
        const next = Math.max(MIN_ZOOM, Number((prev - 0.25).toFixed(2)));
        if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // =========================================================================
  // 5. MOUSE DRAG / PAN (DESKTOP)
  // =========================================================================
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= MIN_ZOOM || isPdf) return;
    if (e.button !== 0) return;

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
    if (!isDraggingRef.current || zoom <= MIN_ZOOM) return;
    e.preventDefault();

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    const clamped = clampPan(dragStartRef.current.panX + deltaX, dragStartRef.current.panY + deltaY, zoom);
    setPan(clamped);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsCursorGrabbing(false);
  };

  // =========================================================================
  // 6. GESTOS TOUCH (PINCH-TO-ZOOM, DUPLO TOQUE, PAN E SWIPE NO MOBILE)
  // =========================================================================
  const getTouchDistance = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    const dist = Math.hypot(dx, dy);
    return Number.isFinite(dist) ? dist : 0;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isPdf) return;

    // A. Dois dedos: Pinch to zoom
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      if (dist > 15) {
        pinchStartDistRef.current = dist;
        pinchStartZoomRef.current = zoom;
        isDraggingRef.current = false;
        console.log(`[DDS_MEDIA] ZOOM_START (pinch initial distance: ${dist.toFixed(1)})`);
      }
      return;
    }

    // B. Um dedo: Pan ou Duplo Toque ou Swipe
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      const lastTap = lastTapRef.current;

      // Duplo Toque (< 300ms e proximidade de 25px)
      if (now - lastTap.time < 300 && Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < 25) {
        if (zoom > MIN_ZOOM) {
          resetViewerState();
        } else {
          setZoom(2.0);
        }
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        return;
      }
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };

      if (zoom > MIN_ZOOM) {
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          panX: pan.x,
          panY: pan.y
        };
      } else {
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

    // Processa Pinch-to-Zoom com salvaguardas matemáticas absolutas
    if (e.touches.length === 2 && pinchStartDistRef.current !== null && pinchStartDistRef.current > 15) {
      const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
      if (currentDist > 15 && Number.isFinite(currentDist)) {
        const scaleFactor = currentDist / pinchStartDistRef.current;
        if (Number.isFinite(scaleFactor) && scaleFactor > 0) {
          const rawZoom = pinchStartZoomRef.current * scaleFactor;
          const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(rawZoom.toFixed(2))));
          if (Number.isFinite(targetZoom)) {
            setZoom(targetZoom);
            if (targetZoom === MIN_ZOOM) setPan({ x: 0, y: 0 });
          }
        }
      }
      return;
    }

    // Processa Pan de 1 dedo
    if (e.touches.length === 1 && isDraggingRef.current && zoom > MIN_ZOOM) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;
      const clamped = clampPan(dragStartRef.current.panX + deltaX, dragStartRef.current.panY + deltaY, zoom);
      setPan(clamped);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pinchStartDistRef.current !== null) {
      console.log(`[DDS_MEDIA] ZOOM_END: ${zoom}`);
    }
    pinchStartDistRef.current = null;
    isDraggingRef.current = false;

    // Detecção de Swipe horizontal para fotos quando zoom === 1
    if (zoom === MIN_ZOOM && touchStartSwipeRef.current && e.changedTouches.length > 0 && hasMultiple) {
      const endTouch = e.changedTouches[0];
      const dx = endTouch.clientX - touchStartSwipeRef.current.x;
      const dy = endTouch.clientY - touchStartSwipeRef.current.y;
      const dt = Date.now() - touchStartSwipeRef.current.time;

      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 450) {
        if (dx < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }
    touchStartSwipeRef.current = null;
    touchEndTimeRef.current = Date.now();
  };

  // Alterna zoom ao clicar diretamente na imagem com mouse no desktop
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Descarta cliques sintéticos disparados por navegadores mobile após toques/pinch
    if (Date.now() - touchEndTimeRef.current < 500) {
      return;
    }
    if (zoom === MIN_ZOOM) {
      setZoom(2.0);
    } else {
      resetViewerState();
    }
  };

  if (!isOpen || !currentItem) return null;

  // Garante que valores de renderização CSS sejam estritamente numéricos e finitos
  const safeZoom = Number.isFinite(zoom) && zoom >= MIN_ZOOM ? Math.min(MAX_ZOOM, zoom) : MIN_ZOOM;
  const safePanX = Number.isFinite(pan.x) ? Math.round(pan.x) : 0;
  const safePanY = Number.isFinite(pan.y) ? Math.round(pan.y) : 0;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador ampliado de imagem"
      className="fixed inset-0 z-[99999] flex flex-col bg-slate-950 text-white select-none overflow-hidden touch-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 1. BARRA SUPERIOR (HEADER) */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 z-30 shadow-md">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {hasMultiple && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black shrink-0 font-mono">
              {currentIndex + 1} de {items.length}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">
              {currentItem.title || `Material do DDS #${currentIndex + 1}`}
            </h3>
            {currentItem.description && (
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate italic">
                {currentItem.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="p-2.5 bg-slate-800 hover:bg-red-500/20 text-slate-200 hover:text-red-300 rounded-xl border border-slate-700 hover:border-red-500/40 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
            title="Fechar visualização (ESC)"
            aria-label="Fechar visualização"
          >
            <X size={22} className="stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL DE VISUALIZAÇÃO */}
      <div 
        ref={containerRef}
        onClick={(e) => {
          if (e.target === containerRef.current && zoom === MIN_ZOOM) {
            onClose();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 relative flex items-center justify-center p-2 sm:p-4 min-h-0 overflow-hidden cursor-default bg-slate-950"
      >
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 z-10 pointer-events-none">
            <Loader2 size={36} className="animate-spin text-emerald-400" />
            <span className="text-xs text-slate-400 font-semibold">Carregando visualização...</span>
          </div>
        )}

        {/* Fallback de Erro */}
        {hasError && (
          <div className="p-6 bg-slate-900 border border-red-500/30 rounded-3xl max-w-sm text-center space-y-3 shadow-2xl z-10">
            <AlertCircle size={36} className="text-red-400 mx-auto" />
            <p className="text-sm font-bold text-white">Não foi possível exibir esta mídia.</p>
            <p className="text-xs text-slate-400">O arquivo pode estar indisponível ou em formato não suportado.</p>
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

        {/* MÍDIA: PDF OU IMAGEM ORIGINAL IMUTÁVEL */}
        {isPdf ? (
          <div className="w-full max-w-4xl h-full flex flex-col items-center justify-center gap-3 bg-slate-900 rounded-2xl p-2 border border-slate-800 shadow-2xl">
            <iframe 
              src={currentItem.url} 
              title={currentItem.title || 'Documento PDF'}
              className="w-full h-full rounded-xl border border-slate-800"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
                console.error('[DDS_MEDIA] MEDIA_RENDER_ERROR (PDF load failed)');
              }}
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
          currentItem.url && !hasError && (
            <div
              className={`relative flex items-center justify-center max-w-full max-h-full ${
                isDraggingRef.current ? '' : 'transition-transform duration-150 ease-out'
              }`}
              style={{
                transform: `translate3d(${safePanX}px, ${safePanY}px, 0) scale(${safeZoom})`,
                willChange: safeZoom > MIN_ZOOM || isDraggingRef.current ? 'transform' : 'auto',
                cursor: safeZoom > MIN_ZOOM 
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
                decoding="async"
                onLoad={() => {
                  setIsLoading(false);
                  setHasError(false);
                }}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                  console.error('[DDS_MEDIA] MEDIA_RENDER_ERROR (Image load failed)');
                }}
                className="max-w-[94vw] sm:max-w-[90vw] max-h-[calc(100vh-140px)] w-auto h-auto object-contain rounded-2xl shadow-xl border border-slate-800 bg-slate-950 pointer-events-auto"
                draggable={false}
              />
            </div>
          )
        )}

        {/* SETAS LATERAIS */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 sm:p-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white rounded-2xl border border-slate-700 shadow-xl transition-all min-h-[48px] min-w-[48px] flex items-center justify-center z-20 active:scale-95 cursor-pointer"
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
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 sm:p-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white rounded-2xl border border-slate-700 shadow-xl transition-all min-h-[48px] min-w-[48px] flex items-center justify-center z-20 active:scale-95 cursor-pointer"
              title="Próxima mídia (Seta direita)"
              aria-label="Próxima mídia"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* 3. BARRA INFERIOR DE CONTROLES */}
      {!isPdf && !hasError && (
        <footer className="h-16 px-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0 z-30 shadow-xl">
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-xs">
            <ZoomIn size={14} className="text-emerald-400" />
            <span>Use o scroll do mouse ou clique para zoom. Arraste para navegar.</span>
          </div>
          <div className="md:hidden flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
            <span className="text-emerald-400 font-bold">Dica:</span>
            <span className="truncate">Toque duplo ou use dois dedos para zoom.</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-2xl shadow-inner ml-auto">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={safeZoom <= MIN_ZOOM}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              title="Diminuir Zoom"
              aria-label="Diminuir Zoom"
            >
              <ZoomOut size={16} />
            </button>

            <button
              type="button"
              onClick={resetViewerState}
              className="px-2.5 py-1 text-xs font-mono font-bold text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors min-w-[50px] text-center"
              title="Resetar Zoom para 100%"
            >
              {Math.round(safeZoom * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={safeZoom >= MAX_ZOOM}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              title="Aumentar Zoom"
              aria-label="Aumentar Zoom"
            >
              <ZoomIn size={16} />
            </button>

            <div className="h-4 w-px bg-slate-800 mx-0.5" />

            <button
              type="button"
              onClick={resetViewerState}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1 min-h-[40px]"
              title="Ajustar à tela (Reset)"
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
