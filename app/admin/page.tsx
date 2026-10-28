'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { 
  Play, Users, FileText, CheckCircle2, 
  Smartphone, Download, Copy, Check, LogOut, 
  History, PlusCircle, Calendar, AlertTriangle, X, Radio, Clock, RefreshCw, Loader2, Filter, FileSpreadsheet,
  Camera, Image as ImageIcon, Trash2, Target, ExternalLink, Info, CheckSquare, Square, MapPin, Sparkles, ChevronRight, Eye,
  ArrowLeft, Plus, PenTool, Award, Trophy, BookmarkCheck, Shield
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { generateDdsPdf, generateConsolidatedDdsPdf } from '@/lib/pdfGenerator';
import GroupPhotoCapture, { parseGroupPhotos, serializeGroupPhotos } from '@/components/GroupPhotoCapture';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';
import AttachmentManager, { DdsAttachment } from '@/components/AttachmentManager';
import DdsReportPreviewModal from '@/components/DdsReportPreviewModal';
import UserProfileModal from '@/components/UserProfileModal';
import OfflineSyncBadge from '@/components/OfflineSyncBadge';
import { cacheMeetingData } from '@/lib/offlineStorage';
import DdsLogo from '@/components/DdsLogo';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import MetricCard from '@/components/ui/MetricCard';
import StatusBadge from '@/components/ui/StatusBadge';

