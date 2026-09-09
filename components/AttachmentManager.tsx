'use client';

import React, { useState, useRef } from 'react';
import { 
  FileText, Camera, Trash2, Eye, AlertCircle, CheckCircle2, 
  X, Download, Plus, Loader2, FileCheck2, 
  MoveUp, MoveDown, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Sparkles, ScrollText, ArrowDown
} from 'lucide-react';
import MediaLightbox from '@/components/MediaLightbox';

export interface DdsAttachment {
  id?: string;
  fileName: string;
  displayName?: string | null;
  description?: string | null;
  mimeType: string;
  fileSize: number;
  fileData: string; // Base64 data URL
  pageCount?: number | null;
  order?: number;
  createdAt?: string | Date;
  // UI helper
  uploadStatus?: 'idle' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

interface AttachmentManagerProps {
  attachments: DdsAttachment[];
  onChange: (attachments: DdsAttachment[]) => void;
  readOnly?: boolean;
  maxImageSizeMb?: number;
  maxPdfSizeMb?: number;
  onSaveToMeeting?: (attachments: DdsAttachment[]) => Promise<void>;
}

// Configurações padrão seguras
const DEFAULT_MAX_IMAGE_MB = 10;
const DEFAULT_MAX_PDF_MB = 25;

export default function AttachmentManager({
  attachments = [],
  onChange,
  readOnly = false,
  maxImageSizeMb = DEFAULT_MAX_IMAGE_MB,
  maxPdfSizeMb = DEFAULT_MAX_PDF_MB,
  onSaveToMeeting
}: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [editingDescriptionIndex, setEditingDescriptionIndex] = useState<number | null>(null);
  const [tempDescription, setTempDescription] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openPreview = async (index: number) => {
    const att = attachments[index];
    if (!att) return;

    // Se o anexo veio sem fileData (otimização de tráfego de rede), busca sob demanda
    if (!att.fileData && att.id) {
      try {
        setIsLoadingFile(true);
        const res = await fetch(`/api/reuniao?attachmentId=${encodeURIComponent(att.id)}`);
        const data = await res.json();
        if (data.success && data.attachment?.fileData) {
          att.fileData = data.attachment.fileData;
          const updated = [...attachments];
          updated[index] = { ...att };
          onChange(updated);
        }
      } catch (e) {
        console.error("Erro ao carregar dados do anexo:", e);
      } finally {
        setIsLoadingFile(false);
      }
    }
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  // Formata tamanho em KB ou MB
  const formatFileSize = (bytes: number): string => {
    if (!bytes || isNaN(bytes)) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Comprime imagens client-side preservando legibilidade técnica
  const compressImage = (dataUrl: string, mimeType: string, callback: (compressedDataUrl: string, size: number) => void) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDimension = 1600; // Alta resolução técnica para esquemas, slides e cartazes

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
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        // Aproxima o tamanho em bytes a partir do Base64
        const estimatedSize = Math.round((compressed.length * 3) / 4);
        callback(compressed, estimatedSize);
      } else {
        const estimatedSize = Math.round((dataUrl.length * 3) / 4);
        callback(dataUrl, estimatedSize);
      }
    };
    img.onerror = () => {
      const estimatedSize = Math.round((dataUrl.length * 3) / 4);
      callback(dataUrl, estimatedSize);
    };
    img.src = dataUrl;
  };

  // Extrai número de páginas do PDF com base64
  const extractPdfPageCount = async (base64Data: string): Promise<number> => {
    try {
      // Procura por tags de páginas no stream raw
      const raw = atob(base64Data.replace(/^data:application\/pdf;base64,/, ''));
      const matches = raw.match(/\/Type\s*\/Page\b/g);
      if (matches && matches.length > 0) {
        return matches.length;
      }
      return 1;
    } catch {
      return 1;
    }
  };

  // Processa arquivo selecionado
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setIsProcessing(true);

    const newItems: DdsAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mime = file.type.toLowerCase();
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      // Validação de formato
      const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
      const isPdf = mime === 'application/pdf' || ext === 'pdf';

      if (!isImage && !isPdf) {
        setErrorMsg(`Arquivo "${file.name}" não é suportado. Use JPG, PNG, WEBP ou PDF.`);
        continue;
      }

