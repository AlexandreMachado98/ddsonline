 'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Send, CheckCircle, Wifi, WifiOff, RefreshCw, Users, LogOut, AlertTriangle, X, Loader2, PhoneOff } from 'lucide-react';
import SignaturePad from '@/components/SignaturePad';
import SelfieCapture from '@/components/SelfieCapture';
import DdsConferenceRoom from '@/components/DdsConferenceRoom';

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<'FORM' | 'ROOM' | 'EXIT_SUCCESS'>('FORM');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedSelfie, setSavedSelfie] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [activeMeetingTopic, setActiveMeetingTopic] = useState<string>('DDS do Dia');
  const [activeMeetingId, setActiveMeetingId] = useState<string>('dds-principal');
  const [farm, setFarm] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modal de Saída
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitReason, setExitReason] = useState('Chamado Operacional no Campo');
  const [customReason, setCustomReason] = useState('');
  const [exitSignature, setExitSignature] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const res = await fetch('/api/reuniao');
        const data = await res.json();
        if (data.success && data.meeting) {
          setActiveMeetingTopic(data.meeting.topic);
          setActiveMeetingId(data.meeting.id);
          setFarm(data.meeting.farm);
        }
      } catch {}
    };
    fetchMeeting();
  }, []);

  const syncPendingData = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    const stored = localStorage.getItem('dds_pending_attendances');
    if (!stored) return;

    try {
      const list = JSON.parse(stored);
      if (!Array.isArray(list) || list.length === 0) return;

      setIsSyncing(true);
      const remaining: any[] = [];

      for (const item of list) {
        try {
          const res = await fetch('/api/presenca', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });
          const data = await res.json();
          if (!data.success) remaining.push(item);
        } catch {
          remaining.push(item);
        }
      }

      localStorage.setItem('dds_pending_attendances', JSON.stringify(remaining));
      setPendingCount(remaining.length);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const stored = localStorage.getItem('dds_pending_attendances');
    if (stored) {
      try {
        setPendingCount(JSON.parse(stored).length);
      } catch {}
    }

    const handleOnline = () => {
      setIsOnline(true);
      syncPendingData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) syncPendingData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingData]);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpf(value);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('⚠️ Por favor, digite seu Nome Completo.');
      return;
    }
    if (cpf.length < 14) {
      alert('⚠️ Por favor, digite um CPF válido com 11 dígitos.');
      return;
    }
    if (!savedSelfie) {
      alert('⚠️ Por favor, clique no botão "Tirar Foto" para registrar sua biometria.');
      return;
    }
    if (!savedSignature) {
      alert('⚠️ Por favor, faça sua assinatura com o dedo no quadro.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name,
      cpf,
      savedSelfie,
      savedSignature,
      meetingId: activeMeetingId
    };

    if (!navigator.onLine) {
      try {
        const stored = localStorage.getItem('dds_pending_attendances');
        const list = stored ? JSON.parse(stored) : [];
        list.push(payload);
        localStorage.setItem('dds_pending_attendances', JSON.stringify(list));
        setPendingCount(list.length);
      } catch {}
    } else {
      try {
        await fetch('/api/presenca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error("Erro ao enviar presença", err);
      }
    }

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
          meetingId: activeMeetingId,
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
  // TELA 3: CHAMADA ENCERRADA / SAÍDA REGISTRADA (DEFINITIVA E LIMPA)
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
                <h2 className="text-sm font-bold text-white">{name} ({activeMeetingTopic})</h2>
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
              roomName={activeMeetingId}
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
                      placeholder="Descreva o motivo da saída..."
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

  // TELA 1: FORMULÁRIO DE PRESENÇA (HOMEPAGE)
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-6 px-4 font-sans">
      
      <header className="w-full max-w-md flex items-center justify-between bg-white border border-gray-200 px-4 py-2.5 rounded-2xl shadow-sm mb-6">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <Wifi size={14} className="text-emerald-600" /> Starlink / Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <WifiOff size={14} className="text-amber-600" /> Sem Conexão (Offline)
            </span>
          )}
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            {isSyncing && <RefreshCw size={12} className="animate-spin text-blue-600" />}
            {pendingCount} pendente(s)
          </div>
        )}
      </header>

      <div className="w-full max-w-md bg-blue-600 text-white p-5 rounded-2xl shadow-md mb-6 text-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">Diálogo Diário de Segurança</span>
        <h1 className="text-xl font-bold mt-1">{activeMeetingTopic}</h1>
        {farm && <p className="text-xs text-blue-100 mt-0.5">📍 {farm}</p>}
      </div>

      <div className="w-full max-w-md space-y-6 pb-20">
        <section className="space-y-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800">1. Seus Dados</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome Completo</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome completo"
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