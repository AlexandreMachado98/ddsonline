 'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, CheckCircle2, User, Building, Briefcase, Sparkles, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
    } catch {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Botão auxiliar que preenche os dados de teste locais
  const handleQuickFill = () => {
    setIsRegisterMode(false);
    setEmail('admin@dds.com.br');
    setPassword('123456');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Brilho Verde de Fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-600/15 blur-[140px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 backdrop-blur-md">
        
        {/* Cabeçalho da Marca DDS ON */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-bold tracking-wide mb-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            Plataforma Digital de SST
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white">
            DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span>
          </h1>

          <p className="text-xs text-slate-300 font-medium max-w-xs mx-auto leading-relaxed">
            A nova forma de realizar, auditar e transmitir o Diálogo Diário de Segurança.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegisterMode && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 text-slate-500" size={17} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Alexandre Santos"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
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
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
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
                    placeholder="Ex: Agropecuária Progresso"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
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
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Senha de Acesso</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 text-slate-500" size={17} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Botão Auxiliar Discreto */}
          {!isRegisterMode && (
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[11px] text-slate-400 hover:text-green-400 font-medium flex items-center gap-1 transition-colors"
              >
                <Sparkles size={12} className="text-green-500" /> Preencher acesso rápido
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/25 mt-1"
          >
            {loading ? 'Acessando...' : isRegisterMode ? 'Cadastrar Organizador' : 'Acessar o Painel'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError('');
            }}
            className="text-xs text-green-400 hover:text-green-300 font-semibold transition-colors"
          >
            {isRegisterMode ? 'Já possui cadastro? Fazer login' : 'Primeiro acesso? Cadastre-se como organizador'}
          </button>
        </div>

        {/* Rodapé com Direitos Autorais e Link AM TST */}
        <footer className="pt-5 border-t border-slate-800/80 text-center space-y-1.5">
          <p className="text-[11px] text-slate-400 font-normal">
            © {new Date().getFullYear()} <strong>DDS ON</strong> • Todos os direitos reservados.
          </p>
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
            <span>Desenvolvido por</span>
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

      </div>
    </main>
  );
}