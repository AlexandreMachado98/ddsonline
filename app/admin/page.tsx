 'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, Users, FileText, CheckCircle2, 
  Download, Copy, Check, LogOut, 
  History, PlusCircle, Calendar, AlertTriangle, X, Radio, Clock, RefreshCw, Loader2, Filter, FileSpreadsheet, UserCheck, UserX, Bell
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

  const [topic, setTopic] = useState('');
  const [farm, setFarm] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exitNotification, setExitNotification] = useState<string | null>(null);

  // Lista de Colaboradores aguardando permissão para entrar
  const [pendingAdmission, setPendingAdmission] = useState<any[]>([]);

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

      const data = await res.json();
      
      if (data.success) {
        if (data.meeting && data.meeting.status === 'LIVE') {
          setActiveMeeting(data.meeting);

          const allAttendees = data.meeting.attendees || [];
          
          // Separa quem está aguardando no Lobby para o técnico aprovar
          const waiting = allAttendees.filter((a: any) => a.status === 'PENDING');
          setPendingAdmission(waiting);

          // Avisos de saída
          allAttendees.forEach((person: any) => {
            if (person.name.includes('(Saída:') && !exitNotification) {
              setExitNotification(`⚠️ ${person.name.replace(/\(Saída:.*\)/, '')} precisou se ausentar.`);
              setTimeout(() => setExitNotification(null), 8000);
            }
          });
        } else {
          setActiveMeeting(null);
          setPendingAdmission([]);
        }

        setMeetingHistory(data.history || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsInitialLoadDone(true);
    }
  }, [currentUser, startDate, endDate, exitNotification]);

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 2000);
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchAllData]);

  // Ação: Permitir ou Recusar entrada do Colaborador
  const handleAdmitUser = async (attendanceId: string, action: 'ADMIT' | 'REJECT') => {
    try {
      await fetch('/api/presenca/admit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId, action })
      });
      fetchAllData();
    } catch {
      alert('Erro ao processar solicitação de entrada.');
    }
  };

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
          organizerId: currentUser?.id
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success && data.meeting) {
        setActiveMeeting(data.meeting);
        setIsLiveMode(true);
        setTopic('');
      } else {
        alert('Erro ao iniciar reunião: ' + (data.error || 'Falha no banco.'));
      }
    } catch (err: any) {
      alert('Aviso: ' + (err?.message || 'Falha de comunicação.'));
    } finally {
      setIsCreatingMeeting(false);
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
      createdAt: meeting.createdAt,
      attendees: meeting.attendees
    });
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
      fetchAllData();
      alert('✅ DDS Encerrado! Ata arquivada com sucesso.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dds_admin_auth');
    window.location.replace('/');
  };

  // SALA DO DDS AO VIVO COM CONTROLE DE ADMISSÃO (GOOGLE MEET MODEL)
  if (isLiveMode && activeMeeting) {
    const admittedAttendees = (activeMeeting.attendees || []).filter((a: any) => a.status === 'ADMITTED' || !a.status);

    return (
      <main className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans relative text-white">
        <div className="max-w-7xl mx-auto space-y-6">
          
          <header className="flex items-center justify-between bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight">
                <span className="text-white">DDS </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
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

          {/* Banner de Solicitações de Entrada (Lobby) */}
          {pendingAdmission.length > 0 && (
            <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 border border-amber-500/40 p-4 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-white rounded-2xl">
                  <Bell size={24} className="animate-bounce" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {pendingAdmission.length === 1 ? '1 Colaborador aguarda no Lobby' : `${pendingAdmission.length} Colaboradores aguardam no Lobby`}
                  </h4>
                  <p className="text-xs text-amber-200">Permita a entrada para liberar o áudio e vídeo dos participantes.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {pendingAdmission.map((pending) => (
                  <div key={pending.id} className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-amber-500/30">
                    <span className="text-xs font-bold text-white px-2 truncate max-w-[120px]">{pending.name}</span>
                    <button
                      onClick={() => handleAdmitUser(pending.id, 'ADMIT')}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <UserCheck size={14} /> Permitir
                    </button>
                    <button
                      onClick={() => handleAdmitUser(pending.id, 'REJECT')}
                      className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg text-xs transition-colors"
                      title="Recusar entrada"
                    >
                      <UserX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banner da Reunião */}
          <div className="bg-gradient-to-r from-green-700 via-emerald-700 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-green-500/30">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400"></span>
                </span>
                <span className="font-semibold text-green-200 uppercase tracking-wider text-xs">DDS ON • Transmissão Ao Vivo</span>
              </div>
              <h2 className="text-2xl font-black">{activeMeeting.topic}</h2>
              <p className="text-green-100 text-sm mt-0.5">📍 {activeMeeting.farm}</p>
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
            <div className="lg:col-span-7 space-y-4">
              <DdsConferenceRoom
                roomName={activeMeeting.id}
                userName={`${currentUser?.name || 'Técnico'} (DDS ON)`}
                isAdmin={true}
                attendees={admittedAttendees}
              />
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex items-center justify-around text-center">
                <div>
                  <span className="text-3xl font-black text-white">{admittedAttendees.length}</span>
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
                  <FileText size={18} className="text-green-400" /> Lista de Presença em Tempo Real
                </h3>
                
                {admittedAttendees.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <p>Nenhum colaborador admitido ainda.</p>
                    <p className="text-xs text-slate-600 mt-1">Envie o link copiado para a equipe.</p>
                  </div>
                ) : (
                  <ul className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {admittedAttendees.map((person: any) => {
                      const isExited = Boolean(person.exitReason || person.name.includes('(Saída:'));
                      return (
                        <li key={person.id} className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                          isExited ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-slate-950 border-slate-800'
                        }`}>
                          <div className="flex items-center gap-3">
                            {isExited ? (
                              <AlertTriangle size={20} className="text-amber-400 shrink-0" />
                            ) : (
                              <CheckCircle2 size={22} className="text-green-400 shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-white text-sm">
                                {person.name.replace(/\(Saída:.*\)/, '')}
                              </p>
                              {isExited ? (
                                <p className="text-[11px] font-semibold text-amber-300">
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
      </main>
    );
  }

  // DASHBOARD PRINCIPAL
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
          <div>
            <span className="text-2xl font-black tracking-tight">
              <span className="text-white">DDS </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span>
            </span>
            <p className="text-slate-400 text-xs mt-0.5">
              Portal do Organizador • Gestão Diária de Segurança
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-green-200">DDS Ativo no Momento</span>
                <h3 className="text-lg font-black">{activeMeeting.topic} ({activeMeeting.farm})</h3>
              </div>
            </div>

            <button
              onClick={() => setIsLiveMode(true)}
              className="px-6 py-3 bg-white text-green-900 hover:bg-green-50 font-bold text-xs rounded-xl transition-all shadow-md"
            >
              Entrar na Sala Ao Vivo ➡️
            </button>
          </div>
        )}

        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl max-w-md">
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

        {activeTab === 'NEW_DDS' && (
          <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-black text-white">Iniciar Novo DDS</h2>
              <p className="text-slate-400 text-xs">Gera a sala ao vivo e o link permanente com controle de entrada</p>
            </div>

            <form onSubmit={handleStartNewMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tema do Treinamento / Diálogo</label>
                <input 
                  type="text" 
                  value={topic} 
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex: NR-31 / Manuseio Seguro de Máquinas"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Local / Fazenda / Galpão / Setor</label>
                <input 
                  type="text" 
                  value={farm} 
                  onChange={(e) => setFarm(e.target.value)}
                  placeholder="Ex: Fazenda Santa Maria - Setor Agrícola 02"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <button 
                type="submit"
                disabled={isCreatingMeeting}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-600/25 text-sm transition-all active:scale-[0.99]"
              >
                {isCreatingMeeting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Gerando Sala DDS ON...
                  </>
                ) : (
                  <>
                    <Play size={18} /> Iniciar DDS e Abrir Sala com Lobby
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
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
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-green-500"
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
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-md">
                          {meeting.farm || 'Unidade'}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={13} />
                          {new Date(meeting.createdAt).toLocaleDateString('pt-BR')} às {new Date(meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{meeting.topic}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Users size={14} className="text-green-400" />
                        <strong>{meeting.attendees?.length || 0}</strong> colaboradores com presença e biometria
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownloadHistoryPdf(meeting)}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-green-300 border border-green-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm self-start md:self-auto"
                    >
                      <Download size={15} /> Baixar Ata Individual
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

      </div>
    </main>
  );
}