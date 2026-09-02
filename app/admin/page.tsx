'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, Users, Link as LinkIcon, FileText, CheckCircle2, 
  ShieldAlert, Smartphone, Download, Copy, Check, LogOut, 
  History, PlusCircle, UserCheck, Building2, Calendar, AlertTriangle, X, Radio,
  Sparkles, ExternalLink, RefreshCw, Eye, Trash2, Camera, CheckSquare, Square,
  QrCode, RadioTower, Video, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { generateDdsPdf } from '@/lib/pdfGenerator';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';
import CacheBusterButton from '@/components/CacheBuster';
import GroupPhotoCapture from '@/components/GroupPhotoCapture';
import { useToast } from '@/components/Toast';

export default function AdminPanel() {
  const router = useRouter();
  const toast = useToast();

  // Controle de Abas: 'NEW_DDS' ou 'HISTORY'
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
  const [meetingType, setMeetingType] = useState<'PRESENTIAL' | 'REMOTE'>('PRESENTIAL');
  const [newDdsGroupPhoto, setNewDdsGroupPhoto] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // --- DADOS DA REUNIÃO EM ANDAMENTO ---
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exitNotification, setExitNotification] = useState<string | null>(null);

  // Modal de Confirmação para Encerrar Reunião
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

  // --- HISTÓRICO DE REUNIÕES E MULTI-SELEÇÃO ---
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);

  // 1. Carrega o perfil salvo do Organizador e verifica Login
  useEffect(() => {
    const auth = localStorage.getItem('dds_admin_auth');
    if (!auth) {
      router.push('/');
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

        // Notificação de saída justificada se houver
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

  // Salva o perfil do organizador
  const handleSaveProfile = () => {
    localStorage.setItem('dds_organizer_profile', JSON.stringify({
      name: organizerName,
      role: organizerRole,
      company: companyName
    }));
    toast.success('Perfil Salvo!', 'Suas informações de técnico e empresa foram atualizadas.');
  };

  // Inicia um NOVO DDS (Presencial ou Remoto)
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
          type: meetingType,
          organizerId,
          email,
          groupPhoto: newDdsGroupPhoto
        })
      });
      
      const data = await res.json();
      if (data.success && data.meeting) {
        setActiveMeeting(data.meeting);
        setIsLiveMode(true);
        setTopic('');
        setNewDdsGroupPhoto(null);
        fetchAllData();
        toast.success('DDS Iniciado!', `Sala aberta no formato ${meetingType === 'PRESENTIAL' ? 'Presencial' : 'Remoto / Ao Vivo'}.`);
      } else {
        toast.error('Erro ao Iniciar', data.error || 'Não foi possível abrir o DDS.');
      }
    } catch {
      toast.error('Erro de Conexão', 'Verifique sua conexão e tente novamente.');
    } finally {
      setIsStarting(false);
    }
  };

  // Atualiza foto em grupo durante a reunião ao vivo
  const handleUpdateLiveGroupPhoto = async (photo: string | null) => {
    if (!activeMeeting) return;
    setActiveMeeting((prev: any) => ({ ...prev, groupPhoto: photo }));
    try {
      await fetch('/api/reuniao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: activeMeeting.id, groupPhoto: photo })
      });
      if (photo) {
        toast.success('Foto em Grupo Vinculada!', 'A evidência fotográfica foi salva no DDS e será incluída no PDF.');
      } else {
        toast.info('Foto Removida', 'A foto em grupo foi desvinculada do DDS.');
      }
      fetchAllData();
    } catch {
      toast.error('Erro ao Salvar Imagem', 'Verifique sua conexão e tente novamente.');
    }
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
    if (!activeMeeting) return;
    generateDdsPdf({
      topic: activeMeeting.topic,
      farm: activeMeeting.farm,
      createdAt: activeMeeting.createdAt,
      groupPhoto: activeMeeting.groupPhoto,
      attendees: activeMeeting.attendees || []
    });
    toast.success('PDF Gerado!', 'O relatório de auditoria com foto e assinaturas foi baixado.');
  };

  // Baixa o PDF de uma reunião do HISTÓRICO
  const handleDownloadHistoryPdf = (meeting: any) => {
    generateDdsPdf({
      topic: meeting.topic,
      farm: meeting.farm,
      createdAt: meeting.createdAt,
      groupPhoto: meeting.groupPhoto,
      attendees: meeting.attendees || []
    });
    toast.success('Download Concluído', 'Relatório de auditoria baixado.');
  };

  // Encerra a reunião ativa
  const handleConfirmEndMeeting = async () => {
    setIsEndingMeeting(true);
    try {
      if (activeMeeting) {
        handleDownloadActivePdf();
      }
      await fetch('/api/reuniao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: activeMeeting?.id, status: 'ENDED' })
      });
      setIsLiveMode(false);
      setShowEndConfirmModal(false);
      setActiveMeeting(null);
      fetchAllData();
      toast.success('DDS Encerrado!', 'Os dados foram consolidados no seu histórico de auditoria.');
    } catch {
      toast.error('Erro ao Encerrar', 'Tente novamente.');
    } finally {
      setIsEndingMeeting(false);
    }
  };

  // Multi-seleção no Histórico
  const toggleSelectAll = () => {
    if (selectedMeetings.length === meetingHistory.length && meetingHistory.length > 0) {
      setSelectedMeetings([]);
    } else {
      setSelectedMeetings(meetingHistory.map(m => m.id));
    }
  };

  const toggleSelectMeeting = (id: string) => {
    setSelectedMeetings(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('dds_admin_auth');
    toast.info('Sessão Encerrada', 'Até logo!');
    router.push('/');
  };

  // =========================================================================
  // CENÁRIO 2: SALA DO DDS AO VIVO (PRESENCIAL OU REMOTO + FOTO EM GRUPO)
  // =========================================================================
  if (isLiveMode && activeMeeting) {
    const isPresential = activeMeeting.type === 'PRESENTIAL';
    const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/reuniao/${activeMeeting.id}` : '';

    return (
      <main className="min-h-screen bg-slate-950 text-white p-3 sm:p-6 font-sans relative overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Cabeçalho Oficial DDS ON */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                <ShieldAlert size={28} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">ON</span>
                </h1>
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
                Voltar ao Painel
              </button>
            </div>
          </header>

          {/* Banner Superior da Reunião Ativa */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-6 text-slate-950 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-emerald-400/30">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="font-black text-slate-950 uppercase tracking-widest text-[10px] bg-white/40 px-2.5 py-0.5 rounded-full">
                  {isPresential ? 'DDS Presencial Ativo' : 'DDS Remoto / Ao Vivo'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">{activeMeeting.topic}</h2>
              <p className="text-slate-900 font-semibold text-xs mt-1 flex items-center gap-1.5">
                📍 {activeMeeting.farm}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={handleCopyInviteLink}
                className="px-4 py-3 bg-slate-950/20 hover:bg-slate-950/30 text-slate-950 font-black rounded-2xl transition-all flex items-center gap-2 text-xs border border-white/20 backdrop-blur-sm min-h-[44px]"
              >
                {copiedLink ? <Check size={16} className="text-white" /> : <Copy size={16} />}
                {copiedLink ? 'Link Copiado!' : 'Copiar Link do DDS'}
              </button>

              <button 
                onClick={handleDownloadActivePdf}
                className="px-4 py-3 bg-white text-emerald-900 hover:bg-emerald-50 rounded-2xl font-black transition-all flex items-center gap-2 shadow-lg text-xs min-h-[44px]"
              >
                <Download size={16} /> Baixar Relatório PDF
              </button>

              <button 
                onClick={() => setShowEndConfirmModal(true)} 
                className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black transition-all text-xs shadow-lg min-h-[44px]"
              >
                Encerrar DDS
              </button>
            </div>
          </div>

          {/* Grid Principal */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Coluna Esquerda: QR Code Presencial OU Sala de Vídeo Remota + Foto em Grupo */}
            <div className="lg:col-span-7 space-y-5">
              
              {isPresential ? (
                /* --- PAINEL DO DDS PRESENCIAL (QR CODE + COLETA LOCAL) --- */
                <div className="bg-slate-900/90 p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 text-center space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
                    <QrCode size={16} /> QR Code de Assinatura Presencial
                  </div>

                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    Peça para os colaboradores apontarem a câmera do celular para o QR Code abaixo para registrar a presença e biometria no local.
                  </p>

                  <div className="p-4 bg-white rounded-3xl inline-block shadow-2xl border-4 border-emerald-500/40">
                    <QRCodeSVG
                      value={inviteUrl}
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link href={`/reuniao/${activeMeeting.id}`}>
                      <button className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 text-xs transition-all shadow-lg min-h-[44px]">
                        <Smartphone size={16} /> Assinar Neste Aparelho
                      </button>
                    </Link>
                  </div>
                </div>
              ) : (
                /* --- PAINEL DO DDS REMOTO (TRANSMISSÃO AO VIVO WEBRTC) --- */
                <div className="space-y-4">
                  <DdsConferenceRoom
                    roomName={activeMeeting.id}
                    userName={`${organizerName || 'Técnico'} (Organizador)`}
                    isAdmin={true}
                  />

                  <div className="bg-slate-900/90 p-4 rounded-3xl shadow-md border border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Coletar assinatura neste aparelho:</span>
                    <Link href={`/reuniao/${activeMeeting.id}`}>
                      <button className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-2xl flex items-center gap-2 text-xs transition-all shadow-md min-h-[44px]">
                        <Smartphone size={16} /> Abrir Coleta de Presença
                      </button>
                    </Link>
                  </div>
                </div>
              )}

              {/* CARD DE FOTO EM GRUPO DA EQUIPE */}
              <div className="bg-slate-900/90 p-5 sm:p-6 rounded-3xl shadow-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <Camera size={18} className="text-emerald-400" /> Foto em Grupo da Equipe (Evidência no PDF)
                  </h3>
                  {activeMeeting.groupPhoto ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                      <Check size={12} /> Foto Vinculada
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                      Opcional
                    </span>
                  )}
                </div>

                <GroupPhotoCapture
                  initialPhoto={activeMeeting.groupPhoto}
                  onPhotoChange={handleUpdateLiveGroupPhoto}
                />
              </div>

            </div>

            {/* Coluna Direita: Contadores e Lista de Presença em Tempo Real */}
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
                  <FileText size={18} className="text-emerald-400" /> Lista de Presença em Tempo Real
                </h3>
                
                {!activeMeeting.attendees || activeMeeting.attendees.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <p className="text-xs font-semibold">Nenhum colaborador assinou ainda.</p>
                    <p className="text-[11px] text-slate-600">
                      {isPresential ? 'Apresente o QR Code acima para a equipe.' : 'Envie o link para os participantes entrarem.'}
                    </p>
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
                A sessão será concluída, as presenças e biometrias serão arquivadas e o relatório oficial com a foto da equipe será salvo no seu histórico.
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
  // CENÁRIO 1: DASHBOARD PRINCIPAL (INICIAR DDS PRESENCIAL/REMOTO + HISTÓRICO)
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans relative overflow-x-hidden">
      
      {/* Luz de fundo decorativa */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-600/10 blur-[140px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        
        {/* Topo do Portal DDS ON */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">ON</span>
              </h1>
              <p className="text-slate-400 text-xs">Painel do Técnico de Segurança (TST) • Gestão Diária de NRs</p>
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
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300 border border-emerald-400/30">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/30 rounded-2xl">
                <Radio size={26} className="animate-pulse text-slate-950" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-950 bg-white/40 px-2.5 py-0.5 rounded-full inline-block mb-1">
                  {activeMeeting.type === 'PRESENTIAL' ? 'DDS Presencial em Andamento' : 'DDS Remoto em Andamento'}
                </span>
                <h3 className="text-lg font-black text-white">{activeMeeting.topic} ({activeMeeting.farm})</h3>
              </div>
            </div>

            <button
              onClick={() => setIsLiveMode(true)}
              className="px-5 py-3.5 bg-slate-950 text-white hover:bg-slate-900 font-bold text-xs rounded-2xl transition-all shadow-lg shrink-0 min-h-[44px]"
            >
              Entrar na Sala ➡️
            </button>
          </div>
        )}

        {/* Abas de Navegação */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl max-w-md border border-slate-800">
          <button
            onClick={() => setActiveTab('NEW_DDS')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'NEW_DDS'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 font-black shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle size={16} /> Configurar Novo DDS
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'HISTORY'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 font-black shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History size={16} /> Histórico ({meetingHistory.length})
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: CONFIGURAR DDS (PRESENCIAL / REMOTO) + FOTO EM GRUPO               */}
        {/* ========================================================================= */}
        {activeTab === 'NEW_DDS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Formulário do Novo DDS */}
            <div className="lg:col-span-7 bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white">Novo Diálogo Diário de Segurança</h2>
                <p className="text-slate-400 text-xs">Escolha o formato presencial ou remoto e preencha os dados</p>
              </div>

              <form onSubmit={handleStartNewMeeting} className="space-y-4">
                
                {/* SELETOR DE MODALIDADE: PRESENCIAL VS REMOTO */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Modalidade do DDS
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMeetingType('PRESENTIAL')}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        meetingType === 'PRESENTIAL'
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <QrCode size={16} /> Presencial (QR Code)
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Coleta direta no celular/tablet no canteiro ou galpão
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMeetingType('REMOTE')}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        meetingType === 'REMOTE'
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Video size={16} /> Remoto (Vídeo)
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Videoconferência e transmissão com tela compartilhada
                      </p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tema do DDS de Hoje</label>
                  <input 
                    type="text" 
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex: Prevenção de Acidentes com Tratores e Máquinas"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Local / Fazenda / Galpão</label>
                  <input 
                    type="text" 
                    value={farm} 
                    onChange={(e) => setFarm(e.target.value)}
                    placeholder="Ex: Fazenda Santa Maria - Setor Mecanizado"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                {/* CAMPO DE FOTO EM GRUPO DA EQUIPE */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Foto da Equipe Reunida (Opcional)
                  </label>
                  <GroupPhotoCapture
                    initialPhoto={newDdsGroupPhoto}
                    onPhotoChange={setNewDdsGroupPhoto}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isStarting}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 text-sm transition-all min-h-[48px]"
                >
                  <Play size={18} /> {isStarting ? 'Iniciando Reunião...' : `Abrir DDS ${meetingType === 'PRESENTIAL' ? 'Presencial' : 'Remoto'}`}
                </button>
              </form>
            </div>

            {/* Perfil Salvo do Organizador */}
            <div className="lg:col-span-5 bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-400" /> Meus Dados de Organizador
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
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Função / Cargo</label>
                  <input
                    type="text"
                    value={organizerRole}
                    onChange={(e) => setOrganizerRole(e.target.value)}
                    placeholder="Ex: Técnico em Segurança do Trabalho"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Empresa / Fazenda Principal</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Agropecuária Progresso"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-500"
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
        {/* ABA 2: HISTÓRICO COM MULTI-SELEÇÃO E DOWNLOAD DE PDFS COM FOTO EM GRUPO    */}
        {/* ========================================================================= */}
        {activeTab === 'HISTORY' && (
          <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Histórico de Reuniões Realizadas</h2>
                <p className="text-slate-400 text-xs">Arquivo de conformidade e auditoria digital de NRs</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {meetingHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                      selectedMeetings.length === meetingHistory.length && meetingHistory.length > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {selectedMeetings.length === meetingHistory.length && meetingHistory.length > 0 ? (
                      <CheckSquare size={14} className="text-emerald-400" />
                    ) : (
                      <Square size={14} className="text-slate-400" />
                    )}
                    <span>
                      {selectedMeetings.length === meetingHistory.length && meetingHistory.length > 0
                        ? 'Desmarcar Todos'
                        : `Selecionar Tudo (${meetingHistory.length})`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {meetingHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-500 space-y-2">
                <History size={40} className="mx-auto opacity-40 text-emerald-500" />
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
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedMeetings.includes(meeting.id)}
                        onChange={() => toggleSelectMeeting(meeting.id)}
                        className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 cursor-pointer shrink-0"
                      />

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                            {meeting.farm || 'Fazenda'}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {meeting.type === 'PRESENTIAL' ? 'Presencial' : 'Remoto'}
                          </span>
                          {meeting.groupPhoto && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                              <Camera size={11} /> Foto em Grupo Anexada
                            </span>
                          )}
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
                    </div>

                    <button
                      onClick={() => handleDownloadHistoryPdf(meeting)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm self-start md:self-auto min-h-[44px]"
                    >
                      <Download size={15} /> Baixar Ata PDF
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rodapé Oficial com Direitos Autorais e Link AM TST */}
        <footer className="pt-8 pb-4 border-t border-slate-800/80 text-center space-y-1">
          <p className="text-[10px] sm:text-xs text-slate-400">
            © {new Date().getFullYear()} <strong>DDS ON</strong> • Todos os direitos reservados.
          </p>
          <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs text-slate-500">
            <span>Desenvolvido e Auditado por</span>
            <a
              href="https://amtst.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-0.5 transition-colors underline underline-offset-2"
            >
              AM TST <ExternalLink size={10} />
            </a>
          </div>
        </footer>

      </div>
    </main>
  );
}