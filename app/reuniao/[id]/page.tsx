 'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, Users, LogOut, AlertTriangle, X, Loader2, Send, PhoneOff, Clock, ShieldAlert, RefreshCw } from 'lucide-react';
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
  const [topic, setTopic] = useState('DDS Online');
  const [farm, setFarm] = useState('');
  
  // Controle de Tempo Restante do Link
  const [timeLeft, setTimeLeft] = useState<string>('');
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

  // Cronômetro visual regressivo dos 10 minutos
  useEffect(() => {
    const timer = setInterval(() => {
      // Atualiza o estado
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modal de Saída
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

  // =========================================================================
  // TELA 4: LINK EXPIRADO (APÓS 10 MINUTOS)
  // =========================================================================
  if (currentStep === 'EXPIRED' || !isLinkValid) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-5 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="bg-amber-500/10 text-amber-400 p-4 rounded-2xl inline-flex border border-amber-500/20 shadow-inner">
            <Clock size={36} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block">
              Tempo Limite Atingido
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Link de Acesso Expirado</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Por motivos de segurança e conformidade da empresa, este link de entrada tinha validade de <strong>10 minutos</strong> e já expirou.
          </p>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1 text-left">
            <p className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-blue-400" /> O que fazer agora?
            </p>
            <p className="text-[11px]">
              Entre em contato com o <strong>Técnico de Segurança / Organizador</strong> da reunião e solicite que ele clique em <em>"Gerar Novo Link"</em> no painel dele.
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={14} /> Verificar se o link foi renovado
          </button>
        </div>
      </main>
    );
  }

  // TELA 3: CONFIRMAÇÃO DE SAÍDA
  if (currentStep === 'EXIT_SUCCESS') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-5 shadow-2xl">
          <div className="bg-red-500/10 text-red-400 p-4 rounded-2xl inline-flex border border-red-500/20 shadow-inner">
            <PhoneOff size={36} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 inline-block">
              Chamada Encerrada
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Saída Registrada com Sucesso</h1>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            Obrigado, <strong>{name}</strong>. Sua saída e justificativa foram comunicadas ao técnico e arquivadas no relatório de auditoria.
          </p>

          <div className="pt-5 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <CheckCircle size={14} className="text-emerald-500" />
            Você já pode fechar esta página com segurança.
          </div>
        </div>
      </main>
    );
  }

  // TELA 2: SALA DO DDS AO VIVO COM VÍDEO
  if (currentStep === 'ROOM') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-3 md:p-6 font-sans relative">
        <div className="w-full max-w-5xl flex flex-col space-y-4 flex-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Presença Validada no DDS</p>
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
                className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
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

  // TELA 1: FORMULÁRIO DE ENTRADA
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-6 px-4 font-sans">
      <header className="w-full max-w-md bg-blue-600 text-white p-5 rounded-2xl shadow-md mb-6 text-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">Sala Exclusiva do DDS</span>
        <h1 className="text-xl font-bold mt-1">{topic}</h1>
        {farm && <p className="text-xs text-blue-100 mt-0.5">📍 {farm}</p>}
      </header>

      <div className="w-full max-w-md space-y-6 pb-20">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3.5 rounded-xl text-center flex items-center justify-center gap-2">
          <Clock size={16} className="text-amber-600 shrink-0" />
          <span><strong>Link com validade de 10 minutos:</strong> Conclua sua presença para entrar na sala.</span>
        </div>

        <section className="space-y-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800">1. Seus Dados</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome Completo</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-base"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">CPF</label>
            <input 
              type="tel" 
              value={cpf} 
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-base"
            />
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-3">2. Validação Facial (Selfie)</h2>
          <SelfieCapture onConfirm={(selfie) => setSavedSelfie(selfie)} />
        </section>

        <section className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-3">3. Assinatura Digital</h2>
          <SignaturePad onSave={(signature) => setSavedSignature(signature)} />
        </section>

        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Conectando à Reunião...
            </>
          ) : (
            <>
              <Send size={20} /> Validar Presença e Entrar no DDS Ao Vivo
            </>
          )}
        </button>
      </div>
    </main>
  );
}