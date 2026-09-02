'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Video, ArrowRight, Smartphone, LogIn, Lock, Users, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryId = searchParams.get('id');
  const toast = useToast();

  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Se veio com ?id= na URL, redireciona direto para a sala
  useEffect(() => {
    if (queryId) {
      router.push(`/reuniao/${encodeURIComponent(queryId)}`);
    }
  }, [queryId, router]);

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError('Por favor, digite o código ou cole o link da reunião.');
      toast.warning('Campo Vazio', 'Digite o código ou cole o link do DDS para entrar.');
      return;
    }

    setLoading(true);
    let cleanCode = roomCode.trim();

    // Se o usuário colou o link completo (ex: https://.../reuniao/1234), extrai só o ID
    if (cleanCode.includes('/reuniao/')) {
      cleanCode = cleanCode.split('/reuniao/')[1].split('?')[0];
    }

    router.push(`/reuniao/${encodeURIComponent(cleanCode)}`);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 sm:p-8 font-sans relative overflow-x-hidden">
      
      {/* Efeito de luz de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 blur-[140px] rounded-full pointer-events-none"></div>

      {/* Topo / Navbar */}
      <header className="w-full max-w-4xl flex items-center justify-between py-2 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">DDS Online</h1>
            <p className="text-[11px] text-slate-400">Segurança do Trabalho & Auditoria Digital</p>
          </div>
        </div>

        <Link href="/login">
          <button className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm min-h-[44px]">
            <LogIn size={15} className="text-blue-400" />
            <span className="hidden sm:inline">Portal do Organizador</span>
            <span className="sm:hidden">Entrar</span>
          </button>
        </Link>
      </header>

      {/* Bloco Central */}
      <div className="w-full max-w-md my-auto py-8 relative z-10 space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 bg-blue-600/10 rounded-3xl border border-blue-500/20 text-blue-400 mb-2">
            <Video size={36} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Acessar Diálogo Diário
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm mx-auto">
            Digite o código ou cole o link enviado pelo seu técnico de segurança para entrar na sala.
          </p>
        </div>

        {/* Formulário de Acesso à Sala */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-6 sm:p-7 rounded-3xl shadow-2xl space-y-4">
          <form onSubmit={handleJoinMeeting} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Código ou Link da Sala
              </label>
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 text-slate-500" size={18} />
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value);
                    setError('');
                  }}
                  placeholder="Ex: 8a5f-42b1 ou cole o link"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-10 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-2xl text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-600/25 min-h-[48px]"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Entrando na Sala...
                </>
              ) : (
                <>
                  Entrar no DDS Ao Vivo <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Lock size={12} className="text-emerald-400" />
              Sala 100% Privada e Isolada
            </span>
            <span className="flex items-center gap-1.5">
              <Smartphone size={12} className="text-blue-400" />
              Otimizado p/ Celular
            </span>
          </div>
        </div>

        {/* Card do Organizador */}
        <div className="bg-slate-900/50 border border-slate-800/70 rounded-3xl p-4 flex items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-bold text-slate-200">Você é Técnico ou Gestor?</p>
            <p className="text-slate-500 text-[11px]">Inicie uma reunião e baixe listas em PDF</p>
          </div>
          <Link href="/login">
            <button className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold rounded-2xl border border-blue-500/30 transition-colors shrink-0 min-h-[44px]">
              Abrir Painel
            </button>
          </Link>
        </div>

      </div>

      {/* Rodapé */}
      <footer className="w-full max-w-4xl text-center py-4 text-[11px] text-slate-500 border-t border-slate-800/60 relative z-10">
        DDS Online • Plataforma em Conformidade com as Normas Regulamentadoras (NRs) • Proteção de Dados LGPD
      </footer>

    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <span className="text-xs text-slate-400">Carregando DDS Online...</span>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}