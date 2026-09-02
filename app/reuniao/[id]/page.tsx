'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  CheckCircle, Users, LogOut, AlertTriangle, X, Loader2, 
  Send, PhoneOff, User, CreditCard, Camera, PenTool, 
  Sparkles, ChevronRight, ArrowLeft, Radio, Building2
} from 'lucide-react';
import SignaturePad from '@/components/SignaturePad';
import SelfieCapture from '@/components/SelfieCapture';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';
import CacheBusterButton from '@/components/CacheBuster';
import { useToast } from '@/components/Toast';

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const meetingId = params?.id as string;

  const [currentStep, setCurrentStep] = useState<'FORM' | 'ROOM' | 'EXIT_SUCCESS'>('FORM');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedSelfie, setSavedSelfie] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [topic, setTopic] = useState('DDS Online');
  const [farm, setFarm] = useState('');
  const [meetingNotFound, setMeetingNotFound] = useState(false);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(true);

  // Modal de Saída Antecipada
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitReason, setExitReason] = useState('Chamado Operacional no Campo');
  const [customReason, setCustomReason] = useState('');
  const [exitSignature, setExitSignature] = useState<string | null>(null);
  const [isSubmittingExit, setIsSubmittingExit] = useState(false);

  useEffect(() => {
    const fetchMeetingDetails = async () => {
      try {
        setIsLoadingMeeting(true);
        const res = await fetch(`/api/reuniao?id=${encodeURIComponent(meetingId)}`);
        const data = await res.json();
        if (data.success && data.meeting) {
          setTopic(data.meeting.topic);
          setFarm(data.meeting.farm);
          setMeetingNotFound(false);
        } else {
          setMeetingNotFound(true);
        }
      } catch {
        setMeetingNotFound(true);
      } finally {
        setIsLoadingMeeting(false);
      }
    };
    if (meetingId) {
      fetchMeetingDetails();
    }
  }, [meetingId]);

  // Máscara e formatação de CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpf(value);
  };

  // Validação e Envio de Presença
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.warning('Nome Completo Obrigatório', 'Por favor, digite seu nome completo para assinar a lista.');
      return;
    }
    if (cpf.length < 14) {
      toast.warning('CPF Incompleto', 'Por favor, digite um CPF válido com 11 dígitos.');
      return;
    }
    if (!savedSelfie) {
      toast.warning('Biometria Facial Pendente', 'Por favor, tire sua foto facial ou selecione do aparelho.');
      return;
    }
    if (!savedSignature) {
      toast.warning('Assinatura Pendente', 'Por favor, desenhe sua assinatura digital no quadro.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: name.trim(),
      cpf: cpf.trim(),
      savedSelfie,
      savedSignature,
      meetingId
    };

    try {
      const res = await fetch('/api/presenca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Presença Validada!', 'Você já está conectado à sala ao vivo do DDS.');
        setCurrentStep('ROOM');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error('Falha no Registro', data.error || 'Não foi possível registrar a presença.');
      }
    } catch {
      toast.error('Erro de Conexão', 'Verifique sua internet e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmação de Saída Antecipada
  const handleConfirmExit = async () => {
    if (!exitSignature) {
      toast.warning('Assinatura Necessária', 'Assine no quadro para confirmar a justificativa da sua saída.');
      return;
    }

    setIsSubmittingExit(true);
    const finalReason = exitReason === 'Outro' ? customReason || 'Não especificado' : exitReason;

    try {
      await fetch('/api/presenca/saida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          cpf: cpf.trim(),
          meetingId,
          exitReason: finalReason,
          exitSignature
        })
      });

      setShowExitModal(false);
      setCurrentStep('EXIT_SUCCESS');
      toast.info('Saída Registrada', 'Sua justificativa foi gravada com sucesso no relatório.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast.error('Erro ao Registrar Saída', 'Tente novamente.');
    } finally {
      setIsSubmittingExit(false);
    }
  };

  // Passar Celular para outro colaborador no campo
  const handlePassThePhone = () => {
    setName('');
    setCpf('');
    setSavedSignature(null);
    setSavedSelfie(null);
    setExitSignature(null);
    setShowExitModal(false);
    setCurrentStep('FORM');
    toast.info('Pronto para o Próximo', 'O formulário foi liberado para o próximo colega assinar.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // CENÁRIO 1: LOADING SKELETON
  // =========================================================================
  if (isLoadingMeeting) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center space-y-4 animate-pulse">
          <div className="p-4 bg-blue-600/10 rounded-3xl border border-blue-500/20 text-blue-400">
            <Loader2 size={36} className="animate-spin" />
          </div>
          <div className="space-y-1 text-center">
            <h2 className="text-base font-bold text-slate-200">Localizando Sala de DDS...</h2>
            <p className="text-xs text-slate-500">Conectando ao ecossistema seguro da empresa</p>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 2: REUNIÃO NÃO ENCONTRADA / EXPIRADA
  // =========================================================================
  if (meetingNotFound) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-2xl animate-in fade-in">
          <div className="bg-amber-500/10 text-amber-400 p-4 rounded-3xl inline-flex border border-amber-500/20">
            <AlertTriangle size={36} />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-white">Reunião Não Localizada</h1>
            <p className="text-slate-400 text-xs leading-relaxed">
              O código ou link deste DDS não foi encontrado ou já foi finalizado pelo organizador.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Voltar à Página Inicial
          </button>
        </div>
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 3: SAÍDA REGISTRADA COM SUCESSO
  // =========================================================================
  if (currentStep === 'EXIT_SUCCESS') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-5 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="bg-red-500/10 text-red-400 p-4 rounded-2xl inline-flex border border-red-500/20 shadow-inner">
            <PhoneOff size={36} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 inline-block">
              Presença Encerrada
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Saída Justificada com Sucesso</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Obrigado, <strong>{name}</strong>. Sua saída foi comunicada ao técnico de segurança e arquivada para o relatório oficial de conformidade.
          </p>

          <div className="pt-4 flex flex-col gap-2">
            <button
              onClick={handlePassThePhone}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Users size={16} /> Passar Celular para Outro Colega
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <CheckCircle size={14} className="text-emerald-500" />
            Você pode fechar esta página com segurança.
          </div>
        </div>
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 4: SALA AO VIVO (VÍDEO E TRANSMISSÃO DO INSTRUTOR)
  // =========================================================================
  if (currentStep === 'ROOM') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-3 sm:p-6 font-sans relative">
        <div className="w-full max-w-5xl flex flex-col space-y-4 flex-1">
          
          {/* Topo da Sala */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl border border-slate-800 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2.5 rounded-2xl text-emerald-400 border border-emerald-500/30">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <Sparkles size={11} /> Presença Validada no DDS
                </p>
                <h2 className="text-sm font-bold text-white">{name} • <span className="text-slate-400 font-normal">{topic}</span></h2>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <CacheBusterButton />

              <button
                onClick={() => setShowExitModal(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
              >
                <LogOut size={14} /> Preciso Sair
              </button>

              <button
                onClick={handlePassThePhone}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-md min-h-[44px]"
              >
                <Users size={14} /> Passar Celular
              </button>
            </div>
          </div>

          {/* Componente de Vídeo Ao Vivo */}
          <div className="flex-1 min-h-[480px]">
            <DdsConferenceRoom
              roomName={meetingId}
              userName={name}
              isAdmin={false}
            />
          </div>

        </div>

        {/* Modal de Saída Antecipada */}
        {showExitModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle size={20} />
                  <h3 className="font-bold text-white text-sm">Registro de Saída Antecipada</h3>
                </div>
                <button 
                  onClick={() => setShowExitModal(false)} 
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Motivo da sua saída:</label>
                  <select
                    value={exitReason}
                    onChange={(e) => setExitReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-3 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Chamado Operacional no Campo">Chamado Operacional no Campo</option>
                    <option value="Mal-estar / Atendimento Médico">Mal-estar / Atendimento Médico</option>
                    <option value="Troca de Turno / Posto">Troca de Turno / Posto</option>
                    <option value="Emergência Pessoal">Emergência Pessoal</option>
                    <option value="Outro">Outro Motivo</option>
                  </select>
                </div>

                {exitReason === 'Outro' && (
                  <div>
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Descreva o motivo..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assine para confirmar a saída:</label>
                  <SignaturePad onSave={(sig) => setExitSignature(sig)} />
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
  // CENÁRIO 5: FORMULÁRIO DE ENTRADA DO COLABORADOR (3 PASSOS GUIADOS)
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-6 px-4 font-sans relative overflow-x-hidden">
      
      {/* Luz de fundo decorativa */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/15 blur-[130px] rounded-full pointer-events-none"></div>

      {/* Topo com Título do DDS */}
      <header className="w-full max-w-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-3xl shadow-2xl mb-6 text-center relative z-10 border border-blue-400/20">
        <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full inline-block mb-1">
          Sala Exclusiva do DDS
        </span>
        <h1 className="text-xl font-black mt-1 tracking-tight">{topic}</h1>
        {farm && (
          <p className="text-xs text-blue-100 mt-1 flex items-center justify-center gap-1">
            <Building2 size={13} /> {farm}
          </p>
        )}
      </header>

      {/* Formulário com Passos em Cards Coesos */}
      <div className="w-full max-w-md space-y-5 pb-16 relative z-10">
        
        {/* Aviso de Orientação */}
        <div className="bg-slate-900/80 border border-slate-800 text-slate-300 text-xs p-4 rounded-3xl flex items-center gap-3 backdrop-blur-md shadow-sm">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-2xl shrink-0">
            <Radio size={18} className="animate-pulse" />
          </div>
          <p className="leading-relaxed text-[11px]">
            Preencha seus dados, tire a foto e assine para liberar o vídeo da reunião ao vivo.
          </p>
        </div>

        {/* PASSO 1: DADOS PESSOAIS */}
        <section className="bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <User size={16} className="text-blue-400" /> 1. Seus Dados
            </h2>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
              Obrigatório
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nome Completo</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Número do CPF</label>
              <div className="relative flex items-center">
                <input 
                  type="tel" 
                  value={cpf} 
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                {cpf.length === 14 && (
                  <CheckCircle size={18} className="absolute right-3.5 text-emerald-400" />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* PASSO 2: BIOMETRIA FACIAL (SELFIE) */}
        <section className="bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Camera size={16} className="text-blue-400" /> 2. Validação Facial (Foto)
            </h2>
            {savedSelfie ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle size={11} /> OK
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                Pendente
              </span>
            )}
          </div>

          <SelfieCapture onConfirm={(selfie) => setSavedSelfie(selfie)} />
        </section>

        {/* PASSO 3: ASSINATURA DIGITAL */}
        <section className="bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <PenTool size={16} className="text-blue-400" /> 3. Assinatura Digital
            </h2>
            {savedSignature ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle size={11} /> OK
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                Pendente
              </span>
            )}
          </div>

          <SignaturePad onSave={(sig) => setSavedSignature(sig)} />
        </section>

        {/* BOTÃO DE CONFIRMAR PRESENÇA */}
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-600/30 min-h-[48px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Registrando Presença...
            </>
          ) : (
            <>
              <Send size={18} /> Confirmar Presença e Entrar no DDS
            </>
          )}
        </button>

      </div>

    </main>
  );
}