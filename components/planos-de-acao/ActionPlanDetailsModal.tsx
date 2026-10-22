'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, AlertTriangle, Calendar, User, Clock, FileText, 
  Download, Image as ImageIcon, Camera, MessageSquare, History, 
  CheckCircle2, ArrowRight, Shield, Plus, Trash2, Loader2, Sparkles,
  ExternalLink, ChevronRight, Edit3, Send, CornerDownRight, CheckSquare,
  AlertCircle, Target
} from 'lucide-react';
import { 
  calculateDeadlineState, 
  calculatePlanProgress,
  STATUS_LABELS, 
  PRIORITY_LABELS, 
  CRITICALITY_LABELS, 
  ORIGIN_LABELS, 
  VERIFICATION_LABELS,
  ActionPlanStatus 
} from '@/lib/actionPlanUtils';
import { generateActionPlanIndividualPdf } from '@/lib/actionPlanPdfGenerator';
import { useAuth } from '@/context/AuthContext';

interface ActionPlanDetailsModalProps {
  planId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onPlanUpdated: () => void;
  onEditPlan?: (plan: any) => void;
}

export default function ActionPlanDetailsModal({
  planId,
  isOpen,
  onClose,
  onPlanUpdated,
  onEditPlan
}: ActionPlanDetailsModalProps) {
  const { user: currentUser } = useAuth();
  const [plan, setPlan] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TASKS' | 'PHOTOS' | 'EXTENSIONS' | 'VERIFICATION' | 'HISTORY' | 'COMMENTS'>('OVERVIEW');

  // Subações
  const [newSubactionDesc, setNewSubactionDesc] = useState('');
  const [isAddingSubaction, setIsAddingSubaction] = useState(false);

  // Comentários
  const [commentText, setCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Prorrogação
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [newDueDateReq, setNewDueDateReq] = useState('');
  const [extensionJustification, setExtensionJustification] = useState('');
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);

  // Verificação de Eficácia
  const [verifResult, setVerifResult] = useState<'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE'>('EFFECTIVE');
  const [verifNotes, setVerifNotes] = useState('');
  const [reopenIfIneffective, setReopenIfIneffective] = useState(true);
  const [isSubmittingVerif, setIsSubmittingVerif] = useState(false);

  // Evidências
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhotoType, setSelectedPhotoType] = useState<'BEFORE' | 'DURING' | 'AFTER' | 'COMPLEMENTARY'>('DURING');
  const [photoCaption, setPhotoCaption] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Carrega os detalhes completos do plano
  const loadPlanDetails = async () => {
    if (!planId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/planos-de-acao/${planId}`);
      const data = await res.json();
      if (data.success && data.plan) {
        setPlan(data.plan);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && planId) {
      loadPlanDetails();
    } else {
      setPlan(null);
    }
  }, [isOpen, planId]);

  if (!isOpen || !planId) return null;

  // Cálculos de prazo e progresso
  const deadline = plan ? calculateDeadlineState(plan.dueDate, plan.completedAt, plan.status, plan.alertDaysBefore || 7) : null;
  const progress = plan ? calculatePlanProgress(plan.tasks || [], plan.status) : 0;

  // Transições Rápidas de Status
  const handleTransitionStatus = async (nextStatus: ActionPlanStatus) => {
    if (!plan) return;
    try {
      const res = await fetch('/api/planos-de-acao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Falha ao atualizar status');
        return;
      }
      loadPlanDetails();
      onPlanUpdated();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status');
    }
  };

  // Toggle de Conclusão de Subação
  const handleToggleTask = async (task: any) => {
    const nextStatus = task.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED';
    try {
      const res = await fetch(`/api/planos-de-acao/${plan.id}/tarefas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, status: nextStatus })
      });
      if (res.ok) {
        loadPlanDetails();
        onPlanUpdated();
      }
    } catch (e) {}
  };

  // Criação de Nova Subação rápida
  const handleAddSubaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubactionDesc.trim() || !plan) return;
    setIsAddingSubaction(true);
    try {
      const res = await fetch(`/api/planos-de-acao/${plan.id}/tarefas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newSubactionDesc.trim(), weight: 1 })
      });
      if (res.ok) {
        setNewSubactionDesc('');
        loadPlanDetails();
        onPlanUpdated();
      }
    } finally {
      setIsAddingSubaction(false);
    }
  };

  // Envio de Comentário
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !plan) return;
    setIsSendingComment(true);
    try {
      const res = await fetch(`/api/planos-de-acao/${plan.id}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() })
      });
      if (res.ok) {
        setCommentText('');
        loadPlanDetails();
      }
    } finally {
      setIsSendingComment(false);
    }
  };

  // Envio de Foto / Evidência com Compressão Client-side
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !plan) return;

    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;

        // Comprime a imagem em canvas antes do upload para economizar banco e rede
        const img = new Image();
        img.src = base64Data;
        img.onload = async () => {
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          const res = await fetch(`/api/planos-de-acao/${plan.id}/evidencias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              displayName: photoCaption.trim() || file.name,
              fileData: compressedDataUrl,
              mimeType: 'image/jpeg',
              fileSize: Math.ceil((compressedDataUrl.length * 3) / 4),
              evidenceType: selectedPhotoType,
              caption: photoCaption.trim() || null
            })
          });

          if (res.ok) {
            setPhotoCaption('');
            loadPlanDetails();
            onPlanUpdated();
          } else {
            const err = await res.json();
            alert(err.error || 'Falha ao enviar imagem');
          }
          setIsUploadingPhoto(false);
        };
      };
      reader.readAsDataURL(file);
    } catch (e) {
      alert('Erro ao processar imagem');
      setIsUploadingPhoto(false);
    }
  };

  // Remoção de Evidência
  const handleDeletePhoto = async (attachmentId: string) => {
    if (!confirm('Deseja realmente remover esta evidência fotográfica?')) return;
    try {
      const res = await fetch(`/api/planos-de-acao/${plan.id}/evidencias?attachmentId=${attachmentId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadPlanDetails();
        onPlanUpdated();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao remover foto');
      }
    } catch (e) {}
  };

  // Solicitação de Prorrogação
  const handleRequestExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDueDateReq || !extensionJustification.trim() || !plan) return;
    setIsSubmittingExtension(true);
    try {
      const res = await fetch(`/api/planos-de-acao/${plan.id}/prorrogacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedDueDate: newDueDateReq,
          justification: extensionJustification.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Falha ao solicitar prorrogação');
        return;
      }
      setIsExtensionModalOpen(false);
      setNewDueDateReq('');
      setExtensionJustification('');
      loadPlanDetails();
      onPlanUpdated();
    } finally {
      setIsSubmittingExtension(false);
    }
  };

  // Decisão de Prorrogação (Aprovar / Rejeitar)
  const handleDecideExtension = async (extensionId: string, approved: boolean) => {
    const notes = prompt(`Observações da ${approved ? 'aprovação' : 'rejeição'}:`);
    try {
      const res = await fetch(`/api/planos-de-acao/${plan.id}/prorrogacao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId, approved, approvalNotes: notes || null })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Falha ao registrar decisão');
        return;
      }
      loadPlanDetails();
      onPlanUpdated();
    } catch (e) {}
  };

  // Submissão de Verificação de Eficácia
  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    setIsSubmittingVerif(true);
    try {
      const res = await fetch(`/api/planos-de-acao/${plan.id}/verificacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: verifResult,
          notes: verifNotes.trim() || null,
          reopenIfIneffective
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Falha ao validar eficácia');
        return;
      }
      alert('Verificação de eficácia registrada com sucesso!');
      loadPlanDetails();
      onPlanUpdated();
    } finally {
      setIsSubmittingVerif(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header com Código e Ações */}
        <div className="px-5 py-4 bg-[#0F1F38] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 shrink-0">
              {plan?.code || 'Carregando...'}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {plan?.title || 'Detalhes do Plano de Ação'}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {plan?.company?.name || 'DDS-ON Corporativo'} • {plan?.sector || 'Setor não informado'} • {ORIGIN_LABELS[plan?.origin] || plan?.origin}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {plan && (
              <button
                onClick={() => generateActionPlanIndividualPdf(plan)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Emitir Relatório Individual Completo em PDF"
              >
                <Download size={15} />
                <span className="hidden sm:inline">Baixar PDF</span>
              </button>
            )}

            {plan && onEditPlan && (
              <button
                onClick={() => {
                  onClose();
                  onEditPlan(plan);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 size={15} />
                <span className="hidden sm:inline">Editar</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra Rápida de Indicadores e Transição de Status */}
        {plan && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-3">
              {/* Badge de Status Atual */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Status:</span>
                <span className="px-2.5 py-1 rounded-md text-xs font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">
                  {STATUS_LABELS[plan.status as ActionPlanStatus] || plan.status}
                </span>
              </div>

              {/* Badge de Situação do Prazo */}
              {deadline && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Prazo:</span>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase border ${deadline.colorClass.bg} ${deadline.colorClass.text} ${deadline.colorClass.border}`}>
                    {deadline.label}
                  </span>
                </div>
              )}

              {/* Barra de Progresso */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-500">Progresso:</span>
                <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs font-black text-emerald-700">{progress}%</span>
              </div>
            </div>

            {/* Ações Rápidas de Avanço da Máquina de Estados */}
            <div className="flex items-center gap-1.5">
              {plan.status === 'OPEN' && (
                <button
                  onClick={() => handleTransitionStatus('IN_PROGRESS')}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition-all"
                >
                  <ArrowRight size={13} />
                  <span>Iniciar Execução</span>
                </button>
              )}

              {plan.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => handleTransitionStatus('AWAITING_VALIDATION')}
                  className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 transition-all"
                >
                  <CheckSquare size={13} />
                  <span>Concluir & Validar</span>
                </button>
              )}

              {plan.status === 'AWAITING_VALIDATION' && (
                <button
                  onClick={() => setActiveTab('VERIFICATION')}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all animate-pulse"
                >
                  <Shield size={13} />
                  <span>Validar Eficácia</span>
                </button>
              )}

              {plan.status === 'COMPLETED' && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Plano Concluído</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Abas de Navegação */}
        <div className="flex border-b border-slate-200 bg-white px-4 shrink-0 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'OVERVIEW'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={15} />
            <span>Visão Geral & Diagnóstico</span>
          </button>

          <button
            onClick={() => setActiveTab('TASKS')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'TASKS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare size={15} />
            <span>Subações & Etapas ({plan?.tasks?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('PHOTOS')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'PHOTOS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImageIcon size={15} />
            <span>Evidências Fotográficas ({plan?.attachments?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('EXTENSIONS')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'EXTENSIONS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock size={15} />
            <span>Prorrogações ({plan?.extensions?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('VERIFICATION')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'VERIFICATION'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield size={15} />
            <span>Verificação de Eficácia</span>
          </button>

          <button
            onClick={() => setActiveTab('COMMENTS')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'COMMENTS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare size={15} />
            <span>Comentários ({plan?.comments?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'HISTORY'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History size={15} />
            <span>Linha do Tempo</span>
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Carregando detalhes do plano de ação...</p>
            </div>
          ) : !plan ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              Plano de ação não encontrado ou sem permissão de acesso.
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* ABA 1: VISÃO GERAL & DIAGNÓSTICO */}
              {/* ========================================================================= */}
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-6">
                  {/* Resumo de Envolvidos e Prazos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Responsável Principal</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                        {plan.responsible?.name || 'Não atribuído'}
                      </p>
                      <span className="text-[10px] text-slate-500">{plan.responsible?.position || 'Executante'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Supervisor / Gestor</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                        {plan.supervisor?.name || 'Não atribuído'}
                      </p>
                      <span className="text-[10px] text-slate-500">Supervisão</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Prazo Final Limite</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">
                        {plan.dueDate ? new Date(plan.dueDate).toLocaleDateString('pt-BR') : 'A definir'}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {plan.originalDueDate && plan.originalDueDate !== plan.dueDate ? `(Original: ${new Date(plan.originalDueDate).toLocaleDateString('pt-BR')})` : 'Prazo original'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Verificador de Eficácia</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                        {plan.verifier?.name || 'Auditor SST Designado'}
                      </p>
                      <span className="text-[10px] text-slate-500">Validação final</span>
                    </div>
                  </div>

                  {/* Diagnóstico do Problema & Causa Raiz */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <AlertTriangle size={15} className="text-amber-600" />
                      <span>Diagnóstico do Problema & Análise de Riscos</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-bold text-slate-500 block text-[11px]">Situação Identificada:</span>
                        <p className="text-slate-800 mt-0.5 whitespace-pre-wrap">{plan.problemDescription || plan.description || 'Não detalhada.'}</p>
                      </div>

                      <div>
                        <span className="font-bold text-slate-500 block text-[11px]">Causa Raiz (5 Porquês / Ishikawa):</span>
                        <p className="text-slate-800 mt-0.5 font-semibold text-rose-900">{plan.rootCause || plan.identifiedCause || 'Em investigação.'}</p>
                      </div>

                      <div>
                        <span className="font-bold text-slate-500 block text-[11px]">Risco & Consequências Potenciais:</span>
                        <p className="text-slate-800 mt-0.5">{plan.identifiedRisk || '-'} • {plan.potentialConsequences || '-'}</p>
                      </div>

                      <div>
                        <span className="font-bold text-slate-500 block text-[11px]">Medidas Imediatas / Bloqueios Adotados:</span>
                        <p className="text-slate-800 mt-0.5">{plan.immediateMeasures || 'Nenhuma medida emergencial adotada.'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Ação Proposta (5W2H) */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-4 space-y-3">
                    <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-2">
                      <Target size={15} className="text-blue-600" />
                      <span>Ação Proposta & Critérios de Conclusão (5W2H)</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="md:col-span-2">
                        <span className="font-bold text-slate-600 block text-[11px]">Ação Corretiva / Preventiva (O Quê):</span>
                        <p className="text-slate-900 font-semibold mt-0.5 whitespace-pre-wrap">{plan.actionDescription || 'Ação padrão definida no cadastro.'}</p>
                      </div>

                      <div>
                        <span className="font-bold text-slate-600 block text-[11px]">Objetivo Específico:</span>
                        <p className="text-slate-800 mt-0.5">{plan.actionObjective || '-'}</p>
                      </div>

                      <div>
                        <span className="font-bold text-slate-600 block text-[11px]">Resultado Esperado:</span>
                        <p className="text-slate-800 mt-0.5">{plan.expectedResult || '-'}</p>
                      </div>

                      <div>
                        <span className="font-bold text-slate-600 block text-[11px]">Recursos Necessários:</span>
                        <p className="text-slate-800 mt-0.5">{plan.requiredResources || 'Recursos ordinários.'}</p>
                      </div>

                      <div>
                        <span className="font-bold text-slate-600 block text-[11px]">Critério de Conclusão / Aceite:</span>
                        <p className="text-slate-800 mt-0.5">{plan.completionCriteria || 'Verificação de conformidade no local.'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 2: SUBAÇÕES & ETAPAS EXECUTIVAS */}
              {/* ========================================================================= */}
              {activeTab === 'TASKS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">
                        Checklist de Subações & Etapas ({plan.tasks?.length || 0})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        O progresso geral do plano ({progress}%) é calculado ponderando o peso de cada subação concluída.
                      </p>
                    </div>

                    <form onSubmit={handleAddSubaction} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nova etapa rápida..."
                        value={newSubactionDesc}
                        onChange={e => setNewSubactionDesc(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
                      />
                      <button
                        type="submit"
                        disabled={isAddingSubaction || !newSubactionDesc.trim()}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        <Plus size={14} />
                        <span>Adicionar</span>
                      </button>
                    </form>
                  </div>

                  <div className="space-y-2">
                    {plan.tasks?.map((task: any, idx: number) => {
                      const isDone = task.status === 'COMPLETED';
                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            isDone ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleTask(task)}
                              className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                isDone 
                                  ? 'bg-emerald-600 border-emerald-600 text-white' 
                                  : 'border-slate-300 hover:border-blue-500 bg-white'
                              }`}
                            >
                              {isDone && <Check size={14} />}
                            </button>

                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {task.description}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                <span>Resp: {task.responsible?.name || plan.responsible?.name || 'Geral'}</span>
                                {task.dueDate && (
                                  <span>• Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                                )}
                                <span>• Peso: {task.weight || 1}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                            isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isDone ? 'Concluída' : 'Pendente'}
                          </span>
                        </div>
                      );
                    })}

                    {(!plan.tasks || plan.tasks.length === 0) && (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        Nenhuma subação cadastrada. O plano será gerenciado como atividade única.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 3: EVIDÊNCIAS FOTOGRÁFICAS (ANTES / DURANTE / DEPOIS) */}
              {/* ========================================================================= */}
              {activeTab === 'PHOTOS' && (
                <div className="space-y-4">
                  {/* Barra de Upload e Câmera */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Camera size={16} className="text-blue-600" />
                      <span>Anexar Evidência Fotográfica</span>
                    </h4>

                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={selectedPhotoType}
                        onChange={e => setSelectedPhotoType(e.target.value as any)}
                        className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 font-bold"
                      >
                        <option value="BEFORE">1. Antes da Intervenção</option>
                        <option value="DURING">2. Durante a Execução</option>
                        <option value="AFTER">3. Depois da Intervenção (Concluído)</option>
                        <option value="COMPLEMENTARY">4. Evidência Complementar</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Legenda da foto..."
                        value={photoCaption}
                        onChange={e => setPhotoCaption(e.target.value)}
                        className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                      />

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isUploadingPhoto ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                        <span>Tirar Foto / Galeria</span>
                      </button>
                    </div>
                  </div>

                  {/* Grade de Fotos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {plan.attachments?.map((att: any) => (
                      <div key={att.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col">
                        <div 
                          onClick={() => setLightboxImage(att.fileData)}
                          className="h-44 bg-slate-100 overflow-hidden relative cursor-pointer group"
                        >
                          <img
                            src={att.fileData}
                            alt={att.displayName || att.fileName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-2 left-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-white shadow-sm ${
                              att.evidenceType === 'BEFORE' 
                                ? 'bg-rose-600' 
                                : att.evidenceType === 'AFTER'
                                ? 'bg-emerald-600'
                                : 'bg-blue-600'
                            }`}>
                              {att.evidenceType === 'BEFORE' ? 'Antes' : att.evidenceType === 'AFTER' ? 'Depois' : att.evidenceType || 'Evidência'}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800 line-clamp-1">{att.caption || att.displayName || att.fileName}</p>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Enviado por {att.author?.name || 'Usuário'} em {new Date(att.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <button
                              onClick={() => setLightboxImage(att.fileData)}
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
                            >
                              Ampliar
                            </button>
                            <button
                              onClick={() => handleDeletePhoto(att.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Remover foto"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {(!plan.attachments || plan.attachments.length === 0) && (
                      <div className="col-span-full text-center py-12 text-slate-400 text-xs">
                        Nenhuma evidência fotográfica registrada. Clique no botão acima para capturar com o celular ou anexar da galeria.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 4: PRORROGAÇÕES DE PRAZO */}
              {/* ========================================================================= */}
              {activeTab === 'EXTENSIONS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">
                        Histórico & Solicitações de Prorrogação
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Governança de prazos com justificativas e aprovação de supervisores.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsExtensionModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Clock size={15} />
                      <span>Solicitar Prorrogação</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {plan.extensions?.map((ext: any) => (
                      <div key={ext.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              ext.status === 'APPROVED' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : ext.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {ext.status === 'APPROVED' ? 'Aprovada' : ext.status === 'REJECTED' ? 'Rejeitada' : 'Aguardando Decisão'}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Novo prazo solicitado: {new Date(ext.requestedDueDate).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <span className="text-[10px] text-slate-400">
                            {new Date(ext.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <strong className="text-slate-800">Justificativa:</strong> "{ext.justification}"
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>Solicitante: {ext.requester?.name || 'Responsável'}</span>
                          {ext.approver && (
                            <span>Decisão por: {ext.approver.name} ({new Date(ext.approvedAt).toLocaleDateString('pt-BR')})</span>
                          )}

                          {ext.status === 'PENDING' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDecideExtension(ext.id, true)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => handleDecideExtension(ext.id, false)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700"
                              >
                                Rejeitar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {(!plan.extensions || plan.extensions.length === 0) && (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        Nenhuma prorrogação de prazo registrada para este plano.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 5: VERIFICAÇÃO DE EFICÁCIA (VALIDAÇÃO SST) */}
              {/* ========================================================================= */}
              {activeTab === 'VERIFICATION' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <Shield size={16} className="text-emerald-600" />
                      <span>Parecer de Eficácia & Validação de Fechamento</span>
                    </h3>

                    {plan.verification ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600">Resultado Atual da Verificação:</span>
                          <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${
                            plan.verification.result === 'EFFECTIVE' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {VERIFICATION_LABELS[plan.verification.result as keyof typeof VERIFICATION_LABELS] || plan.verification.result}
                          </span>
                        </div>

                        <p className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200">
                          <strong>Parecer Técnico:</strong> {plan.verification.notes || 'Sem observações técnicas registradas.'}
                        </p>

                        <div className="text-[11px] text-slate-500">
                          Auditado por {plan.verification.verifier?.name || 'Auditor'} em {new Date(plan.verification.verifiedAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    ) : null}

                    {/* Formulário para registrar nova verificação */}
                    <form onSubmit={handleSubmitVerification} className="space-y-3 pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-700">Registrar / Atualizar Validação:</h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setVerifResult('EFFECTIVE')}
                          className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                            verifResult === 'EFFECTIVE'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          ✓ Eficaz (Concluir Plano)
                        </button>

                        <button
                          type="button"
                          onClick={() => setVerifResult('PARTIALLY_EFFECTIVE')}
                          className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                            verifResult === 'PARTIALLY_EFFECTIVE'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          ⚠ Parcialmente Eficaz
                        </button>

                        <button
                          type="button"
                          onClick={() => setVerifResult('INEFFECTIVE')}
                          className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                            verifResult === 'INEFFECTIVE'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          ✕ Ineficaz (Requer Reabertura)
                        </button>
                      </div>

                      {verifResult === 'INEFFECTIVE' && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="reopenCheckbox"
                            checked={reopenIfIneffective}
                            onChange={e => setReopenIfIneffective(e.target.checked)}
                            className="rounded text-rose-600"
                          />
                          <label htmlFor="reopenCheckbox" className="font-bold cursor-pointer">
                            Reabrir imediatamente o plano de ação para novas medidas corretivas
                          </label>
                        </div>
                      )}

                      <textarea
                        rows={3}
                        required
                        placeholder="Parecer técnico detalhado da eficácia das medidas implementadas..."
                        value={verifNotes}
                        onChange={e => setVerifNotes(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />

                      <button
                        type="submit"
                        disabled={isSubmittingVerif || !verifNotes.trim()}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                      >
                        {isSubmittingVerif ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        <span>Confirmar Validação de Eficácia</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 6: COMENTÁRIOS E APONTAMENTOS */}
              {/* ========================================================================= */}
              {activeTab === 'COMMENTS' && (
                <div className="space-y-4">
                  <form onSubmit={handleSendComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Adicionar comentário ou apontamento técnico de acompanhamento..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={isSendingComment || !commentText.trim()}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {isSendingComment ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      <span>Enviar</span>
                    </button>
                  </form>

                  <div className="space-y-3">
                    {plan.comments?.map((c: any) => (
                      <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{c.author?.name || 'Usuário'}</span>
                          <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))}

                    {(!plan.comments || plan.comments.length === 0) && (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        Nenhum comentário registrado até o momento.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ABA 7: LINHA DO TEMPO / HISTÓRICO AUDITÁVEL */}
              {/* ========================================================================= */}
              {activeTab === 'HISTORY' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Linha do Tempo Auditável do Plano</h4>
                  <div className="border-l-2 border-slate-200 pl-4 space-y-4 ml-2">
                    {plan.history?.map((h: any) => (
                      <div key={h.id} className="relative">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600 absolute -left-[21px] top-1 border-2 border-white" />
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(h.createdAt).toLocaleString('pt-BR')} • {h.user?.name || 'Sistema'}
                        </span>
                        <p className="text-xs text-slate-700 font-semibold mt-0.5">{h.details}</p>
                      </div>
                    ))}

                    {(!plan.history || plan.history.length === 0) && (
                      <div className="text-slate-400 text-xs">Sem eventos de histórico.</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Secundário: Solicitação de Prorrogação */}
      {isExtensionModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Solicitar Prorrogação de Prazo</h3>
              <button onClick={() => setIsExtensionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRequestExtension} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Novo Prazo Solicitado</label>
                <input
                  type="date"
                  required
                  value={newDueDateReq}
                  onChange={e => setNewDueDateReq(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Justificativa Técnica Fundamentada</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explique o motivo do atraso e por que o novo prazo é necessário..."
                  value={extensionJustification}
                  onChange={e => setExtensionJustification(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExtensionModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-slate-600 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExtension}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  {isSubmittingExtension && <Loader2 size={14} className="animate-spin" />}
                  <span>Enviar Solicitação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox para Visualização Ampliada de Imagens */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={lightboxImage}
            alt="Evidência ampliada"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
