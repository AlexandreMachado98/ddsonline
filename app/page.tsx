 'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, Mail, ArrowRight, CheckCircle2, KeyRound, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Credenciais de Demonstração
  const DEMO_EMAIL = 'admin@dds.com.br';
  const DEMO_PASS = '123456';

  // Se o técnico já estiver com login salvo, manda direto para o painel de controle
  useEffect(() => {
    const auth = localStorage.getItem('dds_admin_auth');
    if (auth) {
      router.push('/admin');
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if ((email === DEMO_EMAIL && password === DEMO_PASS) || (email && password.length >= 4)) {
      setTimeout(() => {
        localStorage.setItem('dds_admin_auth', JSON.stringify({ 
          email, 
          role: 'Técnico de Segurança Master',
          loggedAt: new Date().toISOString() 
        }));
        router.push('/admin');
      }, 500);
    } else {
      setError('Credenciais incorretas. Use o e-mail e senha de teste.');
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASS);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Efeito de Luz */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20 text-blue-400 mb-2">
            <ShieldAlert size={36} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Portal do Organizador</h1>
          <p className="text-slate-400 text-xs">Gestão, Videoconferência e Auditoria de DDS</p>
        </div>

        {/* Card de Acesso Rápido */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <KeyRound size={12} /> Acesso Rápido Demo
            </span>
            <button
              type="button"
              onClick={handleQuickDemo}
              className="text-[11px] text-blue-300 hover:text-white font-bold bg-blue-600/30 hover:bg-blue-600/50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 border border-blue-400/20"
            >
              <Sparkles size={11} /> Preencher
            </button>
          </div>
          <div className="text-xs text-slate-300 space-y-0.5">
            <p><strong>E-mail:</strong> <code className="text-blue-300">admin@dds.com.br</code></p>
            <p><strong>Senha:</strong> <code className="text-blue-300">123456</code></p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">E-mail do Técnico / Gestor</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 text-slate-500" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@dds.com.br"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-10 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Senha de Acesso</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 text-slate-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-10 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
          >
            {loading ? 'Acessando Painel...' : 'Entrar no Painel do Técnico'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800/80 text-center space-y-1">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-500" />
            Conexão Criptografada e Segura (LGPD)
          </p>
          <p className="text-[10px] text-slate-600">
            Colaboradores devem acessar exclusivamente pelo link do DDS enviado pelo técnico.
          </p>
        </div>

      </div>
    </main>
  );
}