'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Users, FileText, CheckCircle2, 
  Smartphone, Download, Copy, Check, LogOut, 
  History, PlusCircle, Calendar, AlertTriangle, X, Radio, Clock, RefreshCw, Loader2, Filter, FileSpreadsheet,
  Camera, Image as ImageIcon, Trash2, Target, ExternalLink, Info, CheckSquare, Square, ShieldCheck, MapPin, Sparkles, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { generateDdsPdf, generateConsolidatedDdsPdf } from '@/lib/pdfGenerator';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';

export default function AdminPanel() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'NEW_DDS' | 'HISTORY'>('NEW_DDS');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // Formulário do Novo DDS
  const [meetingType, setMeetingType] = useState<'PRESENTIAL' | 'REMOTE'>('PRESENTIAL');
  const [topic, setTopic] = useState('');
  const [farm, setFarm] = useState('');
  const [objective, setObjective] = useState('');

  // Fotos da Equipe
  const [teamPhotos, setTeamPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);

  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  // Notificações
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

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
      const interval = setInterval(fetchAllData, 3000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.id, fetchAllData]);

  const handleStartNewMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !farm.trim()) {
      showToast('Por favor, preencha o Tema do DDS e o Local da fazenda.', 'error');
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
          objective: objective.trim(),
          organizerId: currentUser?.id,
          groupPhoto: teamPhotos.length > 0 ? teamPhotos[0] : null
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success && data.meeting) {
        setActiveMeeting(data.meeting);
        setIsLiveMode(true);
        setTopic('');
        setObjective('');
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

  const handleDownloadActivePdf = () => {
    if (!activeMeeting || !activeMeeting.attendees || activeMeeting.attendees.length === 0) {
      showToast('Ainda não há presenças registradas nesta reunião.', 'error');
      return;
    }
    showToast('Gerando Ata Oficial em PDF...', 'info');
    generateDdsPdf({
      topic: activeMeeting.topic,
      farm: activeMeeting.farm,
      type: activeMeeting.type,
      groupPhoto: teamPhotos.length > 0 ? teamPhotos[0] : activeMeeting.groupPhoto,
      createdAt: activeMeeting.createdAt,
      attendees: activeMeeting.attendees
    });
  };

  const handleDownloadHistoryPdf = (meeting: any) => {
    if (!meeting.attendees || meeting.attendees.length === 0) {
      showToast('Esta reunião não possui presenças registradas.', 'error');
      return;
    }
    showToast('Gerando Ata Oficial em PDF...', 'info');
    generateDdsPdf({
      topic: meeting.topic,
      farm: meeting.farm,
      type: meeting.type,
      groupPhoto: meeting.groupPhoto,
      createdAt: meeting.createdAt,
      attendees: meeting.attendees
    });
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
      organizerRole: currentUser?.position || currentUser?.role || 'Técnico em Segurança do Trabalho',
      companyName: currentUser?.company || 'Unidade Rural',
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      meetings: meetingHistory
    });
  };

  const handleEndMeeting = () => {
    setConfirmDialog({
      title: 'Encerrar DDS em Andamento',
      message: 'Tem certeza que deseja encerrar este DDS? A ata oficial da AM TST será arquivada e a sala de vídeo será fechada.',
      onConfirm: async () => {
        if (activeMeeting && activeMeeting.attendees && activeMeeting.attendees.length > 0) {
          handleDownloadActivePdf();
        }
        await fetch('/api/reuniao', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId: activeMeeting?.id })
        });
        setIsLiveMode(false);
        setActiveMeeting(null);
        setTeamPhotos([]);
        fetchAllData();
        showToast('DDS Encerrado! Ata arquivada com sucesso.', 'success');
        setConfirmDialog(null);
      }
    });
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
        {toast.show && (
          <div className={`fixed top-5 right-5 z-[99999] px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 ${
            toast.type === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100' :
            toast.type === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-100' :
            'bg-slate-900 border-slate-700 text-slate-100'
          }`}>
            {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertTriangle size={18} className="text-red-400 shrink-0" />}
            {toast.type === 'info' && <Info size={18} className="text-sky-400 shrink-0" />}
            <p className="text-xs sm:text-sm font-bold">{toast.message}</p>
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
          {/* Header Superior */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight">
                <span className="text-white">DDS </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">ON</span>
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-lg border border-slate-700 ml-1">
                {isPresential ? '👥 Presencial' : '🎙️ Remoto / Vídeo'}
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Técnico: <strong className="text-white">{currentUser?.name}</strong>
              </span>
              <button 
                onClick={() => setIsLiveMode(false)} 
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                Voltar ao Painel
              </button>
            </div>
          </header>

          {/* Banner de Status do DDS */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 rounded-3xl p-4 sm:p-6 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-emerald-500/40">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span className="font-bold text-emerald-200 uppercase tracking-widest text-[10px]">
                  {isPresential ? 'DDS Presencial em Andamento' : 'DDS Remoto Ao Vivo'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black">{activeMeeting.topic}</h2>
              <p className="text-emerald-100 text-xs sm:text-sm mt-0.5 flex items-center gap-1">
                <MapPin size={12} className="shrink-0 text-emerald-300" />
                <span>{activeMeeting.farm}</span>
              </p>
              {activeMeeting.objective && (
                <p className="text-emerald-200/90 text-xs mt-1 italic">🎯 Objetivo: {activeMeeting.objective}</p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={handleCopyInviteLink} 
                className="px-3.5 py-2.5 bg-white text-slate-950 hover:bg-slate-100 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-md text-xs cursor-pointer"
              >
                {copiedLink ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
              </button>
              <button 
                onClick={handleDownloadActivePdf} 
                className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/40 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm text-xs cursor-pointer"
              >
                <Download size={16} />
                <span>Baixar Ata PDF</span>
              </button>
              <button 
                onClick={handleEndMeeting} 
                className="px-3.5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all text-xs shadow-md cursor-pointer ml-auto sm:ml-0"
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
                      <p className="text-[11px] text-slate-400 mt-0.5">Passe o celular para os colaboradores assinarem com biometria facial.</p>
                    </div>

                    <Link href={`/reuniao/${activeMeeting.id}`}>
                      <button className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer">
                        <Smartphone size={14} /> Abrir Coleta
                      </button>
                    </Link>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                          <Camera size={15} className="text-emerald-400" /> Registro Fotográfico ({teamPhotos.length})
                        </h4>
                        <p className="text-[10px] text-slate-400">Fotos anexadas automaticamente na ata oficial em PDF.</p>
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                      >
                        <Camera size={13} className="text-emerald-400" /> + Foto
                      </button>
                      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleAddTeamPhoto} className="hidden" />
                    </div>

                    {teamPhotos.length === 0 ? (
                      <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/50 rounded-2xl p-6 text-center space-y-1.5 cursor-pointer transition-colors">
                        <ImageIcon size={28} className="mx-auto text-slate-600" />
                        <p className="text-xs font-semibold text-slate-400">Nenhuma foto da equipe anexada ainda.</p>
                        <p className="text-[10px] text-slate-500">Toque aqui para tirar uma foto da equipe reunida.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {teamPhotos.map((photo, index) => (
                          <div key={index} className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group shadow-md">
                            <img src={photo} alt={`Foto Equipe ${index + 1}`} className="w-full h-full object-cover" />
                            <button onClick={() => handleRemovePhoto(index)} className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-lg opacity-90 hover:opacity-100 transition-opacity cursor-pointer">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <DdsConferenceRoom
                  roomName={activeMeeting.id}
                  userName={`${currentUser?.name || 'Técnico'} (DDS ON)`}
                  isAdmin={true}
                  attendees={activeMeeting.attendees || []}
                />
              )}
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
      </main>
    );
  }

  // =========================================================================
  // DASHBOARD PRINCIPAL (NOVO DDS / HISTÓRICO)
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-950 p-3 sm:p-6 font-sans text-slate-100">
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[99999] px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100' :
          toast.type === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-100' :
          'bg-slate-900 border-slate-700 text-slate-100'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle size={18} className="text-red-400 shrink-0" />}
          {toast.type === 'info' && <Info size={18} className="text-sky-400 shrink-0" />}
          <p className="text-xs sm:text-sm font-bold">{toast.message}</p>
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
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-950/40">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>DDS</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">ON</span>
                <span className="text-[10px] font-extrabold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                  Painel TST
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                {currentUser?.name} • {currentUser?.company || 'AM TST'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {activeMeeting && (
              <button
                onClick={() => setIsLiveMode(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 animate-pulse cursor-pointer"
              >
                <Radio size={14} /> DDS em Aberto
              </button>
            )}

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Sair do Painel"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

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
                      👥 Presencial
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
                      🎙️ Remoto (Vídeo P2P)
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Transmissão de áudio, vídeo e tela para colaboradores remotos.
                    </span>
                  </button>
                </div>
              </div>

              {/* Tema e Local */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Tema do DDS *
                  </label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex: Uso Correto dos EPIs e Riscos de Queda"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Fazenda / Unidade / Setor *
                  </label>
                  <input
                    type="text"
                    required
                    value={farm}
                    onChange={(e) => setFarm(e.target.value)}
                    placeholder="Ex: Fazenda Santa Maria - Talhão 04"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none leading-relaxed"
                />
              </div>

              {/* Botão de Iniciar */}
              <button
                type="submit"
                disabled={isCreatingMeeting}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all cursor-pointer"
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

              <div className="flex items-center gap-2">
                {meetingHistory.length > 0 && (
                  <button
                    onClick={handleDownloadConsolidatedPdf}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Exportar Dossiê Consolidado</span>
                  </button>
                )}

                {selectedMeetings.length > 0 && (
                  <button
                    onClick={() => handleDeleteMeetings(selectedMeetings, true)}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
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
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedMeetings.includes(m.id)}
                        onChange={() => toggleSelectMeeting(m.id)}
                        className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 cursor-pointer shrink-0"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-extrabold text-white truncate">{m.topic}</span>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {m.type === 'PRESENTIAL' ? 'Presencial' : 'Remoto'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          📍 {m.farm} • {new Date(m.createdAt).toLocaleDateString('pt-BR')} às {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {m.attendees?.length || 0} presenças
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => handleDownloadHistoryPdf(m)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl flex items-center gap-1 border border-slate-700 cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Ata PDF</span>
                      </button>

                      <button
                        onClick={() => handleDeleteMeetings([m.id], false, m.topic)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-xl hover:bg-slate-850 cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}