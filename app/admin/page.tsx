'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, Users, Link as LinkIcon, FileText, CheckCircle2, 
  ShieldAlert, Smartphone, Download, Copy, Check, LogOut, 
  History, PlusCircle, UserCheck, Building2, Calendar, AlertTriangle, X, Radio,
  Sparkles, ExternalLink, RefreshCw, Eye, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { generateDdsPdf } from '@/lib/pdfGenerator';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';
import CacheBusterButton from '@/components/CacheBuster';
import { useToast } from '@/components/Toast';

export default function AdminPanel() {
  const router = useRouter();
  const toast = useToast();

  // Controle de Abas no Painel: 'NEW_DDS' ou 'HISTORY'
  const [activeTab, setActiveTab] = useState<'NEW_DDS' | 'HISTORY'>('NEW_DDS');

  // Modo de Sala Ao Vivo
  const [isLiveMode, setIsLiveMode] = useState(false);

  // --- DADOS DO ORGANIZADOR ---
  const [organizerName, setOrganizerName] = useState('');
  const [organizerRole, setOrganizerRole] = useState('Técnico em Segurança do Trabalho');
  const [companyName, setCompanyName] = useState('');

  // --- DADOS DO NOVO DDS ---
  const [topic, setTopic] = useState('');
  const [farm, setFarm] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  // --- DADOS DA REUNIÃO EM ANDAMENTO ---
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exitNotification, setExitNotification] = useState<string | null>(null);

  // Modal de Confirmação para Encerrar Reunião
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

  // --- HISTÓRICO DE REUNIÕES ---
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // 1. Carrega o perfil salvo do Organizador e verifica Login
  useEffect(() => {
    const auth = localStorage.getItem('dds_admin_auth');
    if (!auth) {
      router.push('/login');
      return;
    }

    try {
      const parsedAuth = JSON.parse(auth);
      if (parsedAuth.name) setOrganizerName(parsedAuth.name);
      if (parsedAuth.position) setOrganizerRole(parsedAuth.position);
      if (parsedAuth.company) setCompanyName(parsedAuth.company);
    } catch {}

    const savedProfile = localStorage.getItem('dds_organizer_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed.name) setOrganizerName(parsed.name);
        if (parsed.role) setOrganizerRole(parsed.role);
        if (parsed.company) setCompanyName(parsed.company);
      } catch {}
    }
  }, [router]);

  // 2. Busca os dados de histórico e reunião ativa ISOLADOS
  const fetchAllData = async () => {
    try {
      const auth = localStorage.getItem('dds_admin_auth');
      let url = '/api/reuniao';
      if (auth) {
        try {
          const user = JSON.parse(auth);
          const params = new URLSearchParams();
          if (user.id) params.append('organizerId', user.id);
          if (user.email) params.append('email', user.email);
          url = `/api/reuniao?${params.toString()}`;
        } catch {}
      }

      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setActiveMeeting(data.meeting || null);
        setMeetingHistory(data.history || []);

        // Notificação de saída se houver
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
      console.error("Erro ao buscar dados isolados", error);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, [exitNotification]);

  // Salva o perfil do organizador no navegador
  const handleSaveProfile = () => {
    localStorage.setItem('dds_organizer_profile', JSON.stringify({
      name: organizerName,
      role: organizerRole,
      company: companyName
    }));
    toast.success('Perfil Salvo!', 'Suas informações de técnico e empresa foram atualizadas.');
  };

  // Inicia um NOVO DDS isolado para o organizador
  const handleStartNewMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !farm.trim()) {
      toast.warning('Campos Obrigatórios', 'Por favor, preencha o Tema do DDS e o Local/Fazenda.');
      return;
    }

    setIsStarting(true);
    handleSaveProfile();

    const auth = localStorage.getItem('dds_admin_auth');
    let organizerId = undefined;
    let email = undefined;
    if (auth) {
      try {
        const user = JSON.parse(auth);
        organizerId = user.id;
        email = user.email;
      } catch {}
    }

    try {
      const res = await fetch('/api/reuniao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          farm: farm.trim(),
          organizerId,
          email
        })
      });
      
      const data = await res.json();
      if (data.success && data.meeting) {
        setActiveMeeting(data.meeting);
        setIsLiveMode(true);
        setTopic('');
        fetchAllData();
        toast.success('DDS Iniciado!', 'A sala ao vivo e o canal de transmissão foram abertos.');
      } else {
        toast.error('Erro ao Iniciar', data.error || 'Não foi possível abrir o DDS.');
      }
    } catch {
      toast.error('Erro de Conexão', 'Verifique sua conexão e tente novamente.');
    } finally {
      setIsStarting(false);
    }
  };

  // Retoma uma reunião que já estava aberta
  const handleResumeActiveMeeting = () => {
    setIsLiveMode(true);
  };

  // Copia o link de convite
  const handleCopyInviteLink = () => {
    if (!activeMeeting) return;
    const inviteUrl = `${window.location.origin}/reuniao/${activeMeeting.id}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    toast.success('Link Copiado!', 'Envie o link para a equipe acessar no celular.');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Baixa o PDF da reunião ativa
  const handleDownloadActivePdf = () => {
    if (!activeMeeting || !activeMeeting.attendees || activeMeeting.attendees.length === 0) {
      toast.info('Lista Vazia', 'Ainda não há presenças registradas nesta reunião.');
      return;
    }
    generateDdsPdf({
      topic: activeMeeting.topic,
      farm: activeMeeting.farm,
      createdAt: activeMeeting.createdAt,
      attendees: activeMeeting.attendees
    });
    toast.success('PDF Gerado com Sucesso!', 'O relatório de auditoria foi baixado no seu aparelho.');
  };

  // Baixa o PDF de uma reunião do HISTÓRICO
  const handleDownloadHistoryPdf = (meeting: any) => {
    if (!meeting.attendees || meeting.attendees.length === 0) {
      toast.info('Sem Registros', 'Esta reunião foi arquivada sem presenças registradas.');
      return;
    }
    generateDdsPdf({
      topic: meeting.topic,
      farm: meeting.farm,
      createdAt: meeting.createdAt,
      attendees: meeting.attendees
    });
    toast.success('Download Concluído', 'Relatório de auditoria baixado.');
  };

  // Encerra a reunião ativa
  const handleConfirmEndMeeting = async () => {
    setIsEndingMeeting(true);
    try {
      if (activeMeeting && activeMeeting.attendees && activeMeeting.attendees.length > 0) {
        handleDownloadActivePdf();
      }
      await fetch('/api/reuniao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: activeMeeting?.id })
      });
      setIsLiveMode(false);
      setShowEndConfirmModal(false);
      setActiveMeeting(null);
      fetchAllData();
      toast.success('DDS Encerrado!', 'Os dados foram arquivados no seu histórico de auditoria.');
    } catch {
      toast.error('Erro ao Encerrar', 'Tente novamente.');
    } finally {
      setIsEndingMeeting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dds_admin_auth');
    toast.info('Sessão Encerrada', 'Até logo!');
    router.push('/login');
  };

  // =========================================================================
  // CENÁRIO 2: SALA DO DDS AO VIVO (TRANSMISSÃO + LISTA EM TEMPO REAL)
  // =========================================================================
  if (isLiveMode && activeMeeting) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-3 sm:p-6 font-sans relative overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Cabeçalho */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                <ShieldAlert size={28} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-white">DDS em Andamento</h1>
                <p className="text-slate-400 text-xs">
                  Organizador: <strong className="text-white">{organizerName || 'Técnico de Segurança'}</strong> • {companyName || 'Unidade Rural'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <CacheBusterButton />
              <button
                onClick={() => setIsLiveMode(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-2xl text-xs font-bold transition-all border border-slate-700 min-h-[44px]"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </header>

          {/* Banner Superior com Ações Rápidas */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-blue-400/20">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="font-extrabold text-blue-100 uppercase tracking-widest text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full">
                  Transmissão Ativa
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">{activeMeeting.topic}</h2>
              <p className="text-blue-100 text-xs mt-1 flex items-center gap-1.5">
                📍 {activeMeeting.farm}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={handleCopyInviteLink}
                className="px-4 py-3 bg-white/15 hover:bg-white/25 text-white rounded-2xl font-bold transition-all flex items-center gap-2 text-xs border border-white/20 backdrop-blur-sm min-h-[44px]"
              >
                {copiedLink ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
                {copiedLink ? 'Link Copiado!' : 'Copiar Link do DDS'}
              </button>

              <button 
                onClick={handleDownloadActivePdf}
                className="px-4 py-3 bg-white text-blue-700 hover:bg-blue-50 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg text-xs min-h-[44px]"
              >
                <Download size={16} /> Baixar PDF
              </button>

              <button 
                onClick={() => setShowEndConfirmModal(true)} 
                className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all text-xs shadow-lg min-h-[44px]"
              >
                Encerrar DDS
              </button>
            </div>
          </div>

          {/* Grid Principal: Mosaico de Vídeo + Lista de Presença */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <DdsConferenceRoom
                roomName={activeMeeting.id}
                userName={`${organizerName || 'Técnico'} (Organizador)`}
                isAdmin={true}
              />

              <div className="bg-slate-900/90 p-4 rounded-3xl shadow-md border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Coletar assinatura neste aparelho:</span>
                <Link href={`/reuniao/${activeMeeting.id}`}>
                  <button className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center gap-2 text-xs transition-all shadow-md min-h-[44px]">
                    <Smartphone size={16} /> Abrir Coleta de Presença
                  </button>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900/90 p-5 rounded-3xl shadow-md border border-slate-800 flex items-center justify-around text-center">
                <div>
                  <span className="text-3xl font-black text-white">{activeMeeting.attendees?.length || 0}</span>
                  <span className="text-slate-400 text-xs block mt-1">Presenças Validadas</span>
                </div>
                <div className="h-10 w-[1px] bg-slate-800"></div>
                <div>
                  <span className="text-3xl font-black text-emerald-400">100%</span>
                  <span className="text-slate-400 text-xs block mt-1">Conformidade NR</span>
                </div>
              </div>

              <div className="bg-slate-900/90 p-6 rounded-3xl shadow-md border border-slate-800">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
                  <FileText size={18} className="text-blue-400" /> Lista de Presença em Tempo Real
                </h3>
                
                {!activeMeeting.attendees || activeMeeting.attendees.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <p className="text-xs font-semibold">Nenhum colaborador assinou ainda.</p>
                    <p className="text-[11px] text-slate-600">Copie o link acima e envie para a equipe.</p>
                  </div>
                ) : (
                  <ul className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {activeMeeting.attendees.map((person: any) => {
                      const isExited = person.name.includes('(Saída:');
                      return (
                        <li key={person.id} className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                          isExited ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-950/80 border-slate-800'
                        }`}>
                          <div className="flex items-center gap-3">
                            {isExited ? (
                              <AlertTriangle size={20} className="text-amber-400 shrink-0" />
                            ) : (
                              <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-white text-xs">
                                {person.name.replace(/\(Saída:.*\)/, '')}
                              </p>
                              {isExited ? (
                                <p className="text-[11px] font-semibold text-amber-300">
                                  ⚠️ Saída Justificada
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400">CPF: {person.cpf}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 font-semibold bg-slate-800 px-2.5 py-1 rounded-lg">
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

        {/* Modal de Confirmação de Encerramento do DDS */}
        {showEndConfirmModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl w-fit">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-bold text-white">Encerrar este DDS?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                A sala de transmissão será fechada, as presenças serão consolidadas e o relatório oficial de auditoria será gerado em PDF e arquivado no seu histórico.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndConfirmModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition-colors min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEndMeeting}
                  disabled={isEndingMeeting}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  {isEndingMeeting ? 'Encerrando...' : 'Sim, Encerrar DDS'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 1: DASHBOARD PRINCIPAL (INICIAR NOVO DDS + HISTÓRICO DE AUDITORIA)
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans relative overflow-x-hidden">
      
      {/* Luz de fundo decorativa */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 blur-[140px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        
        {/* Topo do Portal */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Painel do Organizador</h1>
              <p className="text-slate-400 text-xs">Gestão Diária de Segurança & Auditoria Digital</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <CacheBusterButton />
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 min-h-[44px]"
            >
              <LogOut size={16} /> Sair da Conta
            </button>
          </div>
        </header>

        {/* Alerta de Reunião em Andamento (Se houver) */}
        {activeMeeting && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300 border border-emerald-400/30">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/20 rounded-2xl">
                <Radio size={26} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200 bg-white/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
                  DDS Ao Vivo Ativo
                </span>
                <h3 className="text-lg font-black">{activeMeeting.topic} ({activeMeeting.farm})</h3>
              </div>
            </div>

            <button
              onClick={handleResumeActiveMeeting}
              className="px-5 py-3.5 bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs rounded-2xl transition-all shadow-lg shrink-0 min-h-[44px]"
            >
              Entrar na Sala Ao Vivo ➡️
            </button>
          </div>
        )}

        {/* Abas de Navegação */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl max-w-md border border-slate-800">
          <button
            onClick={() => setActiveTab('NEW_DDS')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'NEW_DDS'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle size={16} /> Iniciar Novo DDS
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'HISTORY'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History size={16} /> Histórico ({meetingHistory.length})
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: NOVO DDS + PERFIL DO ORGANIZADOR                                   */}
        {/* ========================================================================= */}
        {activeTab === 'NEW_DDS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Formulário do Novo DDS */}
            <div className="lg:col-span-7 bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white">Configurar Nova Reunião</h2>
                <p className="text-slate-400 text-xs">Preencha o tema e local para gerar a sala do DDS</p>
              </div>

              <form onSubmit={handleStartNewMeeting} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tema do DDS de Hoje</label>
                  <input 
                    type="text" 
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex: Prevenção de Acidentes com Tratores e Máquinas"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Local / Fazenda / Galpão</label>
                  <input 
                    type="text" 
                    value={farm} 
                    onChange={(e) => setFarm(e.target.value)}
                    placeholder="Ex: Fazenda Santa Maria - Setor Mecanizado"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isStarting}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 text-sm transition-all min-h-[48px]"
                >
                  <Play size={18} /> {isStarting ? 'Iniciando Reunião...' : 'Iniciar DDS e Abrir Transmissão'}
                </button>
              </form>
            </div>

            {/* Perfil Salvo do Organizador */}
            <div className="lg:col-span-5 bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck size={18} className="text-blue-400" /> Meus Dados de Organizador
                </h2>
                <p className="text-slate-400 text-xs">Ficam salvos para assinar os relatórios em PDF</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Seu Nome Completo</label>
                  <input
                    type="text"
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    placeholder="Ex: Alexandre Santos"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Função / Cargo</label>
                  <input
                    type="text"
                    value={organizerRole}
                    onChange={(e) => setOrganizerRole(e.target.value)}
                    placeholder="Ex: Técnico em Segurança do Trabalho"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Empresa / Fazenda Principal</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Agropecuária Progresso"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs transition-colors border border-slate-700 min-h-[44px]"
                >
                  Salvar Minhas Informações
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: HISTÓRICO DE AUDITORIA COM DOWNLOAD DE PDFS                        */}
        {/* ========================================================================= */}
        {activeTab === 'HISTORY' && (
          <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Histórico de Reuniões Realizadas</h2>
                <p className="text-slate-400 text-xs">Arquivo de conformidade e auditoria digital de NRs</p>
              </div>

              <span className="text-xs bg-blue-500/10 text-blue-300 font-bold px-3 py-1 rounded-full border border-blue-500/20 w-fit">
                {meetingHistory.length} reuniões arquivadas
              </span>
            </div>

            {meetingHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-500 space-y-2">
                <History size={40} className="mx-auto opacity-40" />
                <p className="text-sm font-semibold text-slate-400">Nenhum DDS finalizado no histórico ainda.</p>
                <p className="text-xs">Assim que você encerrar uma reunião, o relatório arquivado aparecerá aqui.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetingHistory.map((meeting) => (
                  <div 
                    key={meeting.id} 
                    className="p-5 rounded-3xl border border-slate-800 bg-slate-950/70 hover:bg-slate-950 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                          {meeting.farm || 'Fazenda'}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={13} />
                          {new Date(meeting.createdAt).toLocaleDateString('pt-BR')} às {new Date(meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{meeting.topic}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Users size={14} className="text-emerald-400" />
                        <strong className="text-white">{meeting.attendees?.length || 0}</strong> participantes registrados e auditados
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownloadHistoryPdf(meeting)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm self-start md:self-auto min-h-[44px]"
                    >
                      <Download size={15} /> Baixar Relatório PDF
                    </button>
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