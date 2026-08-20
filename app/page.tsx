 'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, CheckCircle2, User, Building, Briefcase, Sparkles, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';

export default function HomePage() {
  const router = useRouter();
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Técnico em Segurança do Trabalho');
  const [company, setCompany] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const auth = localStorage.getItem('dds_admin_auth');
    if (auth) {
      router.push('/admin');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('Preencha seu e-mail corporativo e senha.');
      setLoading(false);
      return;
    }

    if (isRegisterMode && !name) {
      setError('Preencha seu nome completo.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isRegisterMode ? 'register' : 'login',
          email,
          password,
          name,
          role,
          company
        })
      });

      const data = await res.json();

      if (data.success && data.user) {
        localStorage.setItem('dds_admin_auth', JSON.stringify(data.user));
        router.push('/admin');
      } else {
        setError(data.error || 'Falha ao autenticar.');
      }
    } catch (err: any) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setIsRegisterMode(false);
    setEmail('admin@dds.com.br');
    setPassword('123456');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Brilho de fundo Verde AM TST */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-600/20 blur-[130px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 backdrop-blur-sm">
        
        {/* Logotipo Oficial AM TST */}
        <div className="text-center space-y-2">
          <BrandLogo size="lg" showSlogan={true} theme="dark" />
        </div>

        {/* Card de Teste Rápido */}
        {!isRegisterMode && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3.5 flex items-center justify-between">
            <span className="text-[11px] font-bold text-green-400 flex items-center gap-1.5">
              <KeyRound size={13} /> Demo: admin@dds.com.br
            </span>
            <button
              type="button"
              onClick={handleQuickDemo}
              className="text-[11px] text-green-300 hover:text-white font-bold bg-green-600/30 hover:bg-green-600/50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 border border-green-400/20"
            >
              <Sparkles size={11} /> Preencher
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegisterMode && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Seu Nome Completo</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 text-slate-500" size={17} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Alexandre Santos"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Cargo / Função</label>
                <div className="relative flex items-center">
                  <Briefcase className="absolute left-3.5 text-slate-500" size={17} />
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Ex: Técnico em Segurança do Trabalho"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Empresa / Fazenda Principal</label>
                <div className="relative flex items-center">
                  <Building className="absolute left-3.5 text-slate-500" size={17} />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Ex: Agropecuária Santa Maria"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Corporativo</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 text-slate-500" size={17} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@empresa.com.br"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Senha</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 text-slate-500" size={17} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/25 mt-2"
          >
            {loading ? 'Processando...' : isRegisterMode ? 'Cadastrar na AM TST' : 'Entrar no Portal AM TST'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError('');
            }}
            className="text-xs text-green-400 hover:text-green-300 font-semibold"
          >
            {isRegisterMode ? 'Já possui conta? Clique para Entrar' : 'Não tem conta? Cadastre-se na AM TST'}
          </button>
        </div>

        <div className="pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <CheckCircle2 size={13} className="text-green-500" />
            AM TST • Plataforma Segura & Conforme NR (LGPD)
          </p>
        </div>

      </div>
    </main>
  );
}