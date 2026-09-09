'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Users, FileText, CheckCircle2, 
  Smartphone, Download, Copy, Check, LogOut, 
  History, PlusCircle, Calendar, AlertTriangle, X, Radio, Clock, RefreshCw, Loader2, Filter, FileSpreadsheet,
  Camera, Image as ImageIcon, Trash2, Target, ExternalLink, Info, CheckSquare, Square, MapPin, Sparkles, ChevronRight, Eye
} from 'lucide-react';
import Link from 'next/link';
import { generateDdsPdf, generateConsolidatedDdsPdf } from '@/lib/pdfGenerator';
import GroupPhotoCapture from '@/components/GroupPhotoCapture';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';
import AttachmentManager, { DdsAttachment } from '@/components/AttachmentManager';
import DdsReportPreviewModal from '@/components/DdsReportPreviewModal';
import UserProfileModal from '@/components/UserProfileModal';
import OfflineSyncBadge from '@/components/OfflineSyncBadge';
import { cacheMeetingData } from '@/lib/offlineStorage';
import DdsLogo from '@/components/DdsLogo';

export default function AdminPanel() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'NEW_DDS' | 'HISTORY'>('NEW_DDS');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // Formulário do Novo DDS
  const [meetingType, setMeetingType] = useState<'PRESENTIAL' | 'REMOTE'>('PRESENTIAL');
  const [classification, setClassification] = useState('DDS');
  const [topic, setTopic] = useState('');
  const [farm, setFarm] = useState('');
  const [objective, setObjective] = useState('');
  const [programmaticContent, setProgrammaticContent] = useState('');
  const [newAttachments, setNewAttachments] = useState<DdsAttachment[]>([]);

  // Fotos da Equipe
  const [teamPhotos, setTeamPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);

  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [editAttachments, setEditAttachments] = useState<DdsAttachment[]>([]);
  const [isReviewingClose, setIsReviewingClose] = useState(false);
  const [previewMeeting, setPreviewMeeting] = useState<any | null>(null);
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  const formatDatetimeLocal = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  
  const handleSaveEditMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting) return;
    try {
      const res = await fetch('/api/reuniao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: editingMeeting.id,
          createdAt: editForm.createdAt ? new Date(editForm.createdAt).toISOString() : undefined,
          endedAt: editForm.endedAt ? new Date(editForm.endedAt).toISOString() : null,
          instructorName: editForm.instructorName,
          classification: editForm.classification,
          objective: editForm.objective,
          programmaticContent: editForm.programmaticContent,
          attachments: editAttachments
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('DDS atualizado com sucesso!', 'success');
        setEditingMeeting(null);
        if (data.meeting) {
          if (activeMeeting && activeMeeting.id === data.meeting.id) {
            setActiveMeeting(data.meeting);
          }
          setMeetingHistory(prev => prev.map(m => m.id === data.meeting.id ? data.meeting : m));
        }
        fetchAllData();
      } else {
        showToast('Erro ao atualizar: ' + (data.error || 'Falha no servidor'), 'error');
      }
    } catch {
      showToast('Erro de conexão ao tentar atualizar.', 'error');
    }
  };


  // Notificações
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<any>(null);
  const [editForm, setEditForm] = useState({ createdAt: '', endedAt: '', instructorName: '', classification: 'DDS', objective: '', programmaticContent: '' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  useEffect(() => {
    const auth = localStorage.getItem('dds_admin_auth');
    if (!auth) {
      window.location.replace('/');
      return;
    }
    try {
      const user = JSON.parse(auth);
      if (user && user.id) {
        setCurrentUser(user);
      } else {
        localStorage.removeItem('dds_admin_auth');
        window.location.replace('/');
      }
    } catch {
      localStorage.removeItem('dds_admin_auth');
      window.location.replace('/');
    }
  }, []);

  // Busca de Dados com Smart Diffing
  const fetchAllData = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      let url = `/api/reuniao?organizerId=${currentUser.id}&_t=${Date.now()}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      
      if (!res.ok) return;

      const data = await res.json();
      
      if (data.success) {
        if (data.meeting && data.meeting.status === 'LIVE') {
          setActiveMeeting(data.meeting);
          cacheMeetingData(data.meeting);

          if (data.meeting.groupPhoto && typeof data.meeting.groupPhoto === 'string') {
            if (teamPhotos.length === 0) setTeamPhotos([data.meeting.groupPhoto]);
          }
        } else {
          setActiveMeeting(null);
        }

        setMeetingHistory(data.history || []);
      }
    } catch (error) {
      console.error("Erro no polling:", error);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [currentUser?.id, startDate, endDate, teamPhotos.length]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchAllData();
      const interval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        fetchAllData();
      }, 20000);

      const handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && !document.hidden) {
          fetchAllData();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [currentUser?.id, fetchAllData]);

  const handleStartNewMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !farm.trim()) {
      showToast('Por favor, preencha o Tema e o Local.', 'error');
      return;
    }

    setIsCreatingMeeting(true);

    try {
      const res = await fetch('/api/reuniao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: topic.trim(), 
          farm: farm.trim(),
          type: meetingType,
          classification,
          objective: objective.trim(),
          programmaticContent: programmaticContent.trim(),
          organizerId: currentUser?.id,
          email: currentUser?.email,
          groupPhoto: teamPhotos.length > 0 ? teamPhotos[0] : null,
          attachments: newAttachments
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success && data.meeting) {
        setActiveMeeting(data.meeting);
        cacheMeetingData(data.meeting);
        setIsLiveMode(true);
        setTopic('');
        setObjective('');
        setProgrammaticContent('');
        setNewAttachments([]);
        showToast('DDS Iniciado com sucesso!', 'success');
      } else {
        showToast('Erro ao iniciar reunião: ' + (data.error || 'Falha no banco.'), 'error');
      }
    } catch (err: any) {
      showToast('Aviso: ' + (err?.message || 'Falha de comunicação.'), 'error');
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const handleAddTeamPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const updatedPhotos = [...teamPhotos, base64];
      setTeamPhotos(updatedPhotos);

      if (activeMeeting?.id) {
        await fetch('/api/reuniao', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId: activeMeeting.id, groupPhoto: updatedPhotos.length > 0 ? updatedPhotos[0] : null })
        });
      }
      showToast('Foto adicionada com sucesso!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async (indexToRemove: number) => {
    const updatedPhotos = teamPhotos.filter((_, idx) => idx !== indexToRemove);
    setTeamPhotos(updatedPhotos);

    if (activeMeeting?.id) {
      await fetch('/api/reuniao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: activeMeeting.id, groupPhoto: updatedPhotos.length > 0 ? updatedPhotos[0] : null })
      });
    }
    showToast('Foto removida.', 'info');
  };

  const handleCopyInviteLink = () => {
    if (!activeMeeting) return;
    const inviteUrl = `${window.location.origin}/reuniao/${activeMeeting.id}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    showToast('Link copiado! Envie no grupo da equipe.', 'success');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleDownloadActivePdf = async () => {
    if (!activeMeeting || !activeMeeting.attendees || activeMeeting.attendees.length === 0) {
      showToast('Ainda não há presenças registradas nesta reunião.', 'error');
      return;
    }
    showToast('Carregando dados completos da reunião...', 'info');
    try {
      let fullMeeting = activeMeeting;
      if (activeMeeting.id) {
        const res = await fetch(`/api/reuniao?id=${activeMeeting.id}&full=true`);
        const data = await res.json();
        if (data.success && data.meeting) {
          fullMeeting = data.meeting;
        }
      }
      showToast('Gerando Ata Oficial em PDF consolidado com evidências...', 'info');
      await generateDdsPdf({
        topic: fullMeeting.topic,
        farm: fullMeeting.farm,
        type: fullMeeting.type,
        objective: fullMeeting.objective,
        programmaticContent: fullMeeting.programmaticContent,
        classification: fullMeeting.classification,
        instructorName: fullMeeting.instructorName,
        endedAt: fullMeeting.endedAt,
        organizer: fullMeeting.organizer,
        groupPhoto: teamPhotos.length > 0 ? teamPhotos[0] : fullMeeting.groupPhoto,
        createdAt: fullMeeting.createdAt,
        attendees: fullMeeting.attendees,
        attachments: fullMeeting.attachments || newAttachments || []
      });
      showToast('Ata em PDF gerada com sucesso!', 'success');
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      showToast('Erro ao compilar o PDF da ata.', 'error');
    }
  };

  const handleDownloadHistoryPdf = async (meeting: any) => {
    if (!meeting.attendees || meeting.attendees.length === 0) {
      showToast('Esta reunião não possui presenças registradas.', 'error');
      return;
    }
    showToast('Carregando dados completos da reunião...', 'info');
    try {
      let fullMeeting = meeting;
      const hasFullSignatures = meeting.attendees.some((a: any) => a.signature);
      if (!hasFullSignatures && meeting.id) {
        const res = await fetch(`/api/reuniao?id=${meeting.id}&full=true`);
        const data = await res.json();
        if (data.success && data.meeting) {
          fullMeeting = data.meeting;
        }
      }
      showToast('Gerando Ata Oficial em PDF com evidências...', 'info');
      await generateDdsPdf({
        topic: fullMeeting.topic,
        farm: fullMeeting.farm,
        type: fullMeeting.type,
        classification: fullMeeting.classification,
        instructorName: fullMeeting.instructorName,
        endedAt: fullMeeting.endedAt,
        organizer: fullMeeting.organizer,
        objective: fullMeeting.objective,
        programmaticContent: fullMeeting.programmaticContent,
        groupPhoto: fullMeeting.groupPhoto,
        createdAt: fullMeeting.createdAt,
        attendees: fullMeeting.attendees,
        attachments: fullMeeting.attachments || []
      });
      showToast('Ata em PDF gerada com sucesso!', 'success');
    } catch (e) {
      console.error('Erro ao gerar PDF histórico:', e);
      showToast('Erro ao compilar o PDF da ata.', 'error');
    }
  };

  const handleOpenPreview = async (meeting: any) => {
    if (!meeting?.id) return;
    try {
      showToast('Carregando prévia completa...', 'info');
      const res = await fetch(`/api/reuniao?id=${meeting.id}&full=true`);
      const data = await res.json();
      if (data.success && data.meeting) {
        const full = data.meeting;
        setPreviewMeeting({
          ...full,
          groupPhoto: (teamPhotos.length > 0 && activeMeeting && activeMeeting.id === full.id) ? teamPhotos[0] : full.groupPhoto,
          attachments: full.attachments || (activeMeeting && activeMeeting.id === full.id ? (activeMeeting.attachments || newAttachments) : []) || []
        });
      } else {
        setPreviewMeeting(meeting);
      }
    } catch (e) {
      console.error("Erro ao abrir prévia:", e);
      setPreviewMeeting(meeting);
    }
  };

  const handleOpenEditModal = async (m: any) => {
    setEditingMeeting(m);
    setEditAttachments(m.attachments || []);
    setEditForm({
      createdAt: formatDatetimeLocal(m.createdAt),
      endedAt: m.endedAt ? formatDatetimeLocal(m.endedAt) : '',
      instructorName: m.instructorName || '',
      classification: m.classification || 'DDS',
      objective: m.objective || '',
      programmaticContent: m.programmaticContent || ''
    });

    if (m.attachments && m.attachments.length > 0 && m.id) {
      try {
        const res = await fetch(`/api/reuniao?id=${m.id}&full=true`);
        const data = await res.json();
        if (data.success && data.meeting?.attachments) {
          setEditAttachments(data.meeting.attachments);
        }
      } catch (err) {
        console.warn("Erro ao buscar anexos completos para edição:", err);
      }
    }
  };

  const handleDeleteMeetings = (ids: string[], isMultiple = false, topicName = '') => {
    setConfirmDialog({
      title: isMultiple ? 'Exclusão Múltipla' : 'Excluir DDS',
      message: `⚠️ Tem certeza que deseja excluir permanentemente ${isMultiple ? `${ids.length} reuniões selecionadas` : `o DDS "${topicName}"`} e todas as presenças vinculadas?`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/reuniao', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meetingIds: ids })
          });
          const data = await res.json();
          if (data.success) {
            showToast('Excluído com sucesso!', 'success');
            setSelectedMeetings([]);
            fetchAllData();
          } else {
            showToast('Erro ao excluir: ' + (data.error || 'Falha no servidor.'), 'error');
          }
        } catch {
          showToast('Erro de conexão ao tentar excluir.', 'error');
        }
        setConfirmDialog(null);
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedMeetings.length === meetingHistory.length) {
      setSelectedMeetings([]);
    } else {
      setSelectedMeetings(meetingHistory.map(m => m.id));
    }
  };

  const toggleSelectMeeting = (id: string) => {
    if (selectedMeetings.includes(id)) {
      setSelectedMeetings(prev => prev.filter(mId => mId !== id));
    } else {
      setSelectedMeetings(prev => [...prev, id]);
    }
  };

  const handleDownloadConsolidatedPdf = () => {
    if (meetingHistory.length === 0) {
      showToast('Não há reuniões no período selecionado.', 'error');
      return;
    }
    showToast('Gerando Dossiê Consolidado...', 'info');
    generateConsolidatedDdsPdf({
      organizerName: currentUser?.name || 'Técnico de Segurança',
      companyName: currentUser?.company || 'Unidade Rural',
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      meetings: meetingHistory
    });
  };

  const handleEndMeeting = () => {
    setIsReviewingClose(true);
  };

  const handleConfirmCloseDds = async () => {
    try {
      if (activeMeeting && activeMeeting.attendees && activeMeeting.attendees.length > 0) {
        await handleDownloadActivePdf();
      }
      await fetch('/api/reuniao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: activeMeeting?.id })
      });
      setIsLiveMode(false);
      setIsReviewingClose(false);
      setActiveMeeting(null);
      setTeamPhotos([]);
      fetchAllData();
      showToast('DDS Encerrado! Ata arquivada com sucesso.', 'success');
    } catch (e) {
      showToast('Erro ao encerrar DDS.', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dds_admin_auth');
    window.location.replace('/');
  };

  // =========================================================================
  // SALA DO DDS EM ANDAMENTO (MODO TRANSMISSÃO)
  // =========================================================================
  if (isLiveMode && activeMeeting) {
    const isPresential = activeMeeting.type === 'PRESENTIAL';

    return (
      <main className="min-h-screen bg-slate-950 p-3 sm:p-6 font-sans text-white flex flex-col justify-between">
        {/* Toast rendering removed as requested */}
        
        {/* EDIT MODAL */}
        {editingMeeting && (
          <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl max-w-xl w-full max-h-[92dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-slate-900/90 backdrop-blur-md pb-2 z-10 border-b border-slate-800">
                <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                  <span className="text-emerald-400">✏️</span>
                  Editar Treinamento / DDS
                </h2>
                <button onClick={() => setEditingMeeting(null)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSaveEditMeeting} className="space-y-4">

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Tipo de Conteúdo</label>
                  <select
                    value={editForm.classification}
                    onChange={(e) => setEditForm({...editForm, classification: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white font-bold focus:border-emerald-500 outline-none min-h-[44px]"
                  >
                    <option value="DDS">DDS</option>
                    <option value="Treinamento">Treinamento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Responsável pelo Treinamento / DDS</label>
                  <input
                    type="text"
                    value={editForm.instructorName}
                    onChange={(e) => setEditForm({...editForm, instructorName: e.target.value})}
                    placeholder={currentUser?.name || 'Nome do Instrutor'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white font-bold focus:border-emerald-500 outline-none min-h-[44px]"
                  />
                </div>
                

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Objetivo</label>
                  <textarea
                    rows={2}
                    value={editForm.objective}
                    onChange={(e) => setEditForm({...editForm, objective: e.target.value})}
                    placeholder="Objetivo do DDS / Treinamento..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-xs text-white font-medium focus:border-emerald-500 outline-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Conteúdo Programático</span>
                    <span className="text-[10px] text-emerald-400 font-normal lowercase">sai na ata em pdf</span>
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.programmaticContent}
                    onChange={(e) => setEditForm({...editForm, programmaticContent: e.target.value})}
                    placeholder="Ex: Módulo 1: Conceitos e NRs&#10;Módulo 2: Procedimentos de segurança&#10;Módulo 3: Prática operacional"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-xs text-white font-medium focus:border-emerald-500 outline-none leading-relaxed font-sans"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Data/Hora Início</label>
                    <input
                      type="datetime-local"
                      value={editForm.createdAt}
                      onChange={(e) => setEditForm({...editForm, createdAt: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base sm:text-xs text-white font-medium focus:border-emerald-500 outline-none min-h-[44px]"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Data/Hora Fim</label>
                    <input
                      type="datetime-local"
                      value={editForm.endedAt}
                      onChange={(e) => setEditForm({...editForm, endedAt: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base sm:text-xs text-white font-medium focus:border-emerald-500 outline-none min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Gestão de Anexos no Modal de Edição */}
                <div className="pt-2 border-t border-slate-800">
                  <AttachmentManager
                    attachments={editAttachments}
                    onChange={setEditAttachments}
                  />
                </div>
                
                <div className="flex gap-2.5 pt-3">
                  <button type="button" onClick={() => setEditingMeeting(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors min-h-[44px]">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all min-h-[44px]">Salvar Alterações</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Revisão & Fechamento Oficial do DDS */}
        {isReviewingClose && activeMeeting && (
          <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl max-w-lg w-full max-h-[92dvh] overflow-y-auto shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 size={22} />
                  <h2 className="text-base font-extrabold text-white">Revisão & Fechamento do DDS</h2>
                </div>
                <button onClick={() => setIsReviewingClose(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                  <p className="text-slate-300">Tema: <strong className="text-white">{activeMeeting.topic}</strong></p>
                  <p className="text-slate-300">Local: <strong className="text-white">{activeMeeting.farm}</strong></p>
                  <p className="text-slate-300">Total de Participantes: <strong className="text-emerald-400 font-bold">{activeMeeting.attendees?.length || 0} colaboradores</strong></p>
                  <p className="text-slate-300">Foto da Equipe: <strong className={teamPhotos.length > 0 || activeMeeting.groupPhoto ? "text-emerald-400" : "text-amber-400"}>
                    {teamPhotos.length > 0 || activeMeeting.groupPhoto ? "✓ Registrada" : "Não registrada"}
                  </strong></p>
                </div>

                {/* Resumo de Evidências */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">Evidências / Material Apresentado:</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                      {(activeMeeting.attachments?.length || 0)} anexo(s)
                    </span>
                  </div>
                  {(!activeMeeting.attachments || activeMeeting.attachments.length === 0) ? (
                    <p className="text-[11px] text-slate-500 italic">Nenhum anexo adicional foi incluído nesta sessão.</p>
                  ) : (
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {activeMeeting.attachments.map((att: any, i: number) => (
                        <li key={i} className="text-[11px] text-slate-300 flex items-center gap-1.5 truncate">
                          <span className="text-emerald-400 font-mono">#{i+1}</span>
                          <span className="truncate">{att.displayName || att.fileName}</span>
                          <span className="text-slate-500 text-[10px]">({att.mimeType === 'application/pdf' ? 'PDF' : 'Imagem'})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOpenPreview(activeMeeting)}
                  className="flex-1 py-3 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-emerald-700/60 transition-all min-h-[44px]"
                >
                  <Eye size={15} />
                  <span>Prévia da Lista</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadActivePdf}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 transition-all min-h-[44px]"
                >
                  <Download size={15} />
                  <span>Baixar Ata em PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCloseDds}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all min-h-[44px]"
                >
                  Confirmar Encerramento
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmDialog && (
          <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-3 text-amber-400">
                <AlertTriangle size={22} />
                <h2 className="text-base font-extrabold text-white">{confirmDialog.title}</h2>
              </div>
              <p className="text-xs text-slate-300 mb-5 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex gap-2.5">
                <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors">Cancelar</button>
                <button onClick={confirmDialog.onConfirm} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all">Confirmar</button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
          {/* Badge de Sincronização e Fila Offline */}
          <OfflineSyncBadge meetingId={activeMeeting?.id} onSyncComplete={() => fetchAllData()} />

          {/* Header Superior */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl">
            <div className="flex items-center gap-2.5">
              <DdsLogo size="sm" showSubtitle={false} clickable href="/admin" />
              <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-lg border border-slate-700 ml-1">
                {isPresential ? '📍 Presencial' : '💻 EAD'}
              </span>
            </div>

            
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer" title="Adicionar Logo da Empresa ao PDF">
                <span>➕ Logo Empresa</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      localStorage.setItem('dds_company_logo', reader.result as string);
                      alert('Logo salva! Ela aparecerá no canto superior direito das próximas Atas em PDF.');
                    };
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>

              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800 transition-colors text-left cursor-pointer"
                title="Abrir Meu Perfil"
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 ring-2 ring-emerald-500/40 p-0.5 shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
                  {currentUser?.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-[10px] font-black select-none">
                      {currentUser?.name ? (
                        currentUser.name.split(' ').length > 1
                          ? (currentUser.name.split(' ')[0][0] + currentUser.name.split(' ')[currentUser.name.split(' ').length - 1][0]).toUpperCase()
                          : currentUser.name.slice(0, 2).toUpperCase()
                      ) : 'TST'}
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Técnico: <strong className="text-white hover:text-emerald-300 transition-colors">{currentUser?.name}</strong>
                </span>
              </button>
              <button 
                onClick={() => setIsLiveMode(false)} 
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                Voltar ao Painel
              </button>
            </div>
          </header>

          {/* Banner de Status do DDS */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 rounded-3xl p-4 sm:p-6 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-emerald-500/40 overflow-hidden max-w-full">
            <div className="min-w-0 max-w-full overflow-hidden space-y-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span className="font-bold text-emerald-200 uppercase tracking-widest text-[10px]">
                  {isPresential ? 'DDS Presencial em Andamento' : 'DDS EAD Ao Vivo'}
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black break-words leading-snug">{activeMeeting.topic}</h2>
              <p className="text-emerald-100 text-xs sm:text-sm mt-0.5 flex items-center gap-1 break-words">
                <MapPin size={12} className="shrink-0 text-emerald-300" />
                <span className="break-words">{activeMeeting.farm}</span>
              </p>
              {activeMeeting.objective && (
                <p className="text-emerald-200/90 text-xs mt-1 italic break-words">🎯 Objetivo: {activeMeeting.objective}</p>
              )}
              {activeMeeting.programmaticContent && (
                <p className="text-teal-200/90 text-xs mt-1 whitespace-pre-line break-words">📚 Conteúdo: {activeMeeting.programmaticContent}</p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 shrink-0">
              <button 
                onClick={() => {
                  setEditingMeeting(activeMeeting);
                  setEditForm({
                    createdAt: formatDatetimeLocal(activeMeeting.createdAt),
                    endedAt: activeMeeting.endedAt ? formatDatetimeLocal(activeMeeting.endedAt) : '',
                    instructorName: activeMeeting.instructorName || activeMeeting.organizer?.name || '',
                    classification: activeMeeting.classification || 'DDS',
                    objective: activeMeeting.objective || '',
                    programmaticContent: activeMeeting.programmaticContent || ''
                  });
                }}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm text-xs cursor-pointer border border-slate-700 min-h-[40px]"
              >
                <span>✏️ Editar</span>
              </button>
              <button 
                onClick={handleCopyInviteLink} 
                className="px-3.5 py-2.5 bg-white text-slate-950 hover:bg-slate-100 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-md text-xs cursor-pointer min-h-[40px]"
              >
                {copiedLink ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
              <button 
                onClick={() => handleOpenPreview(activeMeeting)} 
                className="px-3.5 py-2.5 bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-500/50 text-emerald-300 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm text-xs cursor-pointer min-h-[40px]"
                title="Pré-visualizar Lista de Presença e Dossiê Completo"
              >
                <Eye size={16} />
                <span>Prévia</span>
              </button>
              <button 
                onClick={handleDownloadActivePdf} 
                className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/40 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm text-xs cursor-pointer min-h-[40px]"
              >
                <Download size={16} />
                <span>Ata PDF</span>
              </button>
              <button 
                onClick={handleEndMeeting} 
                className="px-3.5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all text-xs shadow-md cursor-pointer ml-auto sm:ml-0 min-h-[40px]"
              >
                Encerrar DDS
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            <div className="lg:col-span-7 space-y-4">
              {isPresential ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
                  <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                        <Smartphone size={16} className="text-emerald-400" /> Coleta de Presença em Campo
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Passe o dispositivo para os colaboradores registrarem presença com foto facial e assinatura eletrônica.</p>
                    </div>

                    <Link href={`/presencial?id=${activeMeeting.id}`}>
                      <button className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer">
                        <Smartphone size={14} /> Abrir Coleta
                      </button>
                    </Link>
                  </div>

                  <div className="space-y-3 pt-2">
                    <GroupPhotoCapture 
                      initialPhoto={teamPhotos.length > 0 ? teamPhotos[0] : null}
                      onPhotoChange={(photoDataUrl) => {
                        if (photoDataUrl) {
                          setTeamPhotos([photoDataUrl]);
                          if (activeMeeting) {
                            fetch('/api/reuniao', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ meetingId: activeMeeting.id, groupPhoto: photoDataUrl })
                            }).catch(console.error);
                          }
                        } else {
                          setTeamPhotos([]);
                          if (activeMeeting) {
                            fetch('/api/reuniao', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ meetingId: activeMeeting.id, groupPhoto: null })
                            }).catch(console.error);
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <DdsConferenceRoom
                  roomName={activeMeeting.id}
                  userName={`${currentUser?.name || 'Técnico'} (DDS ON)`}
                  isAdmin={true}
                />
              )}

              {/* Seção de Evidências e Material Apresentado na Sala Ativa */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl">
                <AttachmentManager
                  attachments={activeMeeting.attachments || []}
                  onChange={(updated) => setActiveMeeting((prev: any) => ({ ...prev, attachments: updated }))}
                  onSaveToMeeting={async (updated) => {
                    await fetch('/api/reuniao', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ meetingId: activeMeeting.id, attachments: updated })
                    });
                    showToast('Evidências atualizadas no DDS!', 'success');
                  }}
                />
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl flex items-center justify-around text-center shadow-lg">
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {activeMeeting.attendees?.filter((a: any) => !a.leftAt && !a.exitReason).length || 0}
                  </span>
                  <span className="text-slate-400 text-[10px] sm:text-xs block mt-0.5">Online no DDS</span>
                </div>
                <div className="h-8 w-[1px] bg-slate-800"></div>
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">{activeMeeting.attendees?.length || 0}</span>
                  <span className="text-slate-400 text-[10px] sm:text-xs block mt-0.5">Total Auditadas</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-white flex items-center gap-2 text-xs sm:text-sm">
                    <FileText size={16} className="text-emerald-400" /> Lista de Presença ao Vivo
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Atualização em Tempo Real
                  </span>
                </div>
                
                {(!activeMeeting.attendees || activeMeeting.attendees.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    <p>Nenhum colaborador assinou ainda.</p>
                    <p className="text-[10px] text-slate-600 mt-1">Copie o link acima e envie para a equipe.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {activeMeeting.attendees.map((attendee: any, idx: number) => {
                      const hasLeft = Boolean(attendee.leftAt || attendee.exitReason);

                      return (
                        <div key={idx} className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          hasLeft 
                            ? 'bg-slate-950/60 border-amber-500/30 opacity-75' 
                            : 'bg-slate-950 border-slate-800'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {attendee.selfie ? (
                              <img src={attendee.selfie} alt={attendee.name} className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                                {attendee.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{attendee.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{attendee.cpf}</p>
                            </div>
                          </div>

                          {hasLeft ? (
                            <span 
                              className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0"
                              title={attendee.exitReason ? `Motivo: ${attendee.exitReason}` : 'Saída Registrada'}
                            >
                              Saída
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                              Presente
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Pré-Visualização de Documento e Lista de Presença na Sala Ativa */}
        {previewMeeting && (
          <DdsReportPreviewModal
            meeting={{
              topic: previewMeeting.topic,
              farm: previewMeeting.farm,
              type: previewMeeting.type,
              classification: previewMeeting.classification,
              instructorName: previewMeeting.instructorName,
              endedAt: previewMeeting.endedAt,
              organizer: previewMeeting.organizer,
              objective: previewMeeting.objective,
              programmaticContent: previewMeeting.programmaticContent,
              groupPhoto: previewMeeting.groupPhoto,
              createdAt: previewMeeting.createdAt,
              attendees: previewMeeting.attendees || [],
              attachments: previewMeeting.attachments || []
            }}
            onClose={() => setPreviewMeeting(null)}
            onDownloadPdf={() => handleDownloadActivePdf()}
          />
        )}

        {/* Modal de Meu Perfil (na Sala Ativa) */}
        {currentUser && (
          <UserProfileModal
            user={currentUser}
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            onProfileUpdated={(updated) => {
              setCurrentUser((prev: any) => ({ ...prev, ...updated }));
              showToast('Perfil atualizado com sucesso!', 'success');
            }}
          />
        )}
      </main>
    );
  }

  // =========================================================================
  // DASHBOARD PRINCIPAL (NOVO DDS / HISTÓRICO)
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-950 p-3 sm:p-6 font-sans text-slate-100">

{/* EDIT MODAL */}
        {editingMeeting && (
          <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-slate-900/90 backdrop-blur-md pb-2 z-10 border-b border-slate-800">
                <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                  <span className="text-emerald-400">✏️</span>
                  Editar Treinamento / DDS
                </h2>
                <button onClick={() => setEditingMeeting(null)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSaveEditMeeting} className="space-y-3.5">

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Tipo de Conteúdo</label>
                  <select
                    value={editForm.classification}
                    onChange={(e) => setEditForm({...editForm, classification: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white font-bold focus:border-emerald-500 outline-none min-h-[44px]"
                  >
                    <option value="DDS">DDS</option>
                    <option value="Treinamento">Treinamento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Responsável pelo Treinamento / DDS</label>
                  <input
                    type="text"
                    value={editForm.instructorName}
                    onChange={(e) => setEditForm({...editForm, instructorName: e.target.value})}
                    placeholder={currentUser?.name || 'Nome do Instrutor'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white font-bold focus:border-emerald-500 outline-none min-h-[44px]"
                  />
                </div>
                

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Objetivo</label>
                  <textarea
                    rows={2}
                    value={editForm.objective}
                    onChange={(e) => setEditForm({...editForm, objective: e.target.value})}
                    placeholder="Objetivo do DDS / Treinamento..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-xs text-white font-medium focus:border-emerald-500 outline-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Conteúdo Programático</span>
                    <span className="text-[10px] text-emerald-400 font-normal lowercase">sai na ata em pdf</span>
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.programmaticContent}
                    onChange={(e) => setEditForm({...editForm, programmaticContent: e.target.value})}
                    placeholder="Ex: Módulo 1: Conceitos e NRs&#10;Módulo 2: Procedimentos de segurança&#10;Módulo 3: Prática operacional"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-xs text-white font-medium focus:border-emerald-500 outline-none leading-relaxed font-sans"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Data/Hora Início</label>
                    <input
                      type="datetime-local"
                      value={editForm.createdAt}
                      onChange={(e) => setEditForm({...editForm, createdAt: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base sm:text-xs text-white font-medium focus:border-emerald-500 outline-none min-h-[44px]"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Data/Hora Fim</label>
                    <input
                      type="datetime-local"
                      value={editForm.endedAt}
                      onChange={(e) => setEditForm({...editForm, endedAt: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base sm:text-xs text-white font-medium focus:border-emerald-500 outline-none min-h-[44px]"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2.5 pt-3">
                  <button type="button" onClick={() => setEditingMeeting(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors min-h-[44px]">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all min-h-[44px]">Salvar Alterações</button>
                </div>
              </form>
            </div>
          </div>
        )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-3 text-amber-400">
              <AlertTriangle size={22} />
              <h2 className="text-base font-extrabold text-white">{confirmDialog.title}</h2>
            </div>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors">Cancelar</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl w-full mx-auto space-y-4 sm:space-y-6">
        {/* Topbar do Painel */}
        <header className="w-full bg-slate-900 border border-slate-800 p-3.5 sm:p-5 rounded-3xl shadow-xl overflow-hidden max-w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 max-w-full">
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 overflow-hidden">
              <DdsLogo size="md" showText={false} clickable href="/admin" />
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center gap-2.5 min-w-0 p-1.5 -ml-1.5 rounded-2xl hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
                title="Abrir Meu Perfil"
              >
                {/* Avatar Circular com Foto ou Iniciais */}
                <div className="w-9 h-9 rounded-full bg-slate-800 ring-2 ring-emerald-500/30 group-hover:ring-emerald-400 p-0.5 shrink-0 flex items-center justify-center overflow-hidden transition-all shadow-md">
                  {currentUser?.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-xs font-black select-none">
                      {currentUser?.name ? (
                        currentUser.name.split(' ').length > 1
                          ? (currentUser.name.split(' ')[0][0] + currentUser.name.split(' ')[currentUser.name.split(' ').length - 1][0]).toUpperCase()
                          : currentUser.name.slice(0, 2).toUpperCase()
                      ) : 'TST'}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      <span>DDS</span>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">ON</span>
                    </h1>
                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                      Meu Perfil
                    </span>
                  </div>
                  
                  {/* Nome de usuário e empresa com contenção rigorosa e quebra limpa */}
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug overflow-hidden">
                    <p className="truncate sm:break-words font-medium">
                      <span className="text-slate-200 font-semibold group-hover:text-emerald-300 transition-colors">{currentUser?.name || 'Técnico de Segurança'}</span>
                      <span className="text-slate-400 block sm:inline sm:before:content-['•'] sm:before:mx-1.5 truncate">
                        {currentUser?.company || 'AM TST'}
                      </span>
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t border-slate-800/60 sm:border-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
              {activeMeeting && (
                <button
                  onClick={() => setIsLiveMode(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 animate-pulse cursor-pointer min-h-[38px]"
                >
                  <Radio size={14} /> DDS em Aberto
                </button>
              )}

              <div className="flex items-center gap-1">
                <label className="p-2 text-slate-400 hover:text-emerald-400 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-800 hover:border-slate-700 min-h-[38px]" title={companyLogo ? "Substituir Logo da Empresa" : "Adicionar Logo da Empresa ao PDF"}>
                  {companyLogo ? (
                    <img src={companyLogo} alt="Logo" className="h-5 w-auto rounded-sm object-contain bg-white" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  )}
                  <span className="text-xs font-bold">{companyLogo ? 'Mudar Logo' : 'Logo PDF'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const MAX_WIDTH = 400;
                          const MAX_HEIGHT = 200;
                          let width = img.width;
                          let height = img.height;

                          if (width > height) {
                            if (width > MAX_WIDTH) {
                              height *= MAX_WIDTH / width;
                              width = MAX_WIDTH;
                            }
                          } else {
                            if (height > MAX_HEIGHT) {
                              width *= MAX_HEIGHT / height;
                              height = MAX_HEIGHT;
                            }
                          }
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d');
                          ctx?.drawImage(img, 0, 0, width, height);
                          
                          const base64 = canvas.toDataURL('image/png', 0.8);
                          try {
                            localStorage.setItem('dds_company_logo', base64);
                            setCompanyLogo(base64);
                            showToast('Logo atualizada com sucesso!', 'success');
                          } catch (err) {
                            console.error(err);
                            showToast('Erro: Imagem muito grande.', 'error');
                          }
                        };
                        img.src = reader.result as string;
                      };
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
                
                {companyLogo && (
                  <button
                    onClick={() => {
                      localStorage.removeItem('dds_company_logo');
                      setCompanyLogo(null);
                      showToast('Logo removida.', 'info');
                    }}
                    className="p-2 text-slate-500 hover:text-red-400 rounded-xl hover:bg-slate-800 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                    title="Remover Logo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="Sair do Painel"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Badge de Sincronização e Fila Offline */}
        <OfflineSyncBadge meetingId={activeMeeting?.id} onSyncComplete={() => fetchAllData()} />

        {/* Abas de Navegação (Novo DDS vs Histórico) */}
        <div className="grid grid-cols-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl gap-1.5 shadow-lg">
          <button
            onClick={() => setActiveTab('NEW_DDS')}
            className={`py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'NEW_DDS'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <PlusCircle size={16} />
            <span>Iniciar Novo DDS</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <History size={16} />
            <span>Histórico & Atas ({meetingHistory.length})</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* ABA 1: NOVO DDS                                                       */}
        {/* ===================================================================== */}
        {activeTab === 'NEW_DDS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">Criar Nova Reunião de DDS</h2>
              <p className="text-xs text-slate-400 mt-0.5">Preencha os dados e escolha se a reunião será presencial ou com transmissão de vídeo.</p>
            </div>

            <form onSubmit={handleStartNewMeeting} className="space-y-4">
              {/* Seletor de Modalidade */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Modalidade do DDS
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMeetingType('PRESENTIAL')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      meetingType === 'PRESENTIAL'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white ring-2 ring-emerald-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-xs font-black flex items-center gap-1.5 text-emerald-400">
                      📍 Presencial
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Coleta de assinaturas e fotos no próprio aparelho em campo.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMeetingType('REMOTE')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      meetingType === 'REMOTE'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white ring-2 ring-emerald-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-xs font-black flex items-center gap-1.5 text-emerald-400">
                      💻 EAD (Vídeo P2P)
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Transmissão de áudio, vídeo e tela para colaboradores remotos.
                    </span>
                  </button>
                </div>
              </div>

              {/* Tema e Local */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Tipo de Conteúdo *</label>
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none min-h-[44px]"
                  >
                    <option value="DDS">DDS</option>
                    <option value="Treinamento">Treinamento</option>
                  </select>
                </div>
                <div></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Tema *
                  </label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex: Trabalho em Altura & EPIs"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Local *
                  </label>
                  <input
                    type="text"
                    required
                    value={farm}
                    onChange={(e) => setFarm(e.target.value)}
                    placeholder="Ex: Canteiro de Obras / Fazenda"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none min-h-[44px]"
                  />
                </div>
              </div>

                            {/* Objetivo */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Objetivo / Observações da Reunião
                </label>
                <textarea
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ex: Orientar os operadores de trator quanto à verificação diária do cinto e freios."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-base sm:text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none leading-relaxed"
                />
              </div>

              {/* Conteúdo Programático (Exibido apenas quando for Treinamento) */}
              <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Conteúdo Programático (Treinamento)</span>
                    <span className="text-[10px] text-emerald-400 font-normal lowercase">sai na ata em pdf</span>
                  </label>
                  <textarea
                    rows={3}
                    value={programmaticContent}
                    onChange={(e) => setProgrammaticContent(e.target.value)}
                    placeholder="Ex: Módulo 1: Legislação e NRs aplicáveis&#10;Módulo 2: Procedimentos de segurança e EPIs&#10;Módulo 3: Prática operacional e primeiros socorros."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-base sm:text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none leading-relaxed font-sans"
                  />
                </div>

              {/* Seção de Anexos / Evidências do Novo DDS */}
              <div className="pt-2 border-t border-slate-800/80">
                <AttachmentManager
                  attachments={newAttachments}
                  onChange={setNewAttachments}
                />
              </div>

              {/* Botão de Iniciar */}
              <button
                type="submit"
                disabled={isCreatingMeeting}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all cursor-pointer min-h-[48px]"
              >
                {isCreatingMeeting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Iniciando Reunião...</span>
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    <span>Abrir Sala do DDS Agora</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ABA 2: HISTÓRICO DE ATAS                                              */}
        {/* ===================================================================== */}
        {activeTab === 'HISTORY' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white">Histórico de DDS Realizados</h2>
                <p className="text-xs text-slate-400 mt-0.5">Consulte, exporte relatórios consolidados ou baixe atas individuais.</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {meetingHistory.length > 0 && (
                  <button
                    onClick={handleDownloadConsolidatedPdf}
                    className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer min-h-[40px]"
                  >
                    <Download size={14} />
                    <span>Exportar Dossiê Consolidado</span>
                  </button>
                )}

                {selectedMeetings.length > 0 && (
                  <button
                    onClick={() => handleDeleteMeetings(selectedMeetings, true)}
                    className="px-3.5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px]"
                  >
                    <Trash2 size={14} />
                    <span>Excluir ({selectedMeetings.length})</span>
                  </button>
                )}
              </div>
            </div>

            {meetingHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                Nenhum DDS registrado no histórico ainda.
              </div>
            ) : (
              <div className="space-y-2.5">
                {meetingHistory.map((m) => (
                  <div
                    key={m.id}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <label className="p-1 cursor-pointer shrink-0 mt-0.5 sm:mt-0" title="Selecionar este DDS">
                        <input
                          type="checkbox"
                          checked={selectedMeetings.includes(m.id)}
                          onChange={() => toggleSelectMeeting(m.id)}
                          className="w-5 h-5 rounded text-emerald-600 bg-slate-900 border-slate-700 cursor-pointer shrink-0"
                        />
                      </label>

                      <div className="min-w-0 max-w-full">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-extrabold text-white break-words">{m.topic}</span>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                            {m.type === 'PRESENTIAL' ? 'Presencial' : 'Remoto'}
                          </span>
                          {m.attachments && m.attachments.length > 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                              <FileText size={10} /> {m.attachments.length} {m.attachments.length === 1 ? 'anexo' : 'anexos'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 break-words">
                          📍 {m.farm} • {new Date(m.createdAt).toLocaleDateString('pt-BR')} às {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • <strong className="text-emerald-400">{m.attendees?.length || 0} presenças</strong>
                        </p>
                        {m.objective && (
                          <p className="text-[11px] text-emerald-400/90 mt-0.5 break-words italic font-medium">
                            🎯 {m.objective}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto pt-2 sm:pt-0 border-t border-slate-900 sm:border-0 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleOpenPreview(m)}
                        className="px-3.5 py-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-emerald-200 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-emerald-700/60 cursor-pointer min-h-[38px] transition-all shadow-sm"
                        title="Pré-visualizar Lista de Presença e Dossiê Completo"
                      >
                        <Eye size={13} />
                        <span>Visualizar Lista</span>
                      </button>

                      <button
                        onClick={() => handleDownloadHistoryPdf(m)}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 cursor-pointer min-h-[38px]"
                      >
                        <Download size={13} />
                        <span>Ata PDF</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(m)}
                        title="Editar Detalhes"
                        className="p-2 text-slate-400 hover:text-emerald-400 rounded-xl hover:bg-slate-800 border border-slate-800 hover:border-slate-700 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>

                      <button
                        onClick={() => handleDeleteMeetings([m.id], false, m.topic)}
                        className="p-2 text-slate-400 hover:text-red-400 rounded-xl hover:bg-slate-800 border border-slate-800 hover:border-slate-700 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors"
                        title="Excluir DDS"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rodapé Administrativo & Governança */}
        <footer className="mt-14 pt-6 border-t border-slate-800/80 text-center space-y-1.5 text-xs text-slate-500 pb-4">
          <p>© 2026 <strong>AM TST</strong>. Todos os direitos reservados.</p>
          <p className="text-[11px] text-slate-400 font-medium">
            <strong>DDS ON</strong> é uma plataforma da <strong>AM TST</strong> • Integrada ao DDS Master.
          </p>
          <div className="flex items-center justify-center gap-3 text-[11px] pt-0.5">
            <Link href="/termos" target="_blank" className="text-slate-400 hover:text-emerald-400 underline underline-offset-2 transition-colors">
              Termos de Uso
            </Link>
            <span>•</span>
            <Link href="/privacidade" target="_blank" className="text-slate-400 hover:text-emerald-400 underline underline-offset-2 transition-colors">
              Aviso de Privacidade (LGPD)
            </Link>
          </div>
        </footer>
      </div>

      {/* Modal de Pré-Visualização de Documento e Lista de Presença */}
      {previewMeeting && (
        <DdsReportPreviewModal
          meeting={{
            topic: previewMeeting.topic,
            farm: previewMeeting.farm,
            type: previewMeeting.type,
            classification: previewMeeting.classification,
            instructorName: previewMeeting.instructorName,
            endedAt: previewMeeting.endedAt,
            organizer: previewMeeting.organizer,
            objective: previewMeeting.objective,
            programmaticContent: previewMeeting.programmaticContent,
            groupPhoto: previewMeeting.groupPhoto,
            createdAt: previewMeeting.createdAt,
            attendees: previewMeeting.attendees || [],
            attachments: previewMeeting.attachments || []
          }}
          onClose={() => setPreviewMeeting(null)}
          onDownloadPdf={() => handleDownloadHistoryPdf(previewMeeting)}
        />
      )}

      {/* Modal de Meu Perfil */}
      {currentUser && (
        <UserProfileModal
          user={currentUser}
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onProfileUpdated={(updated) => {
            setCurrentUser((prev: any) => ({ ...prev, ...updated }));
            showToast('Perfil atualizado com sucesso!', 'success');
          }}
        />
      )}
    </main>
  );
}