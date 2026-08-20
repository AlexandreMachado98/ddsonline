 'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, Users, LogOut, AlertTriangle, X, Loader2, Send, PhoneOff, Clock, ShieldCheck } from 'lucide-react';
import SignaturePad from '@/components/SignaturePad';
import SelfieCapture from '@/components/SelfieCapture';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';

export default function MeetingRoomPage() {
  const params = useParams();
  const meetingId = params?.id as string;

  const [currentStep, setCurrentStep] = useState<'FORM' | 'ROOM' | 'EXIT_SUCCESS' | 'EXPIRED'>('FORM');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedSelfie, setSavedSelfie] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [topic, setTopic] = useState('DDS ON');
  const [farm, setFarm] = useState('');
  const [isLinkValid, setIsLinkValid] = useState(true);

  useEffect(() => {
    const fetchMeetingDetails = async () => {
      try {
        const res = await fetch('/api/reuniao');
        const data = await res.json();
        
        if (data.success && data.meeting) {
          setTopic(data.meeting.topic);
          setFarm(data.meeting.farm);

          if (data.meeting.inviteExpiresAt) {
            const expiresAt = new Date(data.meeting.inviteExpiresAt).getTime();
            const now = Date.now();

            if (now > expiresAt) {
              setIsLinkValid(false);
              setCurrentStep('EXPIRED');
            } else {
              setIsLinkValid(true);
            }
          }
        } else {
          setIsLinkValid(false);
          setCurrentStep('EXPIRED');
        }
      } catch {
        setIsLinkValid(false);
      }
    };

    fetchMeetingDetails();
    const interval = setInterval(fetchMeetingDetails, 5000);
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
    if (!isLinkValid) {
      alert('Este link expirou. Solicite um novo link ao técnico.');
      setCurrentStep('EXPIRED');
      return;
    }
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
    } catch {}

    setIsSubmitting(false);
    setCurrentStep('ROOM');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmExit = async () => {
    if (!exitSignature) {
      alert('Por favor, assine no quadro para confirmar a saída.');
      return;
    }

    const finalReason = exitReason === 'Outro' ? customReason || 'Não especificado' : exitReason;

    try {
      await fetch('/api/presenca/saida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

  // TELA DE LINK EXPIRADO
  if (currentStep === 'EXPIRED' || !isLinkValid) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-5 shadow-2xl">
          <div className="bg-amber-500/10 text-amber-400 p-4 rounded-2xl inline-flex border border-amber-500/20">
            <Clock size={36} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block">
              Tempo Limite Atingido
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Link de Acesso Expirado</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Por motivos de conformidade, este link de entrada tinha validade de <strong>10 minutos</strong> e expirou.
          </p>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1 text-left">
            <p className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-green-400" /> Como entrar na reunião?
            </p>
            <p className="text-[11px]">
              Solicite ao <strong>Técnico / Organizador</strong> que gere um novo link atualizado no painel dele.
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all"
          >
            Verificar se o link foi renovado
          </button>
        </div>
      </main>
    );
  }

  // TELA DE SAÍDA REGISTRADA
  if (currentStep === 'EXIT_SUCCESS') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-5 shadow-2xl">
          <div className="bg-red-500/10 text-red-400 p-4 rounded-2xl inline-flex border border-red-500/20">
            <PhoneOff size={36} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 inline-block">
              Chamada Encerrada
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Saída Registrada com Sucesso</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Obrigado, <strong>{name}</strong>. Sua saída foi comunicada ao técnico e arquivada na ata oficial de auditoria.
          </p>

          <div className="pt-5 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <CheckCircle size={14} className="text-emerald-500" />
            Você já pode fechar esta página com segurança.
          </div>
        </div>
      </main>
    );
  }

  // TELA DA SALA DE VÍDEO
  if (currentStep === 'ROOM') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-3 md:p-6 font-sans relative">
        <div className="w-full max-w-5xl flex flex-col space-y-4 flex-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/20 p-2 rounded-xl text-green-400">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">DDS ON • Presença Confirmada</p>
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

              <button
                onClick={handlePassThePhone}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Users size={14} /> Passar Celular
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

        {/* Modal de Justificativa de Saída */}
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

  // TELA DE FORMULÁRIO DE ENTRADA
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-6 px-4 font-sans">
      
      {/* Topo Limpo Padronizado: DDS ON */}
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

      {/* Banner da Reunião */}
      <div className="w-full max-w-md bg-gradient-to-r from-green-700 to-emerald-800 text-white p-5 rounded-2xl shadow-lg mb-6 text-center border border-green-500/30">
        <span className="text-[10px] font-bold uppercase tracking-wider text-green-200">Diálogo Diário de Segurança</span>
        <h1 className="text-xl font-bold mt-1 text-white">{topic}</h1>
        {farm && <p className="text-xs text-green-100 mt-0.5">📍 {farm}</p>}
      </div>

      <div className="w-full max-w-md space-y-6 pb-20">
        <div className="bg-slate-900 border border-slate-800 text-slate-300 text-xs p-3.5 rounded-xl text-center flex items-center justify-center gap-2">
          <Clock size={16} className="text-green-400 shrink-0" />
          <span>Preencha sua presença para liberar seu microfone e câmera no DDS ao vivo.</span>
        </div>

        {/* Dados */}
        <section className="space-y-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
          <h2 className="text-sm font-bold text-white">1. Seus Dados</h2>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nome Completo</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome completo"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">CPF</label>
            <input 
              type="tel" 
              value={cpf} 
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
        </section>

        {/* Selfie */}
        <section className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
          <h2 className="text-sm font-bold text-white mb-3">2. Biometria Facial</h2>
          <SelfieCapture onConfirm={(selfie) => setSavedSelfie(selfie)} />
        </section>

        {/* Assinatura */}
        <section className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
          <h2 className="text-sm font-bold text-white mb-3">3. Assinatura Digital</h2>
          <SignaturePad onSave={(signature) => setSavedSignature(signature)} />
        </section>

        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-[0.98] text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/25"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Conectando ao DDS ON...
            </>
          ) : (
            <>
              <Send size={20} /> Confirmar Presença e Entrar no DDS ON
            </>
          )}
        </button>
      </div>
    </main>
  );
}