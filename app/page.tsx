'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, User, Building, Briefcase, ExternalLink, Eye, EyeOff, CheckCircle2, Clock, Loader2, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';

export default function HomePage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isRegisteredSuccess, setIsRegisteredSuccess] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Técnico em Segurança do Trabalho');
  const [company, setCompany] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const auth = localStorage.getItem('dds_admin_auth');
      if (auth) {
        const user = JSON.parse(auth);
        if (user && user.id) {
          window.location.replace('/admin');
        }
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Preencha seu e-mail corporativo e senha.');
      setLoading(false);
      return;
    }

    if (isRegisterMode && !name.trim()) {
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
          email: cleanEmail,
          password: cleanPassword,
          name,
          role,
          company,
          secretKey
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (isRegisterMode) {
          if (!data.pendingApproval && data.user) {
            localStorage.setItem('dds_admin_auth', JSON.stringify(data.user));
            window.location.replace('/admin');
          } else {
            setIsRegisteredSuccess(true);
          }
        } else {
          localStorage.setItem('dds_admin_auth', JSON.stringify(data.user));
          window.location.replace('/admin');
        }
      } else {
        setError(data.error || 'Falha ao processar solicitação.');
      }
    } catch (err: any) {
      setError('Erro de conexão com o servidor: ' + (err?.message || 'Verifique a rede'));
    } finally {
      setLoading(false);
    }
  };

  // TELA DE CADASTRO PENDENTE
  if (isRegisteredSuccess) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center animate-in fade-in zoom-in">
          <div className="p-3.5 bg-emerald-500/15 text-emerald-400 rounded-2xl inline-flex border border-emerald-500/30 shadow-lg shadow-emerald-950/40">
            <CheckCircle2 size={38} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block">
              Aguardando Aprovação
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white">Cadastro Enviado!</h1>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Obrigado, <strong>{name}</strong>. Como nenhuma Palavra-Chave foi informada, seus dados estão na fila de liberação da <strong>AM TST</strong>.
          </p>
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400 text-left space-y-1.5">
            <p className="font-bold text-slate-200 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-400" /> Próximo passo:
            </p>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Assim que o DDS MASTER aprovar sua conta, basta fazer login com seu e-mail e senha.
            </p>
          </div>
          <button
            onClick={() => {
              setIsRegisteredSuccess(false);
              setIsRegisterMode(false);
              setName(''); setEmail(''); setPassword(''); setError(''); setSecretKey('');
            }}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all border border-slate-700 cursor-pointer"
          >
            Voltar para a Tela de Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-3.5 sm:p-6 font-sans relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-emerald-600/15 blur-[130px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-5 backdrop-blur-md">
        
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[11px] font-bold tracking-wide mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Plataforma Digital de SST & NR
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">ON</span>
          </h1>
          <p className="text-xs text-slate-300 font-medium max-w-xs mx-auto leading-relaxed">
            {isRegisterMode 
              ? 'Insira a Palavra-Chave da sua empresa para acesso instantâneo.' 
              : 'Diálogo Diário de Segurança com Biometria Facial e Videoconferência.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegisterMode && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Nome Completo</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 text-slate-500" size={16} />
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite seu nome completo" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-10 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Cargo / Função</label>
                <div className="relative flex items-center">
                  <Briefcase className="absolute left-3.5 text-slate-500" size={16} />
                  <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: Técnico de Segurança" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-10 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Empresa / Unidade</label>
                <div className="relative flex items-center">
                  <Building className="absolute left-3.5 text-slate-500" size={16} />
                  <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ex: Fazenda Ouro Verde" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-10 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 outline-none transition-all" />
                </div>
              </div>

              <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
                <label className="block text-[11px] font-bold text-emerald-400 mb-0.5 flex items-center gap-1.5">
                  <KeyRound size={12} /> Palavra-Chave da Empresa (Opcional)
                </label>
                <p className="text-[10px] text-slate-400 mb-1.5">Digite o código da sua empresa para aprovação imediata.</p>
                <input type="text" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="Código da Empresa" className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 outline-none uppercase font-mono" />
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">E-mail Corporativo</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 text-slate-500" size={16} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Digite seu e-mail" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-10 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 outline-none transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Senha de Acesso</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 text-slate-500" size={16} />
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-11 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 outline-none transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 text-slate-500 hover:text-slate-300 p-1 cursor-pointer" title={showPassword ? "Ocultar senha" : "Ver senha"}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-950/60 active:scale-[0.98] mt-1 cursor-pointer">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : <>{isRegisterMode ? 'Cadastrar Minha Conta' : 'Acessar o Painel TST'} <ArrowRight size={15} /></>}
          </button>
        </form>

        <div className="pt-1 text-center">
          <button type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setError(''); }} className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer">
            {isRegisterMode ? 'Já possui conta? Fazer login' : 'Primeiro acesso? Cadastre-se como organizador'}
          </button>
        </div>

        <footer className="pt-4 border-t border-slate-800/80 text-center space-y-1">
          <p className="text-[10px] text-slate-400">
            © {new Date().getFullYear()} <strong>DDS ON</strong> • Todos os direitos reservados.
          </p>
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
            <span>Desenvolvido e Auditado por</span>
            <a href="https://amtst.vercel.app" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-0.5 transition-colors underline underline-offset-2">
              AM TST <ExternalLink size={9} />
            </a>
          </div>
        </footer>

      </div>
    </main>
  );
}