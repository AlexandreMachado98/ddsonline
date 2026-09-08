'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Camera, Image as ImageIcon, Trash2, Check, 
  ShieldCheck, Loader2, AlertTriangle, Lock, User, 
  Mail, Building2, Briefcase, Sparkles
} from 'lucide-react';

interface UserProfileModalProps {
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
    position?: string;
    company?: string;
    photoURL?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updatedUser: any) => void;
}

export default function UserProfileModal({
  user,
  isOpen,
  onClose,
  onProfileUpdated
}: UserProfileModalProps) {
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(user?.photoURL || null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.name || '');
      setCurrentPhoto(user.photoURL || null);
      setPreviewPhoto(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setShowPhotoOptions(false);
      setShowConfirmRemove(false);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  // Extração das iniciais para avatar fallback
  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'TST';
    const parts = nameStr.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Compressão e recorte 1:1 inteligente via Canvas no navegador
  const processImageFile = (file: File) => {
    if (!file) return;

    // Validação de formato (MIME Type)
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setErrorMsg('Formato não suportado. Por favor, escolha JPG, PNG ou WebP.');
      return;
    }

    // Validação de tamanho bruto original (máximo 15MB antes de comprimir)
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('O arquivo original excede 15MB. Escolha uma imagem menor.');
      return;
    }

    setIsUploadingPhoto(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMsg('Erro ao ler a imagem selecionada.');
      setIsUploadingPhoto(false);
    };

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        setErrorMsg('Arquivo corrompido ou formato ilegível.');
        setIsUploadingPhoto(false);
      };

      img.onload = () => {
        try {
          // Recorte 1:1 centralizado (Square Crop)
          const size = Math.min(img.width, img.height);
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;

          // Redimensionamento para dimensão otimizada para avatar (256x256)
          const targetDim = 256;
          const canvas = document.createElement('canvas');
          canvas.width = targetDim;
          canvas.height = targetDim;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setErrorMsg('Não foi possível processar a imagem no navegador.');
            setIsUploadingPhoto(false);
            return;
          }

          // Qualidade de interpolação alta
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Desenha o recorte quadrado perfeito
          ctx.drawImage(img, startX, startY, size, size, 0, 0, targetDim, targetDim);

          // Converte para WebP (ou JPEG se não suportado) com 82% de qualidade
          let compressedBase64 = canvas.toDataURL('image/webp', 0.82);
          if (!compressedBase64.startsWith('data:image/webp')) {
            compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          }

          setPreviewPhoto(compressedBase64);
          setShowPhotoOptions(false);
          setSuccessMsg('Foto selecionada! Clique em "Salvar Alterações" para confirmar.');
        } catch (err) {
          console.error(err);
          setErrorMsg('Falha ao redimensionar a imagem.');
        } finally {
          setIsUploadingPhoto(false);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // Reseta o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    setPreviewPhoto(null);
    setCurrentPhoto(null);
    setShowConfirmRemove(false);
    setShowPhotoOptions(false);
    setSuccessMsg('Foto removida. Clique em "Salvar Alterações" para confirmar.');
  };

  const handleCancelPreview = () => {
    setPreviewPhoto(null);
    setShowPhotoOptions(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = displayName.replace(/\s+/g, ' ').trim();
    if (cleanName.length < 2) {
      setErrorMsg('O nome de exibição deve ter pelo menos 2 caracteres.');
      return;
    }
    if (cleanName.length > 60) {
      setErrorMsg('O nome de exibição não pode ultrapassar 60 caracteres.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Determina a foto final: se previewPhoto existir, usa ela; se foi limpa (currentPhoto null e previewPhoto null), envia null; caso contrário mantém currentPhoto
      const finalPhoto = previewPhoto !== null ? previewPhoto : currentPhoto;

      const res = await fetch('/api/usuario/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: cleanName,
          photoURL: finalPhoto
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        setSuccessMsg('Perfil atualizado com sucesso!');
        setCurrentPhoto(data.user.photoURL || null);
        setPreviewPhoto(null);

        // Atualiza a persistência local (localStorage) imediatamente
        try {
          const authRaw = localStorage.getItem('dds_admin_auth');
          if (authRaw) {
            const authUser = JSON.parse(authRaw);
            const updated = {
              ...authUser,
              name: data.user.name,
              photoURL: data.user.photoURL || null
            };
            localStorage.setItem('dds_admin_auth', JSON.stringify(updated));
          }
        } catch (storageErr) {
          console.error('Erro ao atualizar localStorage do perfil:', storageErr);
        }

        // Notifica o componente pai para atualizar estados globais sem recarregar a tela
        onProfileUpdated(data.user);

        // Fecha a modal após breve feedback de sucesso
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg(data.error || 'Não foi possível atualizar seu perfil.');
      }
    } catch (err: any) {
      setErrorMsg('Erro de conexão ao salvar perfil. Verifique sua internet.');
    } finally {
      setIsSaving(false);
    }
  };

  const activePhoto = previewPhoto || currentPhoto;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[94dvh] overflow-y-auto shadow-2xl flex flex-col my-auto"
        role="dialog"
        aria-labelledby="profile-modal-title"
      >
        {/* Topbar da Modal */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div>
            <h2 id="profile-modal-title" className="text-lg sm:text-xl font-black text-white flex items-center gap-2 tracking-tight">
              <User size={20} className="text-emerald-400" />
              Meu Perfil
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Gerencie suas informações pessoais do DDS Online
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
            aria-label="Fechar modal de perfil"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 flex-1">
          {/* Mensagens de Feedback */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertTriangle size={16} className="shrink-0 text-rose-400" />
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <Check size={16} className="shrink-0 text-emerald-400" />
              <span className="flex-1">{successMsg}</span>
            </div>
          )}

          {/* Seção da Foto de Perfil & Avatar */}
          <div className="flex flex-col items-center text-center space-y-3 pb-2">
            <div className="relative group">
              {/* Moldura Circular do Avatar */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-slate-800 p-1 bg-slate-950 flex items-center justify-center overflow-hidden shadow-2xl transition-all">
                {activePhoto ? (
                  <img
                    src={activePhoto}
                    alt={displayName || 'Foto de Perfil'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 flex items-center justify-center text-white text-2xl sm:text-3xl font-black select-none tracking-wider shadow-inner">
                    {getInitials(displayName)}
                  </div>
                )}
              </div>

              {/* Botão Flutuante de Alterar Foto */}
              <button
                type="button"
                onClick={() => setShowPhotoOptions(!showPhotoOptions)}
                disabled={isUploadingPhoto || isSaving}
                className="absolute bottom-0 right-0 p-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-full shadow-lg shadow-emerald-950/60 border-2 border-slate-900 transition-all cursor-pointer disabled:opacity-50"
                title="Alterar Foto de Perfil"
                aria-label="Opções de foto de perfil"
              >
                {isUploadingPhoto ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
              </button>
            </div>

            <div>
              <p className="text-sm font-bold text-white">
                {displayName || 'Seu Nome'}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {user.email}
              </p>
            </div>

            {/* Menu Dropdown de Opções de Foto */}
            {showPhotoOptions && (
              <div className="w-full max-w-xs bg-slate-950 border border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150 text-left">
                {/* Opção 1: Câmera (Mobile / PWA / Webcam) */}
                <button
                  type="button"
                  onClick={() => {
                    cameraInputRef.current?.click();
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Camera size={15} className="text-emerald-400" />
                  <span>Tirar Foto com a Câmera</span>
                </button>

                {/* Opção 2: Escolher da Galeria / Arquivo */}
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <ImageIcon size={15} className="text-teal-400" />
                  <span>Escolher da Galeria</span>
                </button>

                {/* Opção 3: Remover Foto (se já possuir) */}
                {activePhoto && (
                  <button
                    type="button"
                    onClick={() => setShowConfirmRemove(true)}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                    <span>Remover Foto de Perfil</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowPhotoOptions(false)}
                  className="w-full px-3 py-2 rounded-xl text-[11px] font-semibold text-slate-500 hover:text-slate-400 text-center transition-colors pt-1"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Diálogo de Confirmação de Remoção de Foto */}
            {showConfirmRemove && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl max-w-xs w-full text-center space-y-2">
                <p className="text-xs font-bold text-rose-200">
                  Deseja realmente remover sua foto de perfil?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmRemove(false)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md"
                  >
                    Remover
                  </button>
                </div>
              </div>
            )}

            {/* Aviso de Preview Pendente */}
            {previewPhoto && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                <span>Prévia de foto 1:1 pronta.</span>
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  className="underline hover:text-amber-300 font-bold ml-1 cursor-pointer"
                >
                  Descartar
                </button>
              </div>
            )}

            {/* Inputs de Arquivo Ocultos */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-4">
            {/* Campo Editável: Nome de Exibição */}
            <div>
              <label 
                htmlFor="user-display-name" 
                className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Nome de Exibição
              </label>
              <div className="relative">
                <input
                  id="user-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome completo ou de exibição"
                  minLength={2}
                  maxLength={60}
                  required
                  disabled={isSaving}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all disabled:opacity-50 min-h-[44px]"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Nome visível para a equipe nas sessões do DDS Online.
              </p>
            </div>

            {/* Campo Somente Leitura: E-mail da Conta */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={12} className="text-slate-500" />
                  E-mail da Conta
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  Somente leitura
                </span>
              </div>
              <div className="relative">
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  disabled
                  className="w-full bg-slate-950/60 border border-slate-800/70 rounded-xl px-3.5 py-3 text-sm text-slate-400 font-mono cursor-not-allowed min-h-[44px]"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                A alteração de e-mail é gerenciada pela administração no DDS Master.
              </p>
            </div>

            {/* Informações Corporativas e de Acesso (Informativas) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Empresa / Unidade
                </span>
                <p className="text-xs font-bold text-slate-300 mt-0.5 truncate">
                  {user.company || 'AM TST'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Função / Nível de Acesso
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-bold text-emerald-400">
                    {user.position || 'Técnico de Segurança'}
                  </span>
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">
                    {user.role || 'ORGANIZER'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-3 flex items-center gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving || isUploadingPhoto}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
