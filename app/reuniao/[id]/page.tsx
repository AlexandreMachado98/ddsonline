'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  CheckCircle, Users, LogOut, AlertTriangle, X, 
  Loader2, Send, PhoneOff, ShieldCheck, ExternalLink, MapPin, Sparkles, User, Fingerprint, Camera
} from 'lucide-react';
import SignaturePad from '@/components/SignaturePad';
import SelfieCapture from '@/components/SelfieCapture';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';

export default function MeetingRoomPage() {
  const params = useParams();
  const meetingId = (params?.id as string) || '';

  // Etapas: FORM -> SUCCESS (Presencial) -> ROOM (Remoto) -> EXIT_SUCCESS -> EXPIRED (Link Encerrado)
  const [currentStep, setCurrentStep] = useState<'FORM' | 'ROOM' | 'SUCCESS' | 'EXIT_SUCCESS' | 'EXPIRED'>('FORM');

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedSelfie, setSavedSelfie] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [topic, setTopic] = useState('DDS ON');
  const [farm, setFarm] = useState('');
  const [meetingType, setMeetingType] = useState<'PRESENTIAL' | 'REMOTE'>('PRESENTIAL');

  // =========================================================================
  // RADAR DE SESSÃO ÚNICA: Monitora se a reunião está ativa no banco
  // =========================================================================
  useEffect(() => {
    if (!meetingId) return;

    const checkMeetingStatus = async () => {
      try {
        const res = await fetch(`/api/reuniao?meetingId=${meetingId}&_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        
        if (data.success && data.status === 'ENDED') {
          setCurrentStep(prev => (prev === 'ROOM' || prev === 'SUCCESS') ? 'EXIT_SUCCESS' : 'EXPIRED');
        } else if (data.success && data.meeting) {
          setTopic(data.meeting.topic);
          setFarm(data.meeting.farm);
          setMeetingType(data.meeting.type || 'PRESENTIAL');
        } else {
          setCurrentStep('EXPIRED');
        }
      } catch {
        setCurrentStep('EXPIRED');
      }
    };

    checkMeetingStatus();
    const interval = setInterval(checkMeetingStatus, 3000);
    
    return () => clearInterval(interval);
  }, [meetingId]);

  const [showExitModal, setShowExitModal] = useState(false);
  const [exitReason, setExitReason] = useState('Chamado Operacional no Campo');
  const [customReason, setCustomReason] = useState('');
  const [exitSignature, setExitSignature] = useState<string | null>(null);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpf(value);
  };

  const handleSubmit = async () => {
    if (currentStep === 'EXPIRED') return;
    
    if (!name.trim()) {
      alert('⚠️ Por favor, digite seu Nome Completo.');
      return;
    }
    if (cpf.length < 14) {
      alert('⚠️ Por favor, digite um CPF válido com 11 dígitos.');
      return;
    }
    if (!savedSelfie) {
      alert('⚠️ Por favor, tire sua foto para biometria facial.');
      return;
    }
    if (!savedSignature) {
      alert('⚠️ Por favor, assine no quadro com o dedo.');
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

      if (!res.ok || !data.success) {
        alert(data.error || 'Erro ao registrar presença.');
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      console.error("Erro ao salvar presença:", err);
    }

    setIsSubmitting(false);

    if (meetingType === 'PRESENTIAL') {
      setCurrentStep('SUCCESS');
    } else {
      setCurrentStep('ROOM');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmExit = async () => {
    if (!exitSignature) {
      alert('Por favor, assine no quadro para confirmar a saída.');
      return;
    }

    const finalReason = exitReason === 'Outro' ? customReason || 'Não especificado' : exitReason;

    try {
      await fetch('/api/presenca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_exit',
          name: name.trim(),
          cpf: cpf.trim(),
          meetingId,
          exitReason: finalReason,
          exitSignature
        })
      });
    } catch {}

    setShowExitModal(false);
    setCurrentStep('EXIT_SUCCESS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePassThePhone = () => {
    setName('');
    setCpf('');
    setSavedSignature(null);
    setSavedSelfie(null);
    setExitSignature(null);
    setShowExitModal(false);
    setCurrentStep('FORM');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // TELA: LINK EXPIRADO / REUNIÃO ENCERRADA
  // =========================================================================
  if (currentStep === 'EXPIRED') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl space-y-4 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="bg-red-500/15 text-red-400 p-3.5 rounded-2xl inline-flex border border-red-500/30">
            <PhoneOff size={32} />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 inline-block">
              Acesso Encerrado
            </span>
            <h1 className="text-lg sm:text-xl font-black text-white">Reunião Finalizada</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            O técnico de segurança já finalizou este DDS. O link foi <strong>desativado para novas assinaturas</strong> por conformidade de segurança.
          </p>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" />
            Caso não tenha conseguido assinar, contate o TST da sua unidade.
          </div>
        </div>
      </main>
    );
  }

  // =========================================================================
  // TELA: SAÍDA REGISTRADA
  // =========================================================================
  if (currentStep === 'EXIT_SUCCESS') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl space-y-4 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-500/15 text-emerald-400 p-3.5 rounded-2xl inline-flex border border-emerald-500/30">
            <CheckCircle size={36} />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 inline-block">
              Desconectado com Sucesso
            </span>
            <h1 className="text-lg sm:text-xl font-black text-white">Participação Registrada</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Sua participação foi concluída e devidamente registrada na ata oficial de conformidade da <strong>AM TST</strong>.
          </p>
        </div>
      </main>
    );
  }

  // =========================================================================
  // TELA: SUCESSO NO DDS PRESENCIAL (PASSAR CELULAR)
  // =========================================================================
  if (currentStep === 'SUCCESS') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl space-y-4 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-500/15 text-emerald-400 p-4 rounded-2xl inline-flex border border-emerald-500/30 shadow-lg shadow-emerald-950/40">
            <CheckCircle size={40} />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 inline-block">
              Presença Confirmada
            </span>
            <h1 className="text-lg sm:text-xl font-black text-white">Assinatura Concluída!</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Obrigado, <strong>{name}</strong>. Sua presença com biometria facial e assinatura foi anexada à ata oficial do DDS.
          </p>

          <button
            onClick={handlePassThePhone}
            className="w-full mt-3 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Users size={16} /> Passar Celular para Próximo Colega
          </button>
        </div>
      </main>
    );
  }

  // =========================================================================
  // TELA: SALA DE VÍDEO (DDS REMOTO / AO VIVO)
  // =========================================================================
  if (currentStep === 'ROOM') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-2.5 sm:p-5 font-sans relative">
        <div className="w-full max-w-5xl flex flex-col space-y-3.5 flex-1">
          
          {/* Barra Superior do Participante */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
                <CheckCircle size={18} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-mono">DDS ON • Colaborador Online</p>
                <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs">{name} ({topic})</h2>
              </div>
            </div>

            <button
              onClick={() => setShowExitModal(true)}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all self-end sm:self-auto cursor-pointer"
            >
              <LogOut size={13} /> Registrar Saída
            </button>
          </div>

          {/* COMPONENTE DA SALA WEBRTC (COMO PARTICIPANTE) */}
          <div className="flex-1 min-h-[450px]">
            <DdsConferenceRoom
              roomName={meetingId}
              userName={name.trim()}
              isAdmin={false}
            />
          </div>
        </div>

        {/* Modal de Saída Antecipada */}
        {showExitModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-slate-900 text-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-800 space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle size={18} />
                  <h3 className="font-extrabold text-sm text-white">Registro de Saída Antecipada</h3>
                </div>
                <button onClick={() => setShowExitModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Motivo da Saída:</label>
                  <select
                    value={exitReason}
                    onChange={(e) => setExitReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
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
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Assine com o dedo para confirmar:</label>
                  <SignaturePad onSave={(sig) => setExitSignature(sig)} />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Voltar ao DDS
                </button>
                <button
                  onClick={handleConfirmExit}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Confirmar Saída
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // =========================================================================
  // TELA: FORMULÁRIO DE ENTRADA DO COLABORADOR
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-5 px-3.5 sm:px-4 font-sans">
      <header className="w-full max-w-md flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl shadow-sm mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-black tracking-tight">
            <span className="text-white">DDS </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">ON</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium border-l border-slate-700 pl-2">
            Lista de Presença
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Ao Vivo
        </div>
      </header>

      <div className="w-full max-w-md bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-4 sm:p-5 rounded-3xl shadow-xl mb-4 text-center border border-emerald-500/30">
        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30 inline-block">
          {meetingType === 'PRESENTIAL' ? 'DDS Presencial em Campo' : 'Transmissão Remota Ao Vivo'}
        </span>
        <h1 className="text-lg sm:text-xl font-black mt-1 text-white leading-snug">{topic}</h1>
        {farm && (
          <p className="text-xs text-emerald-200 mt-0.5 flex items-center justify-center gap-1">
            <MapPin size={11} className="text-emerald-400" /> {farm}
          </p>
        )}
      </div>

      <div className="w-full max-w-md space-y-4 pb-16">
        <div className="bg-slate-900 border border-slate-800 text-slate-300 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          <span>Preencha seus dados para auditoria oficial de conformidade.</span>
        </div>

        {/* 1. Dados Pessoais */}
        <section className="space-y-3 bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-sm">
          <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <User size={14} className="text-emerald-400" /> 1. Seus Dados
          </h2>
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Nome Completo</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome completo"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold placeholder-slate-600 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">CPF</label>
            <input 
              type="tel" 
              value={cpf} 
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold font-mono placeholder-slate-600 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </section>

        {/* 2. Biometria Facial */}
        <section className="bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-sm">
          <h2 className="text-xs font-black text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Camera size={14} className="text-emerald-400" /> 2. Biometria Facial
          </h2>
          <SelfieCapture onConfirm={(selfie) => setSavedSelfie(selfie)} />
        </section>

        {/* 3. Assinatura Digital */}
        <section className="bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-sm">
          <h2 className="text-xs font-black text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Fingerprint size={14} className="text-emerald-400" /> 3. Assinatura Digital
          </h2>
          <SignaturePad onSave={(signature) => setSavedSignature(signature)} />
        </section>

        {/* Botão de Envio */}
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-slate-950 font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-950/60 active:scale-[0.99] cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Registrando Presença...
            </>
          ) : (
            <>
              <Send size={16} /> {meetingType === 'PRESENTIAL' ? 'Confirmar Presença Oficial' : 'Confirmar e Acessar Transmissão'}
            </>
          )}
        </button>
      </div>

      <footer className="mt-2 pt-4 border-t border-slate-800/80 text-center space-y-1 w-full max-w-md">
        <p className="text-[10px] text-slate-400">
          © {new Date().getFullYear()} <strong>DDS ON</strong> • Todos os direitos reservados.
        </p>
        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
          <span>Desenvolvido e Auditado por</span>
          <a
            href="https://amtst.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-0.5 transition-colors underline underline-offset-2"
          >
            AM TST <ExternalLink size={9} />
          </a>
        </div>
      </footer>
    </main>
  );
}