'use client';

import React, { useState } from 'react';
import { 
  Lock, Mail, ArrowRight, CheckCircle2, 
  KeyRound, Sparkles, Building2, User, ArrowLeft, Loader2, ExternalLink 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DdsLogo from '@/components/DdsLogo';
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
          action: isRegisterMode ? 'register' : 'login',
          email: email.trim().toLowerCase(),
          password: password.trim(),
          name: isRegisterMode ? name.trim() : undefined,
          company: isRegisterMode ? companyName.trim() : undefined
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
    } catch {
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/15 blur-[130px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Topo com Botão Voltar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Link 
            href="/"
            className="text-xs text-slate-400 hover:text-white font-bold flex items-center gap-1.5 transition-colors p-1"
          >
            <ArrowLeft size={16} /> Voltar ao Início
          </Link>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            Acesso Seguro
          </span>
        </div>

        {/* Logo DDS ON */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <DdsLogo size="lg" showSubtitle={true} />
          </div>
          <p className="text-slate-400 text-xs">Portal do Técnico de Segurança e Gestor</p>
        </div>

        {/* Card Informativo com Credenciais de Demonstração */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <KeyRound size={12} /> Acesso de Teste / Demo
            </span>
            <button
              type="button"
              onClick={handleQuickDemo}
              className="text-[11px] text-emerald-300 hover:text-white font-bold bg-emerald-600/30 hover:bg-emerald-600/50 px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1 border border-emerald-400/20 min-h-[32px]"
            >
              <Sparkles size={11} /> Preencher
            </button>
          </div>
          <div className="text-xs text-slate-300 space-y-0.5 font-mono">
            <p><strong>E-mail:</strong> <code className="text-emerald-300">admin@dds.com.br</code></p>
            <p><strong>Senha:</strong> <code className="text-emerald-300">123456</code></p>
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
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-10 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-10 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-10 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-10 py-3.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-slate-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-950/60 min-h-[48px]"
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
                Entrar no Painel DDS ON <ArrowRight size={18} />
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
            className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors underline min-h-[36px]"
          >
            {isRegisterMode ? 'Já tem uma conta? Fazer Login' : 'Cadastrar novo técnico / organizador'}
          </button>
        </div>

        {/* Rodapé Oficial DDS ON */}
        <footer className="pt-4 border-t border-slate-800/80 text-center space-y-1">
          <p className="text-[10px] text-slate-400">
            © {new Date().getFullYear()} <strong>DDS ON</strong> • Todos os direitos reservados.
          </p>
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
            <span>Desenvolvido e Auditado por</span>
            <a 
              href="https://amtst.vercel.app" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-0.5 transition-colors underline underline-offset-2"
            >
              AM TST <ExternalLink size={9} />
            </a>
          </div>
        </footer>

      </div>
    </main>
  );
}