'use client';

import React, { useState } from 'react';
import { 
  ShieldAlert, Lock, Mail, ArrowRight, CheckCircle2, 
  KeyRound, Sparkles, Building2, User, ArrowLeft, Loader2 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Credenciais de Demonstração
  const DEMO_EMAIL = 'admin@dds.com.br';
  const DEMO_PASS = '123456';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: isRegisterMode ? name : undefined,
          companyName: isRegisterMode ? companyName : undefined
        })
      });

      const data = await res.json();

      if (data.success && data.user) {
        localStorage.setItem('dds_admin_auth', JSON.stringify(data.user));
        localStorage.setItem('dds_organizer_profile', JSON.stringify({
          name: data.user.name,
          role: data.user.position || 'Técnico em Segurança do Trabalho',
          company: data.user.company || ''
        }));
        toast.success('Login Autorizado!', `Bem-vindo, ${data.user.name}.`);
        router.push('/admin');
      } else {
        const errorMsg = data.error || 'Credenciais inválidas.';
        setError(errorMsg);
        toast.error('Erro de Acesso', errorMsg);
      }
    } catch (err) {
      const connErr = 'Erro de conexão ao autenticar. Tente novamente.';
      setError(connErr);
      toast.error('Erro de Rede', connErr);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASS);
    toast.info('Dados Preenchidos', 'Clique em Entrar no Sistema para acessar o painel demo.');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-x-hidden">
      
      {/* Luz de fundo decorativa */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 blur-[130px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Topo com Botão Voltar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Link 
            href="/"
            className="text-xs text-slate-400 hover:text-white font-bold flex items-center gap-1.5 transition-colors p-1"
          >
            <ArrowLeft size={16} /> Voltar ao Início
          </Link>
          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
            Acesso Seguro
          </span>
        </div>

        <div className="text-center space-y-1.5">
          <div className="inline-flex p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20 text-blue-400 mb-1">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Portal do Organizador</h1>
          <p className="text-slate-400 text-xs">Acesso exclusivo por empresa e técnico de segurança</p>
        </div>

        {/* Card Informativo com Credenciais de Demonstração */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest flex items-center gap-1">
              <KeyRound size={12} /> Acesso de Teste / Demo
            </span>
            <button
              type="button"
              onClick={handleQuickDemo}
              className="text-[11px] text-blue-300 hover:text-white font-bold bg-blue-600/30 hover:bg-blue-600/50 px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1 border border-blue-400/20 min-h-[32px]"
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
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-2xl text-center animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {isRegisterMode && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Seu Nome Completo</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 text-slate-500" size={18} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    required
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-10 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nome da Empresa / Fazenda</label>
                <div className="relative flex items-center">
                  <Building2 className="absolute left-3.5 text-slate-500" size={18} />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Fazenda Santa Maria Agro"
                    required
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-10 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">E-mail Corporativo</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 text-slate-500" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@dds.com.br"
                required
                className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-10 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                required
                className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-10 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-600/30 min-h-[48px]"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Validando Acesso...
              </>
            ) : isRegisterMode ? (
              <>
                Criar Conta e Entrar <ArrowRight size={18} />
              </>
            ) : (
              <>
                Entrar no Sistema <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-center text-xs pt-1">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError('');
            }}
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors underline min-h-[36px]"
          >
            {isRegisterMode ? 'Já tem uma conta? Fazer Login' : 'Criar nova empresa / técnico'}
          </button>
        </div>

        <div className="pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500" />
            Ecossistema Privado e Conexão Criptografada (LGPD)
          </p>
        </div>

      </div>
    </main>
  );
}