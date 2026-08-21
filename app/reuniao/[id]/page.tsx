 'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, Users, LogOut, AlertTriangle, X, Loader2, Send, PhoneOff, ShieldCheck, ExternalLink } from 'lucide-react';
import SignaturePad from '@/components/SignaturePad';
import SelfieCapture from '@/components/SelfieCapture';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';

export default function MeetingRoomPage() {
  const params = useParams();
  const meetingId = params?.id as string;

  // Etapas: FORM -> SUCCESS (Presencial) -> ROOM (Remoto) -> EXIT_SUCCESS -> EXPIRED (Link Quebrado)
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
  // RADAR DE SESSÃO ÚNICA: Quebra o link na mesma hora se a reunião for encerrada!
  // =========================================================================
  useEffect(() => {
    if (!meetingId) return;

    const checkMeetingEnded = async () => {
      try {
        const res = await fetch(`/api/reuniao?meetingId=${meetingId}&_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        
        if (data.success && data.status === 'ENDED') {
          // Se já assinou e estava na sala, mostra "Chamada Encerrada"
          // Se ainda ia preencher, bloqueia o formulário com "Link Expirado"
          setCurrentStep(prev => (prev === 'ROOM' || prev === 'SUCCESS') ? 'EXIT_SUCCESS' : 'EXPIRED');
        } else if (data.success && data.meeting) {
          setTopic(data.meeting.topic);
          setFarm(data.meeting.farm);
          setMeetingType(data.meeting.type || 'PRESENTIAL');
        } else {
          setCurrentStep('EXPIRED'); // Não achou a reunião no banco
        }
      } catch {
        setCurrentStep('EXPIRED');
      }
    };

    checkMeetingEnded(); // Verifica na hora que abre o link
    const interval = setInterval(checkMeetingEnded, 3000); // Radar a cada 3 segundos
    
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
    if (currentStep === 'EXPIRED') return; // Bloqueia o envio se tiver expirado
    
    if (!name.trim()) {
      alert('⚠️ Por favor, digite seu Nome Completo.');
      return;
    }
    if (cpf.length < 14) {
      alert('⚠️ Por favor, digite um CPF válido.');
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
      name,
      cpf,
      savedSelfie,
      savedSignature,
      meetingId
    };

    try {
      await fetch('/api/presenca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
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
          name,
          cpf,
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
  // TELA 5: LINK EXPIRADO / BLOQUEADO (Técnico já encerrou a sala)
  // =========================================================================
  if (currentStep === 'EXPIRED') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-5 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="bg-red-500/10 text-red-400 p-4 rounded-2xl inline-flex border border-red-500/20">
            <PhoneOff size={36} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 inline-block">
              Acesso Negado
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Reunião Encerrada</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            O organizador já finalizou este DDS. Por questões de conformidade, o link de acesso foi <strong>desativado permanentemente</strong>.
          </p>

          <div className="pt-5 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" />
            Caso não tenha assinado, contate o TST da unidade.
          </div>
        </div>
      </main>
    );
  }

  // =========================================================================
  // TELA 4: SAÍDA REGISTRADA (CHAMADA ENCERRADA)
  // =========================================================================
  if (currentStep === 'EXIT_SUCCESS') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-5 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="bg-red-500/10 text-red-400 p-4 rounded-2xl inline-flex border border-red-500/20">
            <CheckCircle size={36} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 inline-block">
              Desconectado
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Participação Concluída</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            O DDS foi encerrado. A sua participação foi concluída e arquivada na ata oficial de auditoria da AM TST.
          </p>
        </div>
      </main>
    );
  }

  // =========================================================================
  // TELA 3: DE SUCESSO (DDS PRESENCIAL)
  // =========================================================================
  if (currentStep === 'SUCCESS') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-5 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="bg-green-500/10 text-green-400 p-4 rounded-2xl inline-flex border border-green-500/20">
            <CheckCircle size={44} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-green-400 uppercase tracking-widest bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 inline-block">
              Presença Confirmada
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Assinatura Realizada!</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Obrigado, <strong>{name}</strong>. Sua presença no treinamento presencial foi registrada na ata oficial.
          </p>

          <button
            onClick={handlePassThePhone}
            className="w-full mt-4 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
          >
            <Users size={16} /> Passar Celular para Outro Colega
          </button>
        </div>
      </main>
    );
  }

  // =========================================================================
  // TELA 2: SALA DE VÍDEO (DDS REMOTO)
  // =========================================================================
  if (currentStep === 'ROOM') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-3 md:p-6 font-sans relative">
        <div className="w-full max-w-5xl flex flex-col space-y-4 flex-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/20 p-2 rounded-xl text-green-400">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">DDS ON • Presença Validada</p>
                <h2 className="text-sm font-bold text-white">{name} ({topic})</h2>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowExitModal(true)}
                className="flex-1 sm:flex-none px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <LogOut size={14} /> Preciso Sair
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[500px]">
            <DdsConferenceRoom
              roomName={meetingId}
              userName={name}
              isAdmin={false}
            />
          </div>
        </div>

        {/* Modal de Saída */}
        {showExitModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle size={20} />
                  <h3 className="font-bold text-slate-800 text-sm">Registro de Saída Antecipada</h3>
                </div>
                <button onClick={() => setShowExitModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo da Saída:</label>
                  <select
                    value={exitReason}
                    onChange={(e) => setExitReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-500"
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
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assine para confirmar sua saída:</label>
                  <SignaturePad onSave={(sig) => setExitSignature(sig)} />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl"
                >
                  Voltar ao DDS
                </button>
                <button
                  onClick={handleConfirmExit}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md"
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
  // TELA 1: FORMULÁRIO DE ENTRADA DO COLABORADOR
  // =========================================================================
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-6 px-4 font-sans">
      <header className="w-full max-w-md flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl shadow-sm mb-6">
        <div className="flex items-center gap-2">
          <span className="text-base font-black tracking-tight">
            <span className="text-white">DDS </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span>
          </span>
          <span className="text-[11px] text-slate-400 font-medium border-l border-slate-700 pl-2">
            Registro Oficial
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          Conectado
        </div>
      </header>

      <div className="w-full max-w-md bg-gradient-to-r from-green-700 to-emerald-800 text-white p-5 rounded-3xl shadow-lg mb-6 text-center border border-green-500/30">
        <span className="text-[10px] font-bold uppercase tracking-wider text-green-200">
          {meetingType === 'PRESENTIAL' ? 'DDS Presencial' : 'Diálogo Diário de Segurança'}
        </span>
        <h1 className="text-xl font-bold mt-1 text-white">{topic}</h1>
        {farm && <p className="text-xs text-green-100 mt-0.5">📍 {farm}</p>}
      </div>

      <div className="w-full max-w-md space-y-6 pb-20">
        <div className="bg-slate-900 border border-slate-800 text-slate-300 text-xs p-3.5 rounded-xl text-center flex items-center justify-center gap-2">
          <ShieldCheck size={16} className="text-green-400 shrink-0" />
          <span>Valide sua presença abaixo para registrar sua conformidade.</span>
        </div>

        <section className="space-y-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
          <h2 className="text-sm font-bold text-white">1. Seus Dados</h2>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Nome Completo</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome completo"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">CPF</label>
            <input 
              type="tel" 
              value={cpf} 
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
            />
          </div>
        </section>

        <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
          <h2 className="text-sm font-bold text-white mb-3">2. Biometria Facial</h2>
          <SelfieCapture onConfirm={(selfie) => setSavedSelfie(selfie)} />
        </section>

        <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
          <h2 className="text-sm font-bold text-white mb-3">3. Assinatura Digital</h2>
          <SignaturePad onSave={(signature) => setSavedSignature(signature)} />
        </section>

        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-[0.98] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/25"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Registrando Presença...
            </>
          ) : (
            <>
              <Send size={18} /> {meetingType === 'PRESENTIAL' ? 'Registrar Presença Oficial' : 'Confirmar Presença e Entrar no Vídeo'}
            </>
          )}
        </button>
      </div>

      <footer className="mt-4 pt-6 border-t border-slate-800/80 text-center space-y-1.5 w-full max-w-md">
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