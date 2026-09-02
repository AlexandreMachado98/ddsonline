'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { 
  Users, CheckCircle2, ShieldAlert, Sparkles, LogOut, 
  Building2, Calendar, AlertTriangle, ArrowRight, User, 
  Camera, PenTool, Check, Smartphone, Loader2, ExternalLink, RefreshCw, QrCode
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SelfieCapture from '@/components/SelfieCapture';
import SignaturePad from '@/components/SignaturePad';
import { useToast } from '@/components/Toast';

function PresencialContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const queryMeetingId = searchParams.get('id');

  // Estados do DDS
  const [meeting, setMeeting] = useState<any>(null);
  const [topic, setTopic] = useState('DDS Presencial');
  const [farm, setFarm] = useState('');
  const [meetingId, setMeetingId] = useState<string>(queryMeetingId || '');
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(true);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [noMeetingFound, setNoMeetingFound] = useState(false);

  // Estados do Formulário do Colaborador
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [savedSelfie, setSavedSelfie] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAdmitted, setHasAdmitted] = useState(false);

  // 1. Busca a reunião presencial ativa ou pelo ID
  useEffect(() => {
    let isMounted = true;

    const fetchMeeting = async () => {
      try {
        let url = '/api/reuniao';
        if (queryMeetingId) {
          url = `/api/reuniao?id=${encodeURIComponent(queryMeetingId)}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && data.meeting) {
          setMeeting(data.meeting);
          setMeetingId(data.meeting.id);
          setTopic(data.meeting.topic || 'DDS Presencial');
          setFarm(data.meeting.farm || '');
          if (data.meeting.status === 'ENDED') {
            setIsMeetingEnded(true);
          } else {
            setIsMeetingEnded(false);
          }
          setNoMeetingFound(false);
        } else {
          // Se não encontrou pelo ID nem reunião ativa
          if (queryMeetingId) {
            setNoMeetingFound(true);
          } else {
            setNoMeetingFound(true);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar DDS presencial:", err);
      } finally {
        if (isMounted) setIsLoadingMeeting(false);
      }
    };

    fetchMeeting();
    const interval = setInterval(fetchMeeting, 2500); // Polling a cada 2.5s para detectar encerramento em tempo real

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [queryMeetingId]);

  // Formatação de CPF
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

  // Submissão de Presença Presencial
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
      toast.warning('Biometria Facial Pendente', 'Por favor, tire sua foto facial ou envie uma foto.');
      return;
    }

    if (!savedSignature) {
      toast.warning('Assinatura Pendente', 'Por favor, assine na tela para confirmar sua presença.');
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
          meetingId: meetingId || 'presencial'
        })
      });

      const data = await res.json();

      if (data.success) {
        setHasAdmitted(true);
        toast.success('Presença Presencial Confirmada!', 'Seus dados e biometria foram arquivados com sucesso.');
      } else {
        toast.error('Erro ao Registrar', data.error || 'Não foi possível registrar a presença.');
      }
    } catch {
      toast.error('Falha de Conexão', 'Verifique sua internet e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterAnother = () => {
    setName('');
    setCpf('');
    setSavedSelfie(null);
    setSavedSignature(null);
    setHasAdmitted(false);
  };

  // 1. CARREGANDO
  if (isLoadingMeeting) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-emerald-500" />
          <h2 className="text-sm font-bold text-slate-300">Carregando DDS Presencial...</h2>
          <p className="text-xs text-slate-500">Conectando à lista de presença</p>
        </div>
      </main>
    );
  }

  // 2. DDS ENCERRADO PELO ORGANIZADOR (DETECTADO EM TEMPO REAL)
  if (isMeetingEnded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 blur-[140px] rounded-full pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4 relative z-10 backdrop-blur-md">
          <div className="inline-flex p-3.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            DDS Encerrado pelo Organizador
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
            Este Diálogo Diário de Segurança foi finalizado pelo técnico. As presenças e biometrias coletadas foram arquivadas com sucesso na ata oficial.
          </p>

          <Link href="/">
            <button className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg min-h-[44px]">
              Voltar ao Início
            </button>
          </Link>
        </div>
      </main>
    );
  }

  // 3. NENHUM DDS ATIVO ENCONTRADO
  if (noMeetingFound) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4 relative z-10">
          <div className="inline-flex p-3.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-xl font-black text-white">Nenhum DDS Presencial Ativo</h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Não há nenhuma sessão de DDS aberta neste momento. Solicite ao técnico de segurança a abertura do DDS.
          </p>
          <Link href="/">
            <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl transition-all border border-slate-700 min-h-[44px]">
              Voltar à Página Inicial
            </button>
          </Link>
        </div>
      </main>
    );
  }

  // 4. SUCESSO NA ASSINATURA PRESENCIAL
  if (hasAdmitted) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/15 blur-[140px] rounded-full pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 relative z-10 backdrop-blur-md animate-in fade-in zoom-in duration-200">
          <div className="inline-flex p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={48} />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 inline-block mb-1">
              Conformidade NR Auditada
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">Presença Confirmada!</h2>
            <p className="text-xs text-slate-300">
              Obrigado, <strong className="text-white">{name}</strong>. Sua assinatura e biometria facial foram vinculadas ao DDS de hoje.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-2 text-slate-300">
            <p>Tema: <strong className="text-white">{topic}</strong></p>
            {farm && <p>Local: <strong className="text-white">{farm}</strong></p>}
            <p>Horário do Registro: <strong className="text-emerald-400">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></p>
            <p>Status: <strong className="text-emerald-400">✅ 100% Válido para Auditoria</strong></p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleRegisterAnother}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 min-h-[44px]"
            >
              <RefreshCw size={15} /> Registrar Próximo Colaborador
            </button>

            <Link href="/" className="block">
              <button
                type="button"
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition-colors border border-slate-700 min-h-[44px]"
              >
                Concluir e Sair
              </button>
            </Link>
          </div>

          <footer className="pt-2 text-center">
            <p className="text-[10px] text-slate-500">
              © {new Date().getFullYear()} <strong>DDS ON</strong> • Auditado por AM TST
            </p>
          </footer>
        </div>
      </main>
    );
  }

  // 5. FORMULÁRIO DE ENTRADA DO COLABORADOR PRESENCIAL
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-6 px-3.5 sm:px-6 font-sans relative overflow-x-hidden">
      
      {/* Luz de fundo */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-600/15 blur-[130px] rounded-full pointer-events-none"></div>

      {/* Topo com Identificação do DDS ON Presencial */}
      <header className="w-full max-w-md bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 p-5 rounded-3xl shadow-2xl mb-5 text-center relative z-10 border border-emerald-400/30">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/40 px-3 py-0.5 rounded-full inline-flex items-center gap-1">
            <QrCode size={12} /> DDS Presencial
          </span>
        </div>
        <h1 className="text-lg sm:text-xl font-black mt-1 tracking-tight text-white leading-snug">{topic}</h1>
        {farm && (
          <p className="text-xs text-slate-950 font-bold mt-1 flex items-center justify-center gap-1">
            <Building2 size={13} /> {farm}
          </p>
        )}
      </header>

      {/* Formulário com Passos em Cards Mobile-Friendly */}
      <div className="w-full max-w-md space-y-4 pb-16 relative z-10">
        
        {/* Aviso */}
        <div className="bg-slate-900/80 border border-slate-800 text-slate-300 text-xs p-3.5 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-sm">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <p className="leading-relaxed text-[11px]">
            Preencha seus dados, tire a foto facial e assine abaixo para validar sua presença presencial.
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
              <Camera size={16} className="text-emerald-400" /> 2. Biometria Facial
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

        {/* BOTÃO DE CONFIRMAÇÃO */}
        <button 
          type="button"
          onClick={handleAdmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 text-sm transition-all min-h-[48px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Gravando Presença...
            </>
          ) : (
            <>
              Confirmar Presença no DDS <ArrowRight size={18} />
            </>
          )}
        </button>

        {/* Rodapé */}
        <footer className="pt-4 text-center space-y-1">
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

export default function PresencialPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-emerald-500" />
      </div>
    }>
      <PresencialContent />
    </Suspense>
  );
}