function AdminPanelContent() {
  const { user: currentUser, logout: handleLogout, updateUserLocal } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'NEW_DDS' | 'HISTORY'>('NEW_DDS');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // Sincroniza abas e modo de transmissão via URL querystrings
  useEffect(() => {
    const view = searchParams?.get('view');
    const action = searchParams?.get('action');
    const mode = searchParams?.get('mode');

    if (mode === 'live') {
      setIsLiveMode(true);
    } else {
      setIsLiveMode(false);
    }

    if (view === 'history') {
      setActiveTab('HISTORY');
    } else if (action === 'new') {
      setActiveTab('NEW_DDS');
    }
  }, [searchParams]);

  // Event listener para saída imediata da sala ao vivo disparado pela navegação
  useEffect(() => {
    const handleExitLive = () => {
      setIsLiveMode(false);
    };
    window.addEventListener('dds:exit-live-room', handleExitLive);
    return () => window.removeEventListener('dds:exit-live-room', handleExitLive);
  }, []);

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
  const [activeMeetings, setActiveMeetings] = useState<any[]>([]);
  const [editAttachments, setEditAttachments] = useState<DdsAttachment[]>([]);
  const [isReviewingClose, setIsReviewingClose] = useState(false);
  const [previewMeeting, setPreviewMeeting] = useState<any | null>(null);
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  // Se a rota solicitou mode=live mas nenhuma reunião ativa existe após carga inicial, normaliza URL
  useEffect(() => {
    if (!isLoadingInitial && !activeMeeting && searchParams?.get('mode') === 'live') {
      setIsLiveMode(false);
      router.replace('/admin');
    }
  }, [isLoadingInitial, activeMeeting, searchParams, router]);

  // Recupera rascunho de novo DDS em elaboração salvo no dispositivo
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const draft = localStorage.getItem('dds_draft_meeting');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.topic) setTopic(parsed.topic);
        if (parsed.farm) setFarm(parsed.farm);
        if (parsed.objective) setObjective(parsed.objective);
        if (parsed.programmaticContent) setProgrammaticContent(parsed.programmaticContent);
        if (parsed.classification) setClassification(parsed.classification);
        if (parsed.meetingType) setMeetingType(parsed.meetingType);
      }
    } catch (e) {
      console.warn('Erro ao carregar rascunho de DDS:', e);
    }
  }, []);

  // Salva rascunho automaticamente a cada alteração com debounce
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timeout = setTimeout(() => {
      try {
        if (topic || farm || objective || programmaticContent) {
          localStorage.setItem('dds_draft_meeting', JSON.stringify({
            topic,
            farm,
            objective,
            programmaticContent,
            classification,
            meetingType,
            savedAt: new Date().toISOString()
          }));
        }
      } catch (e) {
        console.warn('Erro ao salvar rascunho:', e);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [topic, farm, objective, programmaticContent, classification, meetingType]);

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
        fetchAllData(false);
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

  // Busca de Dados Otimizada com suporte a modo leve (activeOnly) para polling
  const fetchAllData = useCallback(async (activeOnly = false) => {
    if (!currentUser?.id) return;

    try {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      let url = `/api/reuniao?organizerId=${currentUser.id}&_t=${Date.now()}`;
      if (activeOnly) {
        url += '&activeOnly=true';
      } else {
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
      }

      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      
      if (res.status === 401) {
        // Redireciona somente se for resposta explícita não autorizada
        if (typeof window !== 'undefined') window.location.replace('/login');
        return;
      }

      if (!res.ok) return;

      const data = await res.json();
      
      if (data.success) {
        const liveRooms: any[] = Array.isArray(data.activeMeetings)
          ? data.activeMeetings.filter((room: any) => room.status === 'LIVE')
          : data.meeting?.status === 'LIVE' ? [data.meeting] : [];
        setActiveMeetings(liveRooms);
        // Mantenha a sala escolhida durante o polling. Só troque ao encerrar/indisponibilizar.
        setActiveMeeting((previous: any) => {
          const updated = liveRooms.find((room: any) => room.id === previous?.id) || liveRooms[0] || null;
          if (!updated) return null;
          if (previous?.id === updated.id && previous?.attachments && updated.attachments) {
            const attachments = updated.attachments.map((file: any) => {
              const oldFile = previous.attachments.find((existing: any) => existing.id === file.id);
              return oldFile?.fileData && !file.fileData ? { ...file, fileData: oldFile.fileData } : file;
            });
            return { ...updated, attachments };
          }
          return updated;
        });

        if (!activeOnly && data.history) {
          setMeetingHistory(data.history);
        }

        if (t0 > 0 && typeof performance !== 'undefined') {
          const elapsed = (performance.now() - t0).toFixed(1);
          console.debug(`[PERF] Meeting data (${activeOnly ? 'active-only' : 'full'}) fetched in ${elapsed}ms`);
        }
      }
    } catch (error) {
      console.warn("Erro no polling de dados:", error);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [currentUser?.id, startDate, endDate]);

  // Carga inicial completa imediata sem waterfall
  useEffect(() => {
    if (currentUser?.id) {
      fetchAllData(false);

      // Polling leve a cada 20s (apenas activeOnly)
      const interval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        fetchAllData(true);
      }, 20000);

      const handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && !document.hidden) {
          fetchAllData(true);
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
    if (activeMeetings.filter(room => room.organizerId === currentUser?.id).length >= 3) {
      showToast('Você já possui 3 salas abertas. Encerre uma para criar outra.', 'error');
      return;
    }
    e.preventDefault();
    if (isCreatingMeeting) return;
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
          // Evidências fotográficas são coletadas exclusivamente dentro da sala.
          groupPhoto: null,
          attachments: newAttachments
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success && data.meeting) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('dds_draft_meeting');
        }
        setTeamPhotos([]);
        setActiveMeeting(data.meeting);
        setActiveMeetings(prev => [data.meeting, ...prev.filter(room => room.id !== data.meeting.id)]);
        cacheMeetingData(data.meeting);
        setIsLiveMode(true);
        router.push('/admin?mode=live');
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

  const compressImage = (dataUrl: string, callback: (compressed: string) => void) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDimension = 1280;

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
        callback(canvas.toDataURL('image/jpeg', 0.82));
      } else {
        callback(dataUrl);
      }
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  };

  const handleAddTeamPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const rawBase64 = reader.result as string;
      compressImage(rawBase64, async (compressed) => {
        const updatedPhotos = [...teamPhotos, compressed];
        setTeamPhotos(updatedPhotos);

        if (activeMeeting?.id) {
          try {
            const res = await fetch('/api/reuniao', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ meetingId: activeMeeting.id, groupPhoto: serializeGroupPhotos(updatedPhotos) })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              showToast('Erro ao sincronizar foto com o servidor.', 'error');
              return;
            }
          } catch (err) {
            console.error('Erro ao enviar foto da equipe:', err);
            showToast('Erro de conexão ao salvar foto.', 'error');
            return;
          }
        }
        showToast('Foto da equipe adicionada com sucesso!', 'success');
      });
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
        body: JSON.stringify({ meetingId: activeMeeting.id, groupPhoto: serializeGroupPhotos(updatedPhotos) })
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
        groupPhoto: teamPhotos.length > 0 ? serializeGroupPhotos(teamPhotos) : fullMeeting.groupPhoto,
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
      if (meeting.id) {
        try {
          const res = await fetch(`/api/reuniao?id=${meeting.id}&full=true`);
          const data = await res.json();
          if (data.success && data.meeting) {
            fullMeeting = data.meeting;
          }
        } catch (fetchErr) {
          console.warn('Falha ao buscar ata completa do servidor, usando dados locais:', fetchErr);
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
          groupPhoto: (teamPhotos.length > 0 && activeMeeting && activeMeeting.id === full.id) ? serializeGroupPhotos(teamPhotos) : full.groupPhoto,
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
      setActiveMeetings(prev => prev.filter(room => room.id !== activeMeeting?.id));
      setActiveMeeting(null);
      setTeamPhotos([]);
      router.push('/admin');
      fetchAllData();
      showToast('DDS Encerrado! Ata arquivada com sucesso.', 'success');
    } catch (e) {
      showToast('Erro ao encerrar DDS.', 'error');
    }
  };


  // =========================================================================
  // MÉTRICAS E INDICADORES (Hooks no topo do componente para cumprir Rules of Hooks)
  // =========================================================================
  const totalMeetings = meetingHistory.length;
  const totalAttendees = useMemo(() => {
    return meetingHistory.reduce((acc, m) => acc + (m.attendees?.length || 0), 0) + (activeMeeting?.attendees?.length || 0);
  }, [meetingHistory, activeMeeting]);
  const totalAttachments = useMemo(() => {
    return meetingHistory.reduce((acc, m) => acc + (m.attachments?.length || 0), 0);
  }, [meetingHistory]);

  // =========================================================================
  // SALA DO DDS EM ANDAMENTO (MODO TRANSMISSÃO)
  // =========================================================================
  if (isLiveMode && activeMeeting) {
    const isPresential = activeMeeting.type === 'PRESENTIAL';

    return (
      <AppShell
        breadcrumbs={[
          { label: 'Painel Geral', href: '/admin' },
          { label: `Ao Vivo: ${activeMeeting.topic}` }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsLiveMode(false);
                router.push('/admin');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Voltar ao Painel</span>
            </button>
            <OfflineSyncBadge meetingId={activeMeeting?.id} onSyncComplete={() => fetchAllData()} />
          </div>
        }
      >
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
                    <option value="Campanha">Campanha</option>
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
          {/* Banner de Status do DDS */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 rounded-3xl p-4 sm:p-6 text-white shadow-xl space-y-4 border border-emerald-500/40 overflow-hidden max-w-full">
            <div className="min-w-0 max-w-full overflow-hidden space-y-1.5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span className="font-black text-emerald-300 uppercase tracking-wider text-[11px]">
                  {isPresential ? 'DDS Presencial em Andamento' : 'DDS EAD Ao Vivo'}
                </span>
              </div>
              <h2 className="text-base sm:text-xl md:text-2xl font-black break-words leading-tight">{activeMeeting.topic}</h2>
              <p className="text-emerald-100 text-xs sm:text-sm flex items-center gap-1.5 break-words">
                <MapPin size={13} className="shrink-0 text-emerald-300" />
                <span className="break-words font-medium">{activeMeeting.farm}</span>
              </p>
              {activeMeeting.objective && (
                <p className="text-emerald-200/90 text-xs mt-1 bg-black/20 p-2.5 rounded-xl border border-white/5 break-words">
                  🎯 <strong>Objetivo:</strong> {activeMeeting.objective}
                </p>
              )}
              {activeMeeting.programmaticContent && (
                <p className="text-teal-200/90 text-xs mt-1 bg-black/20 p-2.5 rounded-xl border border-white/5 whitespace-pre-line break-words">
                  📚 <strong>Conteúdo:</strong> {activeMeeting.programmaticContent}
                </p>
              )}
            </div>
            
            {/* Toolbar de Ações Perfeitamente Alinhada e Responsiva */}
            <div className="pt-3 border-t border-emerald-500/20 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  className="w-full px-3 py-2.5 bg-slate-950/70 hover:bg-slate-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm text-xs cursor-pointer border border-slate-700/80 min-h-[42px] active:scale-[0.98]"
                >
                  <PenTool size={14} className="text-emerald-400 shrink-0" />
                  <span>Editar</span>
                </button>

                <button 
                  onClick={handleCopyInviteLink} 
                  className="w-full px-3 py-2.5 bg-white text-slate-950 hover:bg-slate-100 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 shadow-md text-xs cursor-pointer min-h-[42px] active:scale-[0.98]"
                >
                  {copiedLink ? <Check size={15} className="text-emerald-600 shrink-0" /> : <Copy size={15} className="shrink-0" />}
                  <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
                </button>

                <button 
                  onClick={() => handleOpenPreview(activeMeeting)} 
                  className="w-full px-3 py-2.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm text-xs cursor-pointer min-h-[42px] active:scale-[0.98]"
                  title="Pré-visualizar Lista de Presença e Dossiê Completo"
                >
                  <Eye size={15} className="shrink-0 text-emerald-400" />
                  <span>Prévia</span>
                </button>

                <button 
                  onClick={handleDownloadActivePdf} 
                  className="w-full px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm text-xs cursor-pointer min-h-[42px] active:scale-[0.98]"
                >
                  <Download size={15} className="shrink-0" />
                  <span>Ata PDF</span>
                </button>
              </div>

              {/* Acesso rápido às Avaliações e Questionários */}
              <Link href="/admin/questionarios" className="block w-full">
                <button
                  type="button"
                  className="w-full py-2.5 px-3 bg-slate-900/90 hover:bg-slate-850 border border-emerald-500/30 text-emerald-300 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:border-emerald-500/60 min-h-[40px]"
                >
                  <Award size={15} className="text-emerald-400 shrink-0" />
                  <span>Questionários & Avaliação de Risco</span>
                </button>
              </Link>

              {/* Botão de Encerrar DDS com Destaque e Alinhamento Preciso */}
              <button 
                onClick={handleEndMeeting} 
                className="w-full py-2.5 px-4 bg-red-600/90 hover:bg-red-600 active:bg-red-700 text-white rounded-xl font-black transition-all text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer min-h-[44px] border border-red-500/40 active:scale-[0.99]"
              >
                <LogOut size={16} className="shrink-0" />
                <span>Encerrar DDS e Concluir Ata</span>
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
                      key={activeMeeting.id}
                      initialPhotos={teamPhotos}
                      onPhotosChange={(updatedPhotos) => {
                        setTeamPhotos(updatedPhotos);
                        if (activeMeeting) {
                          fetch('/api/reuniao', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ meetingId: activeMeeting.id, groupPhoto: serializeGroupPhotos(updatedPhotos) })
                          }).catch(console.error);
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
                      const attName = attendee.name || 'Colaborador';
                      const initials = attName.trim().length > 0 ? attName.trim().slice(0, 2).toUpperCase() : 'CO';

                      return (
                        <div key={idx} className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          hasLeft 
                            ? 'bg-slate-950/60 border-amber-500/30 opacity-75' 
                            : 'bg-slate-950 border-slate-800'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {attendee.selfie ? (
                              <img src={attendee.selfie} alt={attName} className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{attName}</p>
                              <p className="text-[10px] text-slate-300 font-mono truncate">{attendee.cpf || 'Sem CPF / Função'}</p>
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
      </AppShell>
    );
  }

  // =========================================================================
  // DASHBOARD PRINCIPAL (NOVO DDS / HISTÓRICO)
  // =========================================================================
  return (
    <AppShell
      breadcrumbs={[{ label: 'Painel Geral' }]}
      actions={
        <div className="flex items-center gap-2">
          {/* Logo da Empresa para Atas em PDF */}
          <label 
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm" 
            title={companyLogo ? "Substituir Logo da Empresa no PDF" : "Adicionar Logo da Empresa ao PDF"}
          >
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" className="h-4 w-auto rounded-sm object-contain" />
            ) : (
              <ImageIcon size={14} className="text-blue-600" />
            )}
            <span className="hidden sm:inline">{companyLogo ? 'Alterar Logo' : 'Logo PDF'}</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => {
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
              }} 
            />
          </label>

          {companyLogo && (
            <button
              onClick={() => {
                localStorage.removeItem('dds_company_logo');
                setCompanyLogo(null);
                showToast('Logo removida.', 'info');
              }}
              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-colors"
              title="Remover Logo"
            >
              <Trash2 size={14} />
            </button>
          )}

          <OfflineSyncBadge meetingId={activeMeeting?.id} onSyncComplete={() => fetchAllData()} />
        </div>
      }
    >
      {/* Modais de Edição e Confirmação */}
      {editingMeeting && (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/95 backdrop-blur-md pb-2 z-10 border-b border-slate-100">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="text-blue-600">✏️</span>
                Editar Treinamento / DDS
              </h2>
              <button onClick={() => setEditingMeeting(null)} className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEditMeeting} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tipo de Conteúdo</label>
                <select
                  value={editForm.classification}
                  onChange={(e) => setEditForm({...editForm, classification: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-slate-900 font-bold focus:bg-white focus:border-blue-600 outline-none min-h-[44px]"
                >
                  <option value="DDS">DDS</option>
                  <option value="Treinamento">Treinamento</option>
                  <option value="Campanha">Campanha</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Responsável pelo Treinamento / DDS</label>
                <input
                  type="text"
                  value={editForm.instructorName}
                  onChange={(e) => setEditForm({...editForm, instructorName: e.target.value})}
                  placeholder={currentUser?.name || 'Nome do Instrutor'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-slate-900 font-bold focus:bg-white focus:border-blue-600 outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Objetivo</label>
                <textarea
                  rows={2}
                  value={editForm.objective}
                  onChange={(e) => setEditForm({...editForm, objective: e.target.value})}
                  placeholder="Objetivo do DDS / Treinamento..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-blue-600 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Conteúdo Programático</span>
                  <span className="text-[10px] text-emerald-600 font-bold">sai na ata em pdf</span>
                </label>
                <textarea
                  rows={3}
                  value={editForm.programmaticContent}
                  onChange={(e) => setEditForm({...editForm, programmaticContent: e.target.value})}
                  placeholder="Ex: Módulo 1: Conceitos e NRs&#10;Módulo 2: Procedimentos de segurança&#10;Módulo 3: Prática operacional"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-blue-600 outline-none leading-relaxed font-sans"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Data/Hora Início</label>
                  <input
                    type="datetime-local"
                    value={editForm.createdAt}
                    onChange={(e) => setEditForm({...editForm, createdAt: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-blue-600 outline-none min-h-[44px]"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Data/Hora Fim</label>
                  <input
                    type="datetime-local"
                    value={editForm.endedAt}
                    onChange={(e) => setEditForm({...editForm, endedAt: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-blue-600 outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Gestão de Anexos no Modal de Edição */}
              <div className="pt-2 border-t border-slate-100">
                <AttachmentManager
                  attachments={editAttachments}
                  onChange={setEditAttachments}
                />
              </div>
              
              <div className="flex gap-2.5 pt-3">
                <button type="button" onClick={() => setEditingMeeting(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors min-h-[44px]">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all min-h-[44px]">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-3 text-amber-600">
              <AlertTriangle size={22} />
              <h2 className="text-base font-extrabold text-slate-900">{confirmDialog.title}</h2>
            </div>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors">Cancelar</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CENTRAL OPERACIONAL DE SEGURANÇA (KPIS E MÉTRICAS REAIS)              */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="DDS Realizados"
          value={totalMeetings}
          subtitle="atas arquivadas"
          icon={FileText}
          variant="default"
          onClick={() => setActiveTab('HISTORY')}
        />
        <MetricCard
          title="Presenças Auditadas"
          value={totalAttendees}
          subtitle="colaboradores"
          icon={Users}
          variant="emerald"
        />
        <MetricCard
          title="Status Operacional"
          value={activeMeetings.length ? `${activeMeetings.length} Ao Vivo` : 'Regular'}
          subtitle={activeMeetings.length ? `${activeMeetings.length} sala(s) aberta(s)` : 'sem pendências'}
          icon={Radio}
          variant={activeMeeting ? 'emerald' : 'blue'}
          onClick={() => {
            if (activeMeeting) {
              setIsLiveMode(true);
              router.push('/admin?mode=live');
            } else {
              setActiveTab('NEW_DDS');
              router.push('/admin?action=new');
            }
          }}
        />
        <MetricCard
          title="Materiais & Anexos"
          value={totalAttachments}
          subtitle="arquivos SST"
          icon={BookmarkCheck}
          variant="navy"
        />
      </section>

      {/* Salas simultâneas independentes. Cada cartão abre sua própria sala e presenças. */}
      <section className="rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-black text-slate-900 text-base">Salas de DDS em andamento</h2>
            <p className="text-xs text-slate-500">Alterne entre as salas sem encerrar as outras. O limite é de 3 salas ativas por organizador.</p>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black border border-emerald-200">
            {activeMeetings.filter(room => room.organizerId === currentUser?.id).length}/3 salas próprias
          </span>
        </div>
        {activeMeetings.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">Nenhuma sala aberta. Crie um DDS abaixo para começar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeMeetings.map((room: any) => (
              <div key={room.id} className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50">
                <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                  <Radio size={13} /> Ao vivo
                  <span className="text-slate-500 font-medium">• {room.type === 'REMOTE' ? 'EAD' : 'Presencial'}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 break-words">{room.topic}</h3>
                <p className="text-xs text-slate-600 break-words">{room.farm}</p>
                <p className="text-[11px] text-slate-500">{room.attendees?.length || 0} presença(s) • Início: {new Date(room.createdAt).toLocaleString('pt-BR')}</p>
                <button type="button" onClick={() => {
                  setActiveMeeting(room);
                  setTeamPhotos(room.groupPhoto ? parseGroupPhotos(room.groupPhoto) : []);
                  setIsLiveMode(true);
                  router.push('/admin?mode=live');
                }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg py-2.5 flex justify-center items-center gap-2 cursor-pointer">
                  <Play size={14} /> Acessar esta sala
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* ABAS DE NAVEGAÇÃO SEGMENTADAS                                         */}
      {/* ===================================================================== */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 flex-wrap">
        <div className="inline-flex p-1 bg-white border border-slate-200/90 rounded-2xl shadow-sm gap-1">
          <button
            onClick={() => setActiveTab('NEW_DDS')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'NEW_DDS'
                ? 'bg-[#0F1F38] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <PlusCircle size={15} />
            <span>Novo DDS</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-[#0F1F38] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History size={15} />
            <span>Histórico ({totalMeetings})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/questionarios">
            <button
              type="button"
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 text-blue-700 border border-blue-200/80 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Award size={15} />
              <span>Questionários</span>
            </button>
          </Link>

          <Link href="/admin/questionarios?tab=RANKING">
            <button
              type="button"
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Trophy size={15} />
              <span>Ranking & Pódio</span>
            </button>
          </Link>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ABA 1: NOVO DDS                                                       */}
      {/* ===================================================================== */}
      {activeTab === 'NEW_DDS' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block mb-0.5">
              Cadastro de Diálogo Diário de Segurança
            </span>
            <h2 className="text-lg sm:text-xl font-black text-[#0F1F38] tracking-tight">
              Criar Nova Reunião de DDS
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Preencha os dados e escolha se a reunião será presencial ou com transmissão de vídeo ao vivo.
            </p>
          </div>

          <form onSubmit={handleStartNewMeeting} className="space-y-5">
            {/* Seletor de Modalidade */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Modalidade do DDS *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMeetingType('PRESENTIAL')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    meetingType === 'PRESENTIAL'
                      ? 'bg-blue-50/60 border-blue-600 text-blue-950 ring-2 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xs font-black flex items-center gap-2 text-blue-700">
                    📍 Presencial em Campo
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Coleta de presenças com selfie e assinatura digital no celular ou tablet.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMeetingType('REMOTE')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    meetingType === 'REMOTE'
                      ? 'bg-blue-50/60 border-blue-600 text-blue-950 ring-2 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xs font-black flex items-center gap-2 text-blue-700">
                    💻 EAD / Transmissão Ao Vivo (P2P)
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Transmissão de vídeo, voz e slides com lista de presença em tempo real.
                  </span>
                </button>
              </div>
            </div>

            {/* Tipo de Conteúdo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Classificação do Evento *
                </label>
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-slate-900 font-bold focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                >
                  <option value="DDS">DDS — Diálogo Diário de Segurança</option>
                  <option value="Treinamento">Treinamento Obrigatório (NR)</option>
                  <option value="Campanha">Campanha de Saúde & Prevenção</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Local / Unidade Operacional *
                </label>
                <input
                  type="text"
                  required
                  value={farm}
                  onChange={(e) => setFarm(e.target.value)}
                  placeholder="Ex: Canteiro de Obras / Fazenda / Unidade Central"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-slate-900 font-bold focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
            </div>

            {/* Tema */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tema do DDS *
              </label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: Cuidados com Animais na Pista / Trabalho em Altura & EPIs"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-slate-900 font-bold focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {/* Objetivo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Objetivo Específico / Observações
              </label>
              <textarea
                rows={2}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ex: Orientar os operadores quanto à verificação diária e direção defensiva."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all leading-relaxed"
              />
            </div>

            {/* Conteúdo Programático se Treinamento */}
            {classification === 'Treinamento' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Conteúdo Programático do Treinamento</span>
                  <span className="text-[10px] text-emerald-600 font-bold">constará na ata em PDF</span>
                </label>
                <textarea
                  rows={3}
                  value={programmaticContent}
                  onChange={(e) => setProgrammaticContent(e.target.value)}
                  placeholder="Ex: Módulo 1: Conceitos e Normas Regulamentadoras&#10;Módulo 2: Procedimentos de segurança e EPIs&#10;Módulo 3: Prática operacional."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all leading-relaxed font-sans"
                />
              </div>
            )}

            {/* Anexos & Fotos Coletivas */}
            <div className="pt-3 border-t border-slate-100 space-y-4">
              <AttachmentManager
                attachments={newAttachments}
                onChange={setNewAttachments}
              />

              {/* Fotos comprobatórias são anexadas na sala ativa, não no formulário inicial. */}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isCreatingMeeting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-900/20 transition-all cursor-pointer min-h-[48px]"
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
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-8 shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block mb-0.5">
                Arquivo Digital de Atas
              </span>
              <h2 className="text-lg sm:text-xl font-black text-[#0F1F38] tracking-tight">
                Histórico de DDS Realizados
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Consulte presenças, exporte dossiês consolidados e emita relatórios em PDF.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {meetingHistory.length > 0 && (
                <button
                  onClick={handleDownloadConsolidatedPdf}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Download size={14} />
                  <span>Exportar Dossiê Consolidado</span>
                </button>
              )}

              {selectedMeetings.length > 0 && (
                <button
                  onClick={() => handleDeleteMeetings(selectedMeetings, true)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Excluir ({selectedMeetings.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtros de Data */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <Filter size={14} className="text-slate-400" />
              Filtrar por Período:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none font-medium"
              />
              <span className="text-slate-400 font-bold">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none font-medium"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-100 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Lista de Reuniões */}
          {meetingHistory.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
              Nenhum DDS registrado no histórico até o momento.
            </div>
          ) : (
            <div className="space-y-3">
              {meetingHistory.map((m) => (
                <div
                  key={m.id}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-none hover:shadow-sm"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <label className="p-1 cursor-pointer shrink-0 mt-0.5" title="Selecionar para dossiê consolidado">
                      <input
                        type="checkbox"
                        checked={selectedMeetings.includes(m.id)}
                        onChange={() => toggleSelectMeeting(m.id)}
                        className="w-4 h-4 rounded text-blue-600 bg-white border-slate-300 cursor-pointer"
                      />
                    </label>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-black text-[#0F1F38] break-words">
                          {m.topic}
                        </span>
                        <StatusBadge
                          status={m.classification || 'DDS'}
                          size="sm"
                        />
                        <StatusBadge
                          status={m.type || 'PRESENTIAL'}
                          size="sm"
                        />
                        {m.attachments && m.attachments.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 shrink-0">
                            <FileText size={11} /> {m.attachments.length} {m.attachments.length === 1 ? 'anexo' : 'anexos'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="font-semibold text-slate-700">📍 {m.farm}</span>
                        <span>•</span>
                        <span>
                          {new Date(m.createdAt).toLocaleDateString('pt-BR')} às {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <Users size={12} />
                          {m.attendees?.length || 0} presenças
                        </span>
                      </div>

                      {m.objective && (
                        <p className="text-xs text-slate-600 mt-1.5 italic font-medium line-clamp-2">
                          🎯 {m.objective}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto pt-2 md:pt-0 border-t border-slate-200 md:border-0 w-full md:w-auto justify-end">
                    <button
                      onClick={() => handleOpenPreview(m)}
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-emerald-200 cursor-pointer transition-all shadow-sm"
                      title="Pré-visualizar Lista de Presença e Dossiê Completo"
                    >
                      <Eye size={14} />
                      <span>Ver Ata</span>
                    </button>

                    <button
                      onClick={() => handleDownloadHistoryPdf(m)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-200 cursor-pointer transition-all shadow-sm"
                    >
                      <Download size={14} />
                      <span>PDF</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(m)}
                      title="Editar Detalhes"
                      className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
                    >
                      <PenTool size={14} />
                    </button>

                    <button
                      onClick={() => handleDeleteMeetings([m.id], false, m.topic)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 border border-slate-200 cursor-pointer transition-colors"
                      title="Excluir DDS"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rodapé Administrativo */}
      <footer className="mt-8 pt-6 border-t border-slate-200 text-center space-y-1.5 text-xs text-slate-500">
        <p>© 2026 <strong>AM TST</strong>. Todos os direitos reservados.</p>
        <p className="text-[11px] text-slate-400 font-medium">
          <strong>DDS ON</strong> • Gestão Digital de SST & Diálogos Diários de Segurança.
        </p>
        <div className="flex items-center justify-center gap-3 text-[11px] pt-0.5">
          <Link href="/termos" target="_blank" className="text-slate-500 hover:text-blue-600 underline transition-colors">
            Termos de Uso
          </Link>
          <span>•</span>
          <Link href="/privacidade" target="_blank" className="text-slate-500 hover:text-blue-600 underline transition-colors">
            Aviso de Privacidade (LGPD)
          </Link>
        </div>
      </footer>

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
    </AppShell>
  );
}

export const dynamic = 'force-dynamic';

export default function AdminPanel() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      }
    >
      <AdminPanelContent />
    </Suspense>
  );
}
