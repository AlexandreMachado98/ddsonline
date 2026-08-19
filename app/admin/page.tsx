 'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, Users, Link as LinkIcon, FileText, CheckCircle2, 
  ShieldAlert, Smartphone, Download, Copy, Check, LogOut, 
  History, PlusCircle, UserCheck, Building2, Calendar, AlertTriangle, X, Radio
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { generateDdsPdf } from '@/lib/pdfGenerator';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';

export default function AdminPanel() {
  const router = useRouter();

  // Controle de Abas no Painel: 'NEW_DDS' (Iniciar Reunião) ou 'HISTORY' (Auditoria)
  const [activeTab, setActiveTab] = useState<'NEW_DDS' | 'HISTORY'>('NEW_DDS');

  // Modo de Sala Ao Vivo (só fica true quando o técnico clica em iniciar ou retomar)
  const [isLiveMode, setIsLiveMode] = useState(false);

  // --- DADOS DO ORGANIZADOR (Salvos no navegador) ---
  const [organizerName, setOrganizerName] = useState('');
  const [organizerRole, setOrganizerRole] = useState('Técnico em Segurança do Trabalho');
  const [companyName, setCompanyName] = useState('');

  // --- DADOS DO NOVO DDS ---
  const [topic, setTopic] = useState('');
  const [farm, setFarm] = useState('');

  // --- DADOS DA REUNIÃO EM ANDAMENTO ---
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exitNotification, setExitNotification] = useState<string | null>(null);

  // --- HISTÓRICO DE REUNIÕES FINALIZADAS ---
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);

  // 1. Carrega o perfil salvo do Organizador e verifica Login
  useEffect(() => {
    const auth = localStorage.getItem('dds_admin_auth');
    if (!auth) {
      router.push('/login');
      return;
    }

    const savedProfile = localStorage.getItem('dds_organizer_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setOrganizerName(parsed.name || '');
        setOrganizerRole(parsed.role || 'Técnico em Segurança do Trabalho');
        setCompanyName(parsed.company || '');
      } catch {}
    }
  }, [router]);

  // 2. Busca os dados de histórico e reunião ativa no banco
  const fetchAllData = async () => {
    try {
      const res = await fetch('/api/reuniao');
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
      console.error("Erro ao buscar dados", error);
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
  };

  // Inicia um NOVO DDS
  const handleStartNewMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !farm) {
      alert('Por favor, preencha o tema do DDS e o local/fazenda.');
      return;
    }

    handleSaveProfile();

    const res = await fetch('/api/reuniao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, farm })
    });
    
    const data = await res.json();
    if (data.success && data.meeting) {
      setActiveMeeting(data.meeting);
      setIsLiveMode(true);
      setTopic('');
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
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Baixa o PDF da reunião ativa
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

  // Baixa o PDF de uma reunião do HISTÓRICO
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

  // Encerra a reunião ativa
  const handleEndMeeting = async () => {
    if (confirm('Encerrar este DDS? A sala será fechada e os dados serão salvos no histórico.')) {
      if (activeMeeting && activeMeeting.attendees && activeMeeting.attendees.length > 0) {
        handleDownloadActivePdf();
      }
      await fetch('/api/reuniao', { method: 'PUT' });
      setIsLiveMode(false);
      setActiveMeeting(null);
      fetchAllData();
      alert('✅ DDS Encerrado! Os dados foram arquivados no histórico de auditoria.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dds_admin_auth');
    router.push('/login');
  };

  // =========================================================================
  // CENÁRIO 2: SALA DO DDS AO VIVO (VÍDEO + LISTA EM TEMPO REAL)
  // =========================================================================
  if (isLiveMode && activeMeeting) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans relative">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Cabeçalho */}
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShieldAlert size={36} className="text-blue-700" />
              <div>
                <h1 className="text-2xl font-bold text-slate-800">DDS em Andamento</h1>
                <p className="text-slate-500 text-xs">
                  Organizador: <strong>{organizerName || 'Técnico de Segurança'}</strong> • {companyName || 'Unidade Rural'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsLiveMode(false)}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Voltar ao Dashboard
            </button>
          </header>

          {/* Banner Superior com Ações */}
          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="font-semibold text-blue-100 uppercase tracking-wider text-xs">Transmissão Ativa</span>
              </div>
              <h2 className="text-2xl font-bold">{activeMeeting.topic}</h2>
              <p className="text-blue-100 text-sm mt-1">📍 {activeMeeting.farm}</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={handleCopyInviteLink}
                className="px-4 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm text-sm border border-blue-300/30"
              >
                {copiedLink ? <Check size={18} className="text-green-300" /> : <Copy size={18} />}
                {copiedLink ? 'Link Copiado!' : 'Copiar Link do DDS'}
              </button>

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

          {/* Grid Principal: Mosaico de Vídeo + Lista de Presença */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <DdsConferenceRoom
                roomName={activeMeeting.id}
                userName={`${organizerName || 'Técnico'} (Organizador)`}
                isAdmin={true}
              />

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">Acesso local neste aparelho:</span>
                <Link href={`/reuniao/${activeMeeting.id}`}>
                  <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-2 text-xs transition-colors">
                    <Smartphone size={16} /> Abrir Coleta de Presença
                  </button>
                </Link>
              </div>
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
                    <p className="text-xs text-slate-400 mt-1">Envie o link copiado para a equipe.</p>
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
                                <p className="text-[11px] font-semibold text-amber-700">
                                  ⚠️ Saída Justificada
                                </p>
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

        {/* Notificação Toast de Saída */}
        {exitNotification && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white border border-amber-500/40 p-4 rounded-2xl shadow-2xl flex items-center gap-3 max-w-sm">
            <div className="bg-amber-500/20 text-amber-400 p-2 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-300">Aviso de Saída</p>
              <p className="text-xs text-slate-300 mt-0.5">{exitNotification}</p>
            </div>
            <button onClick={() => setExitNotification(null)} className="text-slate-400 hover:text-white p-1">
              <X size={16} />
            </button>
          </div>
        )}
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 1: DASHBOARD PRINCIPAL (INICIAR NOVO DDS + HISTÓRICO DE AUDITORIA)
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Topo do Portal */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-700">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Painel do Organizador</h1>
              <p className="text-slate-500 text-xs">Gestão Diária de Segurança e Auditoria Digital</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="self-end sm:self-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <LogOut size={16} /> Sair da Conta
          </button>
        </header>

        {/* Alerta de Reunião em Andamento (Se houver) */}
        {activeMeeting && (
          <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">
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
              onClick={handleResumeActiveMeeting}
              className="px-5 py-3 bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs rounded-xl transition-all shadow-sm"
            >
              Entrar na Sala Ao Vivo ➡️
            </button>
          </div>
        )}

        {/* Abas de Navegação */}
        <div className="flex bg-slate-200/80 p-1 rounded-2xl max-w-md">
          <button
            onClick={() => setActiveTab('NEW_DDS')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'NEW_DDS'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle size={16} /> Iniciar Novo DDS
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'HISTORY'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={16} /> Histórico ({meetingHistory.length})
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: FORMULÁRIO DE NOVO DDS COM PERFIL SALVO */}
        {/* ========================================================================= */}
        {activeTab === 'NEW_DDS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Formulário do Novo DDS */}
            <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Configurar Nova Reunião</h2>
                <p className="text-slate-500 text-xs">Preencha o tema para gerar a sala de hoje</p>
              </div>

              <form onSubmit={handleStartNewMeeting} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tema do DDS de Hoje</label>
                  <input 
                    type="text" 
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex: Prevenção de Acidentes com Tratores e Máquinas"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Local / Fazenda / Galpão</label>
                  <input 
                    type="text" 
                    value={farm} 
                    onChange={(e) => setFarm(e.target.value)}
                    placeholder="Ex: Fazenda Santa Maria - Setor Mecanizado"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 text-sm transition-all"
                >
                  <Play size={18} /> Iniciar DDS e Abrir Videoconferência
                </button>
              </form>
            </div>

            {/* Perfil Salvo do Organizador */}
            <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <UserCheck size={18} className="text-blue-600" /> Meus Dados de Organizador
                </h2>
                <p className="text-slate-500 text-xs">Ficam salvos para assinar os relatórios em PDF</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Seu Nome Completo</label>
                  <input
                    type="text"
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    placeholder="Ex: Alexandre Santos"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Função / Cargo</label>
                  <input
                    type="text"
                    value={organizerRole}
                    onChange={(e) => setOrganizerRole(e.target.value)}
                    placeholder="Ex: Técnico em Segurança do Trabalho"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Empresa / Fazenda Principal</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Agropecuária Progresso"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleSaveProfile();
                    alert('✅ Dados do organizador salvos no navegador com sucesso!');
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Salvar Minhas Informações
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: HISTÓRICO DE AUDITORIA COM DOWNLOAD DE PDFS ANTERIORES */}
        {/* ========================================================================= */}
        {activeTab === 'HISTORY' && (
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Histórico de Reuniões Realizadas</h2>
                <p className="text-slate-500 text-xs">Arquivo de conformidade e auditoria de Normas Regulamentadoras</p>
              </div>

              <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-3 py-1 rounded-full border border-blue-200">
                {meetingHistory.length} reuniões arquivadas
              </span>
            </div>

            {meetingHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <History size={40} className="mx-auto opacity-40" />
                <p className="text-sm font-semibold">Nenhum DDS finalizado no histórico ainda.</p>
                <p className="text-xs">Assim que você encerrar uma reunião, o relatório arquivado aparecerá aqui.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetingHistory.map((meeting) => (
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
                        <strong>{meeting.attendees?.length || 0}</strong> participantes registrados e auditados
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownloadHistoryPdf(meeting)}
                      className="px-4 py-2.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm self-start md:self-auto"
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