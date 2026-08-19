 'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, Users, Link as LinkIcon, FileText, CheckCircle2, 
  ShieldAlert, Smartphone, Download, Copy, Check, LogOut, 
  History, PlusCircle, UserCheck, Calendar, AlertTriangle, X, Radio, Clock, RefreshCw, Loader2, Filter, FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { generateDdsPdf, generateConsolidatedDdsPdf } from '@/lib/pdfGenerator';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';

export default function AdminPanel() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'NEW_DDS' | 'HISTORY'>('NEW_DDS');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);

  // Formulário do Novo DDS
  const [topic, setTopic] = useState('');
  const [farm, setFarm] = useState('');

  // Filtros de Data no Histórico
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reunião Ativa e Histórico
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exitNotification, setExitNotification] = useState<string | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(10);
  const [isLinkExpired, setIsLinkExpired] = useState<boolean>(false);

  // 1. Carrega dados do Usuário Logado no Banco
  useEffect(() => {
    const auth = localStorage.getItem('dds_admin_auth');
    if (!auth) {
      router.push('/login');
      return;
    }
    try {
      setCurrentUser(JSON.parse(auth));
    } catch {
      router.push('/login');
    }
  }, [router]);

  // 2. Busca dados de reuniões filtradas por usuário e datas
  const fetchAllData = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      let url = `/api/reuniao?organizerId=${currentUser.id}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setActiveMeeting(data.meeting || null);
        setMeetingHistory(data.history || []);

        if (data.meeting && data.meeting.inviteExpiresAt) {
          const diffMs = new Date(data.meeting.inviteExpiresAt).getTime() - Date.now();
          if (diffMs > 0) {
            setRemainingMinutes(Math.ceil(diffMs / (60 * 1000)));
            setIsLinkExpired(false);
          } else {
            setRemainingMinutes(0);
            setIsLinkExpired(true);
          }
        }

        if (data.meeting && data.meeting.attendees) {
          data.meeting.attendees.forEach((person: any) => {
            if (person.name.includes('(Saída:') && !exitNotification) {
              setExitNotification(`⚠️ ${person.name.replace(/\(Saída:.*\)/, '')} precisou se ausentar.`);
              setTimeout(() => setExitNotification(null), 8000);
            }
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, [currentUser, startDate, endDate, exitNotification]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Iniciar Novo DDS vinculado ao Usuário
  const handleStartNewMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !farm.trim()) {
      alert('Preencha o Tema do DDS e o Local da fazenda.');
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
      
      if (data.success && data.meeting) {
        setActiveMeeting(data.meeting);
        setIsLiveMode(true);
        setTopic('');
      } else {
        alert('Erro ao iniciar reunião: ' + (data.error || 'Verifique o banco'));
      }
    } catch (err: any) {
      alert('Erro de conexão: ' + (err?.message || 'Falha ao se comunicar com o servidor.'));
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const handleRenewLink = async () => {
    if (!activeMeeting) return;
    try {
      const res = await fetch('/api/reuniao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: activeMeeting.id })
      });
      const data = await res.json();
      if (data.success) {
        setActiveMeeting(data.meeting);
        handleCopyInviteLink();
        alert('✅ Link renovado por mais 10 minutos e copiado!');
      }
    } catch {
      alert('Erro ao renovar o link.');
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
      alert('Esta reunião foi encerrada sem presenças registradas.');
      return;
    }
    generateDdsPdf({
      topic: meeting.topic,
      farm: meeting.farm,
      createdAt: meeting.createdAt,
      attendees: meeting.attendees
    });
  };

  // Baixar Relatório Consolidado de todo o Período
  const handleDownloadConsolidatedPdf = () => {
    if (meetingHistory.length === 0) {
      alert('Não há reuniões no período selecionado para gerar o dossiê.');
      return;
    }

    generateConsolidatedDdsPdf({
      organizerName: currentUser?.name || 'Técnico de Segurança',
      organizerRole: currentUser?.role || 'Técnico em Segurança do Trabalho',
      companyName: currentUser?.company || 'Unidade Rural',
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      meetings: meetingHistory
    });
  };

  const handleEndMeeting = async () => {
    if (confirm('Encerrar este DDS? A sala será fechada e os dados serão salvos no histórico.')) {
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
      alert('✅ DDS Encerrado com sucesso!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dds_admin_auth');
    router.push('/');
  };

  // =========================================================================
  // SALA DO DDS AO VIVO
  // =========================================================================
  if (isLiveMode && activeMeeting) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans relative">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShieldAlert size={36} className="text-blue-700" />
              <div>
                <h1 className="text-2xl font-bold text-slate-800">DDS em Andamento</h1>
                <p className="text-slate-500 text-xs">
                  Organizador: <strong>{currentUser?.name || 'Técnico'}</strong> ({currentUser?.company || 'Empresa'})
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsLiveMode(false)}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Voltar ao Painel
            </button>
          </header>

          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="font-semibold text-blue-100 uppercase tracking-wider text-xs">Transmissão Ativa</span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  isLinkExpired ? 'bg-red-500 text-white' : 'bg-blue-800 text-blue-200'
                }`}>
                  <Clock size={12} />
                  {isLinkExpired ? 'Link Expirado' : `Link válido por ~${remainingMinutes} min`}
                </span>
              </div>
              <h2 className="text-2xl font-bold">{activeMeeting.topic}</h2>
              <p className="text-blue-100 text-sm mt-1">📍 {activeMeeting.farm}</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {isLinkExpired ? (
                <button 
                  onClick={handleRenewLink}
                  className="px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm text-sm animate-bounce"
                >
                  <RefreshCw size={18} /> Renovar Link (Mais 10 min)
                </button>
              ) : (
                <button 
                  onClick={handleCopyInviteLink}
                  className="px-4 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm text-sm border border-blue-300/30"
                >
                  {copiedLink ? <Check size={18} className="text-green-300" /> : <Copy size={18} />}
                  {copiedLink ? 'Link Copiado!' : 'Copiar Link (10 min)'}
                </button>
              )}

              <button 
                onClick={handleDownloadActivePdf}
                className="px-4 py-3 bg-white text-blue-700 hover:bg-blue-50 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm text-sm"
              >
                <Download size={18} /> Baixar PDF
              </button>

              <button 
                onClick={handleEndMeeting} 
                className="px-4 py-3 bg-red-500 hover:bg-red-600 border border-white/20 rounded-xl font-bold transition-all text-sm"
              >
                Encerrar DDS
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <DdsConferenceRoom
                roomName={activeMeeting.id}
                userName={`${currentUser?.name || 'Técnico'} (Organizador)`}
                isAdmin={true}
              />
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-around text-center">
                <div>
                  <span className="text-3xl font-black text-slate-800">{activeMeeting.attendees?.length || 0}</span>
                  <span className="text-slate-500 text-xs block mt-1">Presenças Validadas</span>
                </div>
                <div className="h-10 w-[1px] bg-slate-200"></div>
                <div>
                  <span className="text-3xl font-black text-emerald-600">100%</span>
                  <span className="text-slate-500 text-xs block mt-1">Conformidade NR</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                  <FileText size={18} /> Lista de Presença em Tempo Real
                </h3>
                
                {!activeMeeting.attendees || activeMeeting.attendees.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p>Ninguém assinou ainda.</p>
                    <p className="text-xs text-slate-400 mt-1">Envie o link para a equipe.</p>
                  </div>
                ) : (
                  <ul className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {activeMeeting.attendees.map((person: any) => {
                      const isExited = person.name.includes('(Saída:');
                      return (
                        <li key={person.id} className={`flex items-center justify-between p-3.5 rounded-xl border ${
                          isExited ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-100'
                        }`}>
                          <div className="flex items-center gap-3">
                            {isExited ? (
                              <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                            ) : (
                              <CheckCircle2 size={22} className="text-green-500 shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-slate-700 text-sm">
                                {person.name.replace(/\(Saída:.*\)/, '')}
                              </p>
                              {isExited ? (
                                <p className="text-[11px] font-semibold text-amber-700">⚠️ Saída Justificada</p>
                              ) : (
                                <p className="text-xs text-slate-500">CPF: {person.cpf}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-slate-400 font-medium bg-slate-200 px-2 py-1 rounded-md">
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

  // =========================================================================
  // DASHBOARD PRINCIPAL (INICIAR DDS + HISTÓRICO COM FILTRO DE DATAS)
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-700">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Olá, {currentUser?.name || 'Técnico'}!</h1>
              <p className="text-slate-500 text-xs">
                {currentUser?.role} • <strong>{currentUser?.company || 'Unidade'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="self-end sm:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <LogOut size={16} /> Sair
          </button>
        </header>

        {/* Alerta de DDS Ativo */}
        {activeMeeting && (
          <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl">
                <Radio size={24} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">DDS Ativo no Momento</span>
                <h3 className="text-lg font-bold">{activeMeeting.topic} ({activeMeeting.farm})</h3>
              </div>
            </div>

            <button
              onClick={() => setIsLiveMode(true)}
              className="px-5 py-3 bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs rounded-xl transition-all shadow-sm"
            >
              Entrar na Sala Ao Vivo ➡️
            </button>
          </div>
        )}

        {/* Abas */}
        <div className="flex bg-slate-200/80 p-1 rounded-2xl max-w-md">
          <button
            onClick={() => setActiveTab('NEW_DDS')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'NEW_DDS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle size={16} /> Novo DDS
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'HISTORY' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={16} /> Meu Histórico ({meetingHistory.length})
          </button>
        </div>

        {/* ABA 1: FORMULÁRIO DO NOVO DDS */}
        {activeTab === 'NEW_DDS' && (
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Iniciar Reunião de Segurança</h2>
              <p className="text-slate-500 text-xs">Os registros ficarão salvos no seu histórico pessoal de auditoria</p>
            </div>

            <form onSubmit={handleStartNewMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tema do DDS</label>
                <input 
                  type="text" 
                  value={topic} 
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex: Treinamento NR-31 / Manuseio de Defensivos"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Local / Fazenda / Galpão</label>
                <input 
                  type="text" 
                  value={farm} 
                  onChange={(e) => setFarm(e.target.value)}
                  placeholder="Ex: Fazenda Santa Maria - Setor 03"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <button 
                type="submit"
                disabled={isCreatingMeeting}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 text-sm transition-all active:scale-[0.99]"
              >
                {isCreatingMeeting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Gerando Sala...
                  </>
                ) : (
                  <>
                    <Play size={18} /> Iniciar DDS e Abrir Videoconferência
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ABA 2: HISTÓRICO COM FILTROS DE DATA E DOWNLOAD POR PERÍODO */}
        {activeTab === 'HISTORY' && (
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            
            {/* Barra de Filtros por Período */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Filter size={14} className="text-blue-600" /> Filtrar Histórico por Período
                </span>

                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-[11px] text-red-600 hover:text-red-700 font-bold"
                  >
                    Limpar Filtro
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleDownloadConsolidatedPdf}
                    className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-400" />
                    Baixar Dossiê do Período (PDF)
                  </button>
                </div>
              </div>
            </div>

            {/* Listagem de Reuniões do Histórico */}
            <div className="space-y-3">
              {meetingHistory.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-2">
                  <History size={40} className="mx-auto opacity-40" />
                  <p className="text-sm font-semibold">Nenhum DDS encontrado para o período selecionado.</p>
                  <p className="text-xs">Tente ajustar as datas do filtro ou inicie um novo DDS.</p>
                </div>
              ) : (
                meetingHistory.map((meeting) => (
                  <div 
                    key={meeting.id} 
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-700 bg-blue-100/60 px-2.5 py-0.5 rounded-md">
                          {meeting.farm || 'Fazenda'}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={13} />
                          {new Date(meeting.createdAt).toLocaleDateString('pt-BR')} às {new Date(meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-800">{meeting.topic}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Users size={14} className="text-emerald-600" />
                        <strong>{meeting.attendees?.length || 0}</strong> colaboradores com presença e biometria
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownloadHistoryPdf(meeting)}
                      className="px-4 py-2.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm self-start md:self-auto"
                    >
                      <Download size={15} /> Baixar Ata Individual (PDF)
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