      // Validação de tamanho
      const maxBytes = isPdf ? maxPdfSizeMb * 1024 * 1024 : maxImageSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        setErrorMsg(`Arquivo "${file.name}" ultrapassa o limite de ${isPdf ? maxPdfSizeMb : maxImageSizeMb} MB.`);
        continue;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        if (isImage) {
          await new Promise<void>((resolve) => {
            compressImage(base64, mime || 'image/jpeg', (compressedBase64, calculatedSize) => {
              newItems.push({
                fileName: file.name,
                displayName: file.name.replace(/\.[^/.]+$/, ''),
                mimeType: 'image/jpeg',
                fileSize: calculatedSize,
                fileData: compressedBase64,
                pageCount: 1,
                order: attachments.length + newItems.length,
                uploadStatus: 'success',
                createdAt: new Date().toISOString()
              });
              resolve();
            });
          });
        } else if (isPdf) {
          const pageCount = await extractPdfPageCount(base64);
          newItems.push({
            fileName: file.name,
            displayName: file.name.replace(/\.[^/.]+$/, ''),
            mimeType: 'application/pdf',
            fileSize: file.size,
            fileData: base64,
            pageCount: pageCount || 1,
            order: attachments.length + newItems.length,
            uploadStatus: 'success',
            createdAt: new Date().toISOString()
          });
        }
      } catch (err: any) {
        console.error('Erro ao processar anexo:', err);
        setErrorMsg(`Falha ao carregar "${file.name}".`);
      }
    }

    if (newItems.length > 0) {
      const updated = [...attachments, ...newItems].map((item, idx) => ({
        ...item,
        order: idx
      }));
      onChange(updated);

      if (onSaveToMeeting) {
        try {
          await onSaveToMeeting(updated);
        } catch (e) {
          console.error("Erro ao salvar anexos na reunião:", e);
        }
      }
    }

    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Reordenação
  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (readOnly) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= attachments.length) return;

    const reordered = [...attachments];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const updated = reordered.map((item, idx) => ({ ...item, order: idx }));
    onChange(updated);

    if (onSaveToMeeting) {
      onSaveToMeeting(updated).catch(console.error);
    }
  };

  // Remoção
  const handleRemove = (index: number) => {
    if (readOnly) return;
    const updated = attachments
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({ ...item, order: idx }));
    onChange(updated);

    if (onSaveToMeeting) {
      onSaveToMeeting(updated).catch(console.error);
    }
  };

  // Salvar descrição
  const handleSaveDescription = (index: number) => {
    const updated = [...attachments];
    updated[index] = {
      ...updated[index],
      description: tempDescription.trim() || null
    };
    onChange(updated);
    setEditingDescriptionIndex(null);

    if (onSaveToMeeting) {
      onSaveToMeeting(updated).catch(console.error);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Cabeçalho da Seção de Evidências */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 size={16} className="text-emerald-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Evidências & Material Apresentado
            </h4>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {attachments.length} {attachments.length === 1 ? 'anexo' : 'anexos'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Procedimentos, cartilhas em PDF, fotos de cartazes ou slides apresentados aos colaboradores. <span className="text-emerald-400 font-medium">Consolidados na Ata PDF.</span>
          </p>
        </div>

        {/* Botões de Ação de Adição (se não estiver em modo somente leitura) */}
        {!readOnly && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 sm:pt-0">
            {/* Input Oculto para Câmera Direta */}
            <input 
              ref={cameraInputRef}
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              onChange={(e) => handleFiles(e.target.files)}
              disabled={isProcessing}
            />

            {/* Input Oculto para Galeria e PDF */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf,image/jpeg,image/jpg,image/png,image/webp" 
              multiple
              className="hidden" 
              onChange={(e) => handleFiles(e.target.files)}
              disabled={isProcessing}
            />

            {/* Botão Tirar Foto */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isProcessing}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 min-h-[38px]"
              title="Tirar foto com a câmera"
            >
              <Camera size={14} className="text-emerald-400" />
              <span>Câmera</span>
            </button>

            {/* Botão Anexar PDF / Imagem */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50 min-h-[38px]"
              title="Selecionar PDF ou foto da galeria"
            >
              {isProcessing ? (
                <Loader2 size={14} className="animate-spin text-white" />
              ) : (
                <Plus size={14} className="text-white" />
              )}
              <span>+ Anexar Material</span>
            </button>
          </div>
        )}
      </div>

      {/* Alerta de Erro se houver */}
      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
          <button 
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:text-white p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Lista de Anexos */}
      {attachments.length === 0 ? (
        <div className="p-5 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 text-center space-y-1.5">
          <div className="w-10 h-10 mx-auto rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
            <FileCheck2 size={20} className="text-slate-400" />
          </div>
          <p className="text-xs font-bold text-slate-300">Nenhum material anexado a este DDS</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            {readOnly 
              ? 'Nenhuma evidência ou material complementar foi registrado neste DDS.' 
              : 'Clique em "+ Anexar Material" ou "Câmera" para anexar o PDF de instrução, procedimento ou foto do cartaz utilizado no DDS.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {attachments.map((att, index) => {
            const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
            const isEditingThisDesc = editingDescriptionIndex === index;

            return (
              <div 
                key={att.id || `${att.fileName}-${index}`}
                className="p-3 sm:p-4 bg-slate-950 border border-slate-800 rounded-2xl transition-all hover:border-slate-700 flex flex-col gap-3 shadow-sm"
              >
                {/* Linha Principal do Item */}
                <div className="flex items-center justify-between gap-2">
                  {/* Thumbnail / Ícone */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div 
                      onClick={() => openPreview(index)}
                      className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 cursor-pointer hover:border-emerald-500/60 transition-colors group relative"
                      title="Clique para visualizar em tela cheia"
                    >
                      {isPdf ? (
                        <div className="flex flex-col items-center justify-center text-rose-400">
                          <FileText size={22} />
                          <span className="text-[8px] font-black uppercase text-rose-300">PDF</span>
                        </div>
                      ) : att.fileData ? (
                        <img 
                          src={att.fileData} 
                          alt={att.fileName} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-emerald-400">
                          <Camera size={20} />
                          <span className="text-[8px] font-black uppercase text-emerald-300">FOTO</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye size={16} className="text-white" />
                      </div>
                    </div>

                    {/* Dados do Arquivo */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          #{index + 1}
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-white truncate" title={att.fileName}>
                          {att.displayName || att.fileName}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                        <span className="font-mono text-emerald-400">{formatFileSize(att.fileSize)}</span>
                        <span>•</span>
                        <span className="uppercase font-semibold text-slate-400">
                          {isPdf ? `PDF (${att.pageCount || 1} ${(att.pageCount || 1) === 1 ? 'pág' : 'págs'})` : 'IMAGEM'}
                        </span>
                        {att.uploadStatus === 'success' && (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 size={10} /> Integrado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Botão Visualizar */}
                    <button
                      type="button"
                      onClick={() => openPreview(index)}
                      disabled={isLoadingFile}
                      className="px-2.5 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-emerald-800/60 flex items-center gap-1 min-h-[36px]"
                      title="Visualizar documento / imagem completa"
                    >
                      {isLoadingFile ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                      <span className="text-xs">Ver</span>
                    </button>

                    {!readOnly && (
                      <>
                        {/* Subir Ordem */}
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                          className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Subir posição na ata"
                        >
                          <MoveUp size={14} />
                        </button>

                        {/* Descer Ordem */}
                        <button
                          type="button"
                          disabled={index === attachments.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-20 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Descer posição na ata"
                        >
                          <MoveDown size={14} />
                        </button>

                        {/* Excluir */}
                        <button
                          type="button"
                          onClick={() => handleRemove(index)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Remover anexo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Pré-visualização Inline em destaque no modo ReadOnly (Colaborador Assinando) */}
                {readOnly && !isPdf && (
                  <div className="space-y-1.5">
                    <div 
                      onClick={() => openPreview(index)}
                      className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 cursor-zoom-in group hover:border-emerald-500/60 transition-all shadow-lg flex flex-col items-center justify-center"
                      title="Toque ou clique para ampliar em tela cheia com zoom"
                    >
                      {/* Imagem em proporção natural sem cortes (width: 100%, height: auto, object-fit: contain) */}
                      <div className="w-full flex items-center justify-center p-2 sm:p-3 bg-slate-950/60 min-h-[180px]">
                        <img 
                          src={att.fileData} 
                          alt={att.displayName || att.fileName} 
                          className="w-full h-auto max-h-[360px] sm:max-h-[460px] object-contain rounded-xl group-hover:scale-[1.008] transition-transform" 
                        />
                      </div>

                      {/* Badge Discreta e Intuitiva: Toque para ampliar */}
                      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 pointer-events-none">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/90 text-white text-xs font-bold border border-emerald-500/40 shadow-xl backdrop-blur-md group-hover:bg-slate-900 group-hover:border-emerald-400 group-hover:scale-105 transition-all">
                          <ZoomIn size={14} className="text-emerald-400 shrink-0" />
                          <span>Toque para ampliar</span>
                        </div>
                      </div>
                    </div>

                    {/* Texto informativo discreto para reforçar acessibilidade */}
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center px-1">
                      <ZoomIn size={12} className="text-emerald-400 shrink-0" />
                      <span>Toque ou clique na imagem para visualizar em tela ampliada com controles de zoom.</span>
                    </div>
                  </div>
                )}

                {/* Descrição / Legenda do Anexo */}
                <div className="pt-1 border-t border-slate-900">
                  {isEditingThisDesc ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={tempDescription}
                        onChange={(e) => setTempDescription(e.target.value)}
                        placeholder="Ex: Cartilha de NR-35 ministrada aos colaboradores..."
                        className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none h-16"
                        maxLength={250}
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingDescriptionIndex(null)}
                          className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveDescription(index)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold"
                        >
                          Salvar Legenda
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <div className="truncate pr-2">
                        {att.description ? (
                          <span className="text-slate-300 italic">"{att.description}"</span>
                        ) : (
                          <span className="text-slate-600">Sem descrição cadastrada</span>
                        )}
                      </div>

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            setTempDescription(att.description || '');
                            setEditingDescriptionIndex(index);
                          }}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 shrink-0 ml-auto underline"
                        >
                          {att.description ? 'Editar legenda' : '+ Adicionar legenda'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox / Modal de Visualização Ampliada da Mídia do DDS */}
      <MediaLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        initialIndex={lightboxIndex}
        items={attachments.map(att => ({
          id: att.id,
          url: att.fileData,
          title: att.displayName || att.fileName,
          description: att.description,
          mimeType: att.mimeType,
          fileSize: att.fileSize
        }))}
      />
    </div>
  );
}
