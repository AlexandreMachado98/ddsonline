'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle2, ShieldAlert, Sparkles, LogOut, 
  Building2, Calendar, AlertTriangle, ArrowRight, User, 
  Camera, PenTool, Radio, Check, Smartphone, Loader2, ExternalLink, RefreshCw, QrCode
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SelfieCapture from '@/components/SelfieCapture';
import SignaturePad from '@/components/SignaturePad';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';
import { useToast } from '@/components/Toast';

export default function MeetingRoom() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const roomId = params?.id as string;

  // Estados de Dados da Reunião
  const [topic, setTopic] = useState('Diálogo Diário de Segurança');
  const [farm, setFarm] = useState('');
  const [meetingStatus, setMeetingStatus] = useState<'LIVE' | 'ENDED'>('LIVE');
  const [meetingType, setMeetingType] = useState<'PRESENTIAL' | 'REMOTE'>('REMOTE');
  const [organizerInfo, setOrganizerInfo] = useState<any>(null);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(true);
  const [meetingNotFound, setMeetingNotFound] = useState(false);

  // Estados do Formulário do Colaborador
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [savedSelfie, setSavedSelfie] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAdmitted, setHasAdmitted] = useState(false);

  // Estados do Modal de Saída Antecipada
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitReason, setExitReason] = useState('');
  const [exitSignature, setExitSignature] = useState<string | null>(null);
  const [isSubmittingExit, setIsSubmittingExit] = useState(false);
  const [hasExitedSuccessfully, setHasExitedSuccessfully] = useState(false);

  // 1. Polling contínuo (a cada 2.5s) para carregar dados e detectar encerramento em tempo real para todos os membros
  useEffect(() => {
    if (!roomId) return;
    let isMounted = true;

    const fetchMeeting = async () => {
      try {
        const res = await fetch(`/api/reuniao?id=${encodeURIComponent(roomId)}`);
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && data.meeting) {
          setTopic(data.meeting.topic || 'DDS de Segurança');
          setFarm(data.meeting.farm || '');
          if (data.meeting.type) setMeetingType(data.meeting.type);
          if (data.meeting.organizer) setOrganizerInfo(data.meeting.organizer);

          if (data.meeting.status === 'ENDED') {
            setMeetingStatus('ENDED');
          } else {
            setMeetingStatus('LIVE');
          }
          setMeetingNotFound(false);
        } else {
          setMeetingNotFound(true);
        }
      } catch (err) {
        console.error("Erro ao sincronizar status da reunião:", err);
      } finally {
        if (isMounted) setIsLoadingMeeting(false);
      }
    };

    fetchMeeting();
    const interval = setInterval(fetchMeeting, 2500); // Polling a cada 2.5s para desconexão imediata quando o organizador encerra

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomId]);

  // Formatação automática de CPF (000.000.000-00)
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 11) raw = raw.slice(0, 11);

    let formatted = raw;
    if (raw.length > 9) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
    } else if (raw.length > 6) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
    } else if (raw.length > 3) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3)}`;
    }

    setCpf(formatted);
  };

  // Submissão de Presença pelo Colaborador
  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.warning('Campo Obrigatório', 'Por favor, informe seu nome completo.');
      return;
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length < 11) {
      toast.warning('CPF Incompleto', 'Por favor, digite os 11 dígitos do seu CPF.');
      return;
    }

    if (!savedSelfie) {
      toast.warning('Biometria Facial Pendente', 'Por favor, tire sua foto facial ou selecione do aparelho.');
      return;
    }

    if (!savedSignature) {
      toast.warning('Assinatura Digital Pendente', 'Por favor, assine na tela para validar sua presença.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/presenca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          cpf: cleanCpf,
          savedSelfie,
          savedSignature,
          meetingId: roomId
        })
      });

      const data = await res.json();

      if (data.success) {
        setHasAdmitted(true);
        toast.success('Presença Validada!', 'Sua presença foi registrada com sucesso.');
      } else {
        toast.error('Erro ao Registrar', data.error || 'Não foi possível salvar sua presença.');
      }
    } catch {
      toast.error('Falha de Conexão', 'Verifique sua internet e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmação de Saída Antecipada
  const handleConfirmExit = async () => {
    if (!exitReason.trim()) {
      toast.warning('Justificativa Obrigatória', 'Por favor, informe o motivo da saída.');
      return;
    }
    if (!exitSignature) {
      toast.warning('Assinatura de Saída', 'Por favor, assine para confirmar a saída.');
      return;
    }

    setIsSubmittingExit(true);

    try {
      const cleanCpf = cpf.replace(/\D/g, '');
      const res = await fetch('/api/presenca/saida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: roomId,
          name: name.trim(),
          cpf: cleanCpf,
          exitReason: exitReason.trim(),
          exitSignature
        })
      });

      const data = await res.json();

      if (data.success) {
        setShowExitModal(false);
        setHasExitedSuccessfully(true);
        toast.success('Saída Registrada', 'Sua saída antecipada foi arquivada com sucesso.');
      } else {
        toast.error('Erro ao Registrar Saída', data.error || 'Tente novamente.');
      }
    } catch {
      toast.error('Erro de Rede', 'Não foi possível registrar a saída.');
    } finally {
      setIsSubmittingExit(false);
    }
  };

  // =========================================================================
  // CENÁRIO 1: LOADING SKELETON
  // =========================================================================
  if (isLoadingMeeting) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-emerald-500" />
          <h2 className="text-sm font-bold text-slate-300">Conectando ao DDS ON...</h2>
          <p className="text-xs text-slate-500">Buscando sala e permissões</p>
        </div>
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 2: SALA ENCERRADA PELO ORGANIZADOR (DESCONEXÃO EM TEMPO REAL)
  // =========================================================================
  if (meetingStatus === 'ENDED') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 blur-[140px] rounded-full pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4 relative z-10 backdrop-blur-md animate-in fade-in zoom-in duration-200">
          <div className="inline-flex p-3.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            DDS Encerrado pelo Organizador
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
            Este Diálogo Diário de Segurança foi concluído pelo técnico de segurança. As presenças e biometrias coletadas foram arquivadas na ata oficial.
          </p>

          <Link href="/">
            <button className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg min-h-[44px]">
              Voltar à Página Inicial
            </button>
          </Link>
        </div>
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 3: SALA NÃO ENCONTRADA
  // =========================================================================
  if (meetingNotFound) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4 relative z-10 backdrop-blur-md">
          <div className="inline-flex p-3.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-xl font-black text-white">Sala Não Encontrada</h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            O link desta reunião não foi localizado. Solicite um novo link ao técnico de segurança.
          </p>
          <Link href="/">
            <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl transition-all border border-slate-700 min-h-[44px]">
              Ir para a Página Inicial
            </button>
          </Link>
        </div>
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 4: SAÍDA JUSTIFICADA CONCLUÍDA
  // =========================================================================
  if (hasExitedSuccessfully) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4 relative z-10">
          <div className="inline-flex p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-xl font-black text-white">Saída Justificada com Sucesso</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Obrigado, <strong className="text-white">{name}</strong>. Sua saída e justificativa foram gravadas com assinatura e constarão no relatório oficial de auditoria.
          </p>
          <Link href="/">
            <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl transition-all border border-slate-700 min-h-[44px]">
              Concluir e Fechar
            </button>
          </Link>
        </div>
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 5: PARTICIPANTE ADMITIDO (SALA AO VIVO OU CONFIRMAÇÃO PRESENCIAL)
  // =========================================================================
  if (hasAdmitted) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-3 sm:p-6 font-sans relative overflow-x-hidden">
        <div className="max-w-4xl mx-auto space-y-5">
          
          {/* Topo do DDS ON */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                  DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">ON</span>
                </h1>
                <p className="text-xs text-slate-400">
                  Participante: <strong className="text-white">{name}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowExitModal(true)}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-2xl text-xs font-bold transition-all border border-amber-500/20 flex items-center justify-center gap-1.5 self-end sm:self-auto min-h-[44px]"
            >
              <LogOut size={15} /> Justificar Saída Antecipada
            </button>
          </header>

          {meetingType === 'PRESENTIAL' ? (
            /* --- CONFIRMAÇÃO DO DDS PRESENCIAL --- */
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
              <div className="inline-flex p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={44} />
              </div>
              
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white">Presença Registrada com Sucesso!</h2>
                <p className="text-xs text-emerald-400 font-bold">DDS Presencial no Canteiro / Fazenda</p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-2 max-w-md mx-auto">
                <p className="text-slate-400">Tema: <strong className="text-white">{topic}</strong></p>
                {farm && <p className="text-slate-400">Local: <strong className="text-white">{farm}</strong></p>}
                <p className="text-slate-400">Data/Hora: <strong className="text-white">{new Date().toLocaleString('pt-BR')}</strong></p>
                <p className="text-slate-400">Status: <strong className="text-emerald-400">Biometria e Assinatura Auditadas (NRs)</strong></p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    setName('');
                    setCpf('');
                    setSavedSelfie(null);
                    setSavedSignature(null);
                    setHasAdmitted(false);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <RefreshCw size={14} /> Registrar Outro Colaborador
                </button>
              </div>
            </div>
          ) : (
            /* --- SALA DE VÍDEO DO DDS REMOTO --- */
            <div className="space-y-4">
              <DdsConferenceRoom
                roomName={roomId}
                userName={name}
                isAdmin={false}
              />
            </div>
          )}

          {/* Rodapé Oficial DDS ON */}
          <footer className="pt-4 text-center space-y-1">
            <p className="text-[10px] text-slate-500">
              © {new Date().getFullYear()} <strong>DDS ON</strong> • Desenvolvido e Auditado por{' '}
              <a href="https://amtst.vercel.app" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 font-bold underline">
                AM TST
              </a>
            </p>
          </footer>

        </div>

        {/* Modal de Saída Antecipada */}
        {showExitModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl w-fit">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-bold text-white">Registrar Saída Antecipada</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Por exigência das Normas Regulamentadoras (NRs), saídas antes do término do DDS devem ser justificadas e assinadas digitalmente.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Motivo da Saída</label>
                  <textarea
                    rows={2}
                    value={exitReason}
                    onChange={(e) => setExitReason(e.target.value)}
                    placeholder="Ex: Chamado urgente no setor mecânico / Atendimento médico"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-600 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Assinatura Digital de Saída</label>
                  <SignaturePad onConfirm={(sig) => setExitSignature(sig)} />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition-colors min-h-[44px]"
                >
                  Continuar no DDS
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  disabled={isSubmittingExit}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  {isSubmittingExit ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar Saída'}
                </button>
              </div>

            </div>
          </div>
        )}
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 6: FORMULÁRIO DE ENTRADA DO COLABORADOR (3 PASSOS GUIADOS)
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-6 px-3.5 sm:px-6 font-sans relative overflow-x-hidden">
      
      {/* Luz de fundo decorativa */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-600/15 blur-[130px] rounded-full pointer-events-none"></div>

      {/* Topo com Título do DDS ON */}
      <header className="w-full max-w-md bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 p-5 rounded-3xl shadow-2xl mb-5 text-center relative z-10 border border-emerald-400/30">
        <span className="text-[10px] font-black uppercase tracking-widest bg-white/40 px-3 py-1 rounded-full inline-block mb-1">
          {meetingType === 'PRESENTIAL' ? 'DDS Presencial' : 'DDS Remoto / Ao Vivo'}
        </span>
        <h1 className="text-xl font-black mt-1 tracking-tight text-white">{topic}</h1>
        {farm && (
          <p className="text-xs text-slate-900 font-bold mt-1 flex items-center justify-center gap-1">
            <Building2 size={13} /> {farm}
          </p>
        )}
      </header>

      {/* Formulário com Passos em Cards Coesos */}
      <div className="w-full max-w-md space-y-4 pb-16 relative z-10">
        
        {/* Aviso de Orientação */}
        <div className="bg-slate-900/80 border border-slate-800 text-slate-300 text-xs p-3.5 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-sm">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
            <Radio size={18} className="animate-pulse" />
          </div>
          <p className="leading-relaxed text-[11px]">
            Preencha seus dados, tire a foto facial e assine na tela para registrar sua presença no DDS.
          </p>
        </div>

        {/* PASSO 1: DADOS PESSOAIS */}
        <section className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <User size={16} className="text-emerald-400" /> 1. Seus Dados
            </h2>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              Obrigatório
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Número do CPF</label>
              <div className="relative flex items-center">
                <input 
                  type="tel" 
                  value={cpf} 
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono min-h-[44px]"
                />
                {cpf.replace(/\D/g, '').length === 11 && (
                  <Check size={18} className="absolute right-3.5 text-emerald-400" />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* PASSO 2: BIOMETRIA FACIAL */}
        <section className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Camera size={16} className="text-emerald-400" /> 2. Validação Facial (Foto)
            </h2>
            {savedSelfie ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Check size={12} /> Concluído
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Obrigatório
              </span>
            )}
          </div>

          <SelfieCapture onConfirm={(selfie) => setSavedSelfie(selfie)} />
        </section>

        {/* PASSO 3: ASSINATURA DIGITAL TOUCH */}
        <section className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <PenTool size={16} className="text-emerald-400" /> 3. Assinatura Digital
            </h2>
            {savedSignature ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Check size={12} /> Concluído
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Obrigatório
              </span>
            )}
          </div>

          <SignaturePad onConfirm={(sig) => setSavedSignature(sig)} />
        </section>

        {/* BOTÃO DE CONFIRMAR PRESENÇA */}
        <button 
          type="button"
          onClick={handleAdmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 text-sm transition-all min-h-[48px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Registrando Presença...
            </>
          ) : (
            <>
              Confirmar Presença no DDS <ArrowRight size={18} />
            </>
          )}
        </button>

        {/* Rodapé Oficial DDS ON */}
        <footer className="pt-6 text-center space-y-1">
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