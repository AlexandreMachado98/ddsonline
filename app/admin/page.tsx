 'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Users, FileText, CheckCircle2, 
  Smartphone, Download, Copy, Check, LogOut, 
  History, PlusCircle, Calendar, AlertTriangle, Radio, Clock, RefreshCw, Loader2, Filter, FileSpreadsheet,
  Camera, Image as ImageIcon, Trash2, Target, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { generateDdsPdf, generateConsolidatedDdsPdf } from '@/lib/pdfGenerator';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';

export default function AdminPanel() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'NEW_DDS' | 'HISTORY'>('NEW_DDS');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  // Formulário do Novo DDS
  const [meetingType, setMeetingType] = useState<'PRESENTIAL' | 'REMOTE'>('PRESENTIAL');
  const [topic, setTopic] = useState('');
  const [farm, setFarm] = useState('');
  const [objective, setObjective] = useState('');

  // Fotos da Equipe no Modo Presencial
  const [teamPhotos, setTeamPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtros de Data
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exitNotification, setExitNotification] = useState<string | null>(null);

  useEffect(() => {
    const auth = localStorage.getItem('dds_admin_auth');
    if (!auth) {
      window.location.replace('/');
      return;
    }
    try {
      const user = JSON.parse(auth);
      setCurrentUser(user);
    } catch {
      localStorage.removeItem('dds_admin_auth');
      window.location.replace('/');
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      const orgId = currentUser?.id || '';
      let url = `/api/reuniao?organizerId=${orgId}&_t=${Date.now()}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      });
      
      if (!res.ok) return;

      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        return;
      }
      
      if (data.success) {
        if (data.meeting && data.meeting.status === 'LIVE') {
          setActiveMeeting(data.meeting);

          if (data.meeting.teamPhotos) {
            try {
              const parsed = JSON.parse(data.meeting.teamPhotos);
              if (Array.isArray(parsed) && teamPhotos.length === 0) {
                setTeamPhotos(parsed);
              }
            } catch {}
          }

          if (data.meeting.attendees) {
            data.meeting.attendees.forEach((person: any) => {
              if (person.name.includes('(Saída:') && !exitNotification) {
                setExitNotification(`⚠️ ${person.name.replace(/\(Saída:.*\)/, '')} precisou se ausentar.`);
                setTimeout(() => setExitNotification(null), 8000);
              }
            });
          }
        } else {
          setActiveMeeting(null);
        }

        setMeetingHistory(data.history || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsInitialLoadDone(true);
    }
  }, [currentUser, startDate, endDate, exitNotification, teamPhotos.length]);

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 2000);
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchAllData]);

  const handleStartNewMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !farm.trim()) {
      alert('Por favor, preencha o Tema do DDS e o Local da fazenda.');
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
          teamPhotos: teamPhotos
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success && data.meeting) {
        setActiveMeeting(data.meeting);
        setIsLiveMode(true);
        setTopic('');
        setObjective('');
      } else {
        alert('Erro ao iniciar reunião: ' + (data.error || 'Falha no banco.'));
      }
    } catch (err: any) {
      alert('Aviso: ' + (err?.message || 'Falha de comunicação.'));
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
          body: JSON.stringify({
            meetingId: activeMeeting.id,
            teamPhotos: updatedPhotos
          })
        });
      }
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
        body: JSON.stringify({
          meetingId: activeMeeting.id,
          teamPhotos: updatedPhotos
        })
      });
    }
  };

  const handleCopyInviteLink = () => {
    if (!activeMeeting) return;
    const inviteUrl = `${window.location.origin}/reuniao/${activeMeeting.id}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleDownloadActivePdf = () => {
    if (!activeMeeting || !activeMeeting.attendees || activeMeeting.attendees.length === 0) {
      alert('Ainda não há presenças registradas nesta reunião.');
      return;
    }
    generateDdsPdf({
      topic: activeMeeting.topic,
      farm: activeMeeting.farm,
      type: activeMeeting.type,
      objective: activeMeeting.objective,
      teamPhotos: teamPhotos.length > 0 ? (teamPhotos as any) : activeMeeting.teamPhotos,
      createdAt: activeMeeting.createdAt,
      attendees: activeMeeting.attendees
    });
  };

  const handleDownloadHistoryPdf = (meeting: any) => {
    if (!meeting.attendees || meeting.attendees.length === 0) {
      alert('Esta reunião não possui presenças registradas.');
      return;
    }
    generateDdsPdf({
      topic: meeting.topic,
      farm: meeting.farm,
      type: meeting.type,
      objective: meeting.objective,
      teamPhotos: meeting.teamPhotos,
      createdAt: meeting.createdAt,
      attendees: meeting.attendees
    });
  };

  const handleDeleteMeeting = async (meetingId: string, meetingTopic: string) => {
    if (confirm(`⚠️ Tem certeza que deseja excluir permanentemente o DDS "${meetingTopic}" e todas as suas presenças auditadas? Esta ação não pode ser desfeita.`)) {
      try {
        const res = await fetch(`/api/reuniao?meetingId=${meetingId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        
        if (data.success) {
          alert('✅ DDS excluído do histórico com sucesso!');
          fetchAllData();
        } else {
          alert('Erro ao excluir: ' + (data.error || 'Falha no servidor.'));
        }
      } catch {
        alert('Erro de conexão ao tentar excluir o DDS.');
      }
    }
  };

  const handleDownloadConsolidatedPdf = () => {
    if (meetingHistory.length === 0) {
      alert('Não há reuniões no período selecionado.');
      return;
    }
    generateConsolidatedDdsPdf({
      organizerName: currentUser?.name || 'Técnico de Segurança',
      organizerRole: currentUser?.position || currentUser?.role || 'Técnico em Segurança do Trabalho',
      companyName: currentUser?.company || 'Unidade Rural',
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      meetings: meetingHistory
    });
  };

  const handleEndMeeting = async () => {
    if (confirm('Encerrar este DDS? A ata oficial do DDS ON será arquivada.')) {
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
      alert('✅ DDS Encerrado! Ata arquivada com sucesso.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dds_admin_auth');
    window.location.replace('/');
  };

  // =========================================================================
  // SALA DO DDS EM ANDAMENTO (PRESENCIAL OU REMOTO)
  // =========================================================================
  if (isLiveMode && activeMeeting) {
    const isPresential = activeMeeting.type === 'PRESENTIAL';

    return (
      <main className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans relative text-white flex flex-col justify-between">
        <div className="max-w-7xl w-full mx-auto space-y-6">
          
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight">
                <span className="text-white">DDS </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span>
              </span>
              <span className="text-[11px] bg-slate-800 text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-700 ml-2">
                {isPresential ? '👥 Modo Presencial' : '🎙️ Modo Remoto'}
              </span>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Organizador: <strong className="text-white">{currentUser?.name}</strong>
              </span>
              <button
                onClick={() => setIsLiveMode(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-700"
              >
                Voltar ao Painel
              </button>
            </div>
          </header>

          <div className="bg-gradient-to-r from-green-700 via-emerald-700 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-green-500/30">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400"></span>
                </span>
                <span className="font-semibold text-green-200 uppercase tracking-wider text-xs">
                  {isPresential ? 'DDS Presencial em Andamento' : 'DDS Remoto Ao Vivo'}
                </span>
              </div>
              <h2 className="text-2xl font-black">{activeMeeting.topic}</h2>
              <p className="text-green-100 text-sm mt-0.5">📍 {activeMeeting.farm}</p>
              {activeMeeting.objective && (
                <p className="text-green-200/90 text-xs mt-1.5 italic">🎯 Objetivo: {activeMeeting.objective}</p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={handleCopyInviteLink}
                className="px-4 py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold transition-all flex items-center gap-2 shadow-md text-sm"
              >
                {copiedLink ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                {copiedLink ? 'Link Copiado!' : 'Copiar Link do DDS'}
              </button>

              <button 
                onClick={handleDownloadActivePdf}
                className="px-4 py-3 bg-green-800 hover:bg-green-700 border border-green-400/30 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm text-sm"
              >
                <Download size={18} /> Baixar Ata
              </button>

              <button 
                onClick={handleEndMeeting} 
                className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all text-sm shadow-md"
              >
                Encerrar DDS
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Coluna Esquerda: Presencial ou Vídeo */}
            <div className="lg:col-span-7 space-y-4">
              {isPresential ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Smartphone size={18} className="text-green-400" /> Coleta de Presença
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Passe o aparelho para os trabalhadores assinarem em sequência.</p>
                    </div>

                    <Link href={`/reuniao/${activeMeeting.id}`}>
                      <button className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md">
                        <Smartphone size={16} /> Abrir Coleta de Assinatura
                      </button>
                    </Link>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Camera size={16} className="text-green-400" /> Registro Fotográfico ({teamPhotos.length})
                        </h4>
                        <p className="text-xs text-slate-400">Fotos anexadas na ata oficial em PDF.</p>
                      </div>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                      >
                        <Camera size={14} className="text-green-400" /> + Adicionar Foto
                      </button>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={fileInputRef}
                        onChange={handleAddTeamPhoto}
                        className="hidden"
                      />
                    </div>

                    {teamPhotos.length === 0 ? (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-800 hover:border-green-500/50 bg-slate-950/50 rounded-2xl p-8 text-center space-y-2 cursor-pointer transition-colors"
                      >
                        <ImageIcon size={32} className="mx-auto text-slate-600" />
                        <p className="text-xs font-semibold text-slate-400">Nenhuma foto da equipe anexada.</p>
                        <p className="text-[11px] text-slate-500">Clique para tirar foto com a câmera ou escolher da galeria.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {teamPhotos.map((photo, index) => (
                          <div key={index} className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 group shadow-md">
                            <img src={photo} alt={`Foto Equipe ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => handleRemovePhoto(index)}
                              className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-90 hover:opacity-100 transition-opacity"
                              title="Excluir foto"
                            >
                              <Trash2 size={13} />
                            </button>
                            <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded">
                              Foto #{index + 1}
                            </span>
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

            {/* Coluna Direita: Lista de Presença */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex items-center justify-around text-center">
                <div>
                  <span className="text-3xl font-black text-white">{activeMeeting.attendees?.length || 0}</span>
                  <span className="text-slate-400 text-xs block mt-1">Presenças Auditadas</span>
                </div>
                <div className="h-10 w-[1px] bg-slate-800"></div>
                <div>
                  <span className="text-3xl font-black text-green-400">100%</span>
                  <span className="text-slate-400 text-xs block mt-1">Conformidade NR</span>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
                  <FileText size={18} className="text-green-400" /> Lista de Presença do DDS
                </h3>
                
                {(!activeMeeting.attendees || activeMeeting.attendees.length === 0) ? (
                  <div className="text-center py-12 text-slate-500">
                    <p>Nenhum colaborador assinou ainda.</p>
                    <p className="text-xs text-slate-600 mt-1">Envie o link para a equipe.</p>
                  </div>
                ) : (
                  <ul className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {activeMeeting.attendees.map((person: any) => {
                      const isExited = Boolean(person.exitReason || person.name.includes('(Saída:'));
                      return (
                        <li key={person.id} className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                          isExited 
                            ? 'bg-red-500/10 border-red-500/30 text-red-200' 
                            : 'bg-slate-950 border-slate-800'
                        }`}>
                          <div className="flex items-center gap-3">
                            {isExited ? (
                              <AlertTriangle size={20} className="text-red-400 shrink-0" />
                            ) : (
                              <CheckCircle2 size={22} className="text-green-400 shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-white text-sm">
                                {person.name.replace(/\(Saída:.*\)/, '')}
                              </p>
                              {isExited ? (
                                <p className="text-[11px] font-semibold text-red-300">
                                  ⚠️ Saída: {person.exitReason || 'Justificada'}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400">CPF: {person.cpf}</p>
                              )}
                            </div>
                          </div>
                          
                          <span className="text-xs text-slate-400 font-medium bg-slate-800 px-2.5 py-1 rounded-lg">
                            {new Date(person.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Rodapé Oficial (Fixo no final da tela) */}
        <footer className="mt-8 pt-5 border-t border-slate-800 text-center space-y-1.5 w-full max-w-7xl mx-auto">
          <p className="text-[11px] text-slate-500 font-normal">
            © {new Date().getFullYear()} <strong>DDS ON</strong> • Todos os direitos reservados.
          </p>
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
            <span>Desenvolvido e Auditado por</span>
            <a
              href="https://amtst.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 font-bold inline-flex items-center gap-1 transition-colors underline underline-offset-2"
            >
              AM TST <ExternalLink size={10} />
            </a>
          </div>
        </footer>
      </main>
    );
  }

  // =========================================================================
  // DASHBOARD PRINCIPAL
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans flex flex-col justify-between">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-lg">
          <div>
            <span className="text-2xl font-black tracking-tight">
              <span className="text-white">DDS </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span>
            </span>
            <p className="text-slate-400 text-xs mt-0.5">
              Portal do Organizador • Gestão de Segurança
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white">{currentUser?.name}</p>
              <p className="text-[11px] text-green-400">{currentUser?.company || 'Unidade'}</p>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-slate-700"
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        </header>

        {isInitialLoadDone && activeMeeting && (
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white p-5 rounded-3xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-green-400/30 animate-in fade-in duration-300">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/20 rounded-2xl">
                <Radio size={24} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-green-200">
                  {activeMeeting.type === 'PRESENTIAL' ? 'DDS Presencial Ativo' : 'DDS Remoto Ativo'}
                </span>
                <h3 className="text-lg font-black">{activeMeeting.topic} ({activeMeeting.farm})</h3>
              </div>
            </div>

            <button
              onClick={() => setIsLiveMode(true)}
              className="px-6 py-3 bg-white text-green-900 hover:bg-green-50 font-bold text-xs rounded-xl transition-all shadow-md"
            >
              Abrir Painel do DDS ➡️
            </button>
          </div>
        )}

        {/* Abas Centralizadas */}
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('NEW_DDS')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'NEW_DDS' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle size={16} /> Novo DDS
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'HISTORY' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <History size={16} /> Histórico ({meetingHistory.length})
          </button>
        </div>

        {/* ABA 1: NOVO DDS */}
        {activeTab === 'NEW_DDS' && (
          <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-black text-white">Criar Novo Diálogo de Segurança</h2>
              <p className="text-slate-400 text-xs mt-1">Selecione a modalidade e configure a ata oficial</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMeetingType('PRESENTIAL')}
                className={`py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  meetingType === 'PRESENTIAL'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users size={16} /> DDS Presencial
              </button>

              <button
                type="button"
                onClick={() => setMeetingType('REMOTE')}
                className={`py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  meetingType === 'REMOTE'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio size={16} /> DDS Remoto
              </button>
            </div>

            <form onSubmit={handleStartNewMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tema do Treinamento / Diálogo *</label>
                <input 
                  type="text" 
                  required
                  value={topic} 
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Digite o tema principal"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Local / Fazenda / Galpão *</label>
                <input 
                  type="text" 
                  required
                  value={farm} 
                  onChange={(e) => setFarm(e.target.value)}
                  placeholder="Digite o local da realização"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                  <Target size={13} className="text-green-400" /> Objetivo do Treinamento (Aparecerá na Ata)
                </label>
                <textarea 
                  rows={3}
                  value={objective} 
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Descreva o objetivo deste DDS..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none resize-none leading-relaxed transition-all"
                />
              </div>

              <button 
                type="submit"
                disabled={isCreatingMeeting}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-600/25 text-sm transition-all active:scale-[0.99] mt-2"
              >
                {isCreatingMeeting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Gerando Sala DDS ON...
                  </>
                ) : (
                  <>
                    <Play size={18} /> {meetingType === 'PRESENTIAL' ? 'Abrir Lista de Presença Presencial' : 'Iniciar DDS e Abrir Transmissão'}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ABA 2: HISTÓRICO */}
        {activeTab === 'HISTORY' && (
          <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Filter size={14} className="text-green-400" /> Filtrar Histórico por Período
                </span>

                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-[11px] text-red-400 hover:text-red-300 font-bold"
                  >
                    Limpar Filtro
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 px-3 py-2.5 rounded-xl border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-900 px-3 py-2.5 rounded-xl border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleDownloadConsolidatedPdf}
                    className="w-full py-2.5 bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all border border-green-500/30"
                  >
                    <FileSpreadsheet size={15} className="text-green-300" />
                    Baixar Dossiê Consolidado (PDF)
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {meetingHistory.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <History size={40} className="mx-auto opacity-30 text-green-400" />
                  <p className="text-sm font-semibold text-slate-300">Nenhum DDS arquivado para este período.</p>
                </div>
              ) : (
                meetingHistory.map((meeting) => (
                  <div 
                    key={meeting.id} 
                    className="p-5 rounded-2xl border border-slate-800 bg-slate-950/70 hover:bg-slate-950 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-md">
                          {meeting.farm || 'Unidade'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-md">
                          {meeting.type === 'PRESENTIAL' ? '👥 Presencial' : '🎙️ Remoto'}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1 border-l border-slate-700 pl-2">
                          <Calendar size={13} />
                          {new Date(meeting.createdAt).toLocaleDateString('pt-BR')} às {new Date(meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{meeting.topic}</h3>
                      {meeting.objective && (
                        <p className="text-xs text-slate-400 line-clamp-1 italic">🎯 {meeting.objective}</p>
                      )}
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                        <Users size={14} className="text-green-400" />
                        <strong>{meeting.attendees?.length || 0}</strong> colaboradores com presença e biometria
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button
                        onClick={() => handleDownloadHistoryPdf(meeting)}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-green-300 border border-green-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                      >
                        <Download size={15} /> Baixar Ata
                      </button>

                      <button
                        onClick={() => handleDeleteMeeting(meeting.id, meeting.topic)}
                        className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl transition-colors"
                        title="Excluir este DDS permanentemente"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

      </div>

      <footer className="mt-8 pt-5 border-t border-slate-800 text-center space-y-1.5 w-full max-w-5xl mx-auto">
        <p className="text-[11px] text-slate-400 font-normal">
          © {new Date().getFullYear()} <strong>DDS ON</strong> • Todos os direitos reservados.
        </p>
        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
          <span>Desenvolvido e Auditado por</span>
          <a
            href="https://amtst.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 hover:text-green-300 font-bold inline-flex items-center gap-1 transition-colors underline underline-offset-2"
          >
            AM TST <ExternalLink size={10} />
          </a>
        </div>
      </footer>
    </main>
  );
}