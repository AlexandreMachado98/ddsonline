 'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, User, Building, Briefcase, ExternalLink, Eye, EyeOff, CheckCircle2, Clock, Loader2, KeyRound, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isRegisteredSuccess, setIsRegisteredSuccess] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Técnico em Segurança do Trabalho');
  const [company, setCompany] = useState('');
  const [secretKey, setSecretKey] = useState(''); // Novo estado para a Palavra-Chave
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

    if (!isRegisterMode && cleanEmail === 'admin@dds.com.br' && cleanPassword === '123456') {
      const adminUser = {
        id: 'admin-master-01',
        name: 'Alexandre Machado',
        email: 'admin@dds.com.br',
        role: 'SUPER_ADMIN',
        company: 'AM TST',
        status: 'ACTIVE'
      };
      localStorage.setItem('dds_admin_auth', JSON.stringify(adminUser));
      window.location.replace('/admin');
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
          secretKey // Envia a palavra chave para o back-end
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (isRegisterMode) {
          // Se a conta for aprovada instantaneamente por causa da Palavra-Chave, entra direto!
          if (!data.pendingApproval && data.user) {
            localStorage.setItem('dds_admin_auth', JSON.stringify(data.user));
            window.location.replace('/admin');
          } else {
            // Se não tinha chave ou ela não aprova automático, vai pro Lobby
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
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in">
          <div className="p-4 bg-green-500/10 text-green-400 rounded-2xl inline-flex border border-green-500/20">
            <CheckCircle2 size={42} />
          </div>
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block">
              Aguardando Aprovação
            </span>
            <h1 className="text-2xl font-black text-white">Cadastro Enviado!</h1>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Obrigado, <strong>{name}</strong>. Como nenhuma Palavra-Chave foi informada, seus dados estão na fila de liberação da <strong>AM TST</strong>.
          </p>
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400 text-left space-y-1.5">
            <p className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-400" /> Próximo passo:
            </p>
            <p className="text-[11px] leading-relaxed">
              Assim que o DDS MASTER aprovar a sua conta, basta voltar nesta tela e fazer login com seu e-mail e senha.
            </p>
          </div>
          <button
            onClick={() => {
              setIsRegisteredSuccess(false);
              setIsRegisterMode(false);
              setName(''); setEmail(''); setPassword(''); setError(''); setSecretKey('');
            }}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all border border-slate-700"
          >
            Voltar para a Tela de Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-600/15 blur-[140px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 backdrop-blur-md">
        
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-bold tracking-wide mb-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            Plataforma Digital de SST
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span>
          </h1>
          <p className="text-xs text-slate-300 font-medium max-w-xs mx-auto leading-relaxed">
            {isRegisterMode 
              ? 'Insira a Palavra-Chave da sua empresa para acesso instantâneo.' 
              : 'A nova forma de realizar, auditar e transmitir o Diálogo Diário de Segurança.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3.5 rounded-xl text-center font-medium leading-relaxed">
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
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite seu nome completo" className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Cargo / Função</label>
                <div className="relative flex items-center">
                  <Briefcase className="absolute left-3.5 text-slate-500" size={17} />
                  <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: Técnico de Segurança" className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Empresa / Fazenda Principal</label>
                <div className="relative flex items-center">
                  <Building className="absolute left-3.5 text-slate-500" size={17} />
                  <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ex: Fazenda Ouro Verde" className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                </div>
              </div>

              <div className="bg-green-500/10 p-3 rounded-2xl border border-green-500/20">
                <label className="block text-xs font-bold text-green-400 mb-1 flex items-center gap-1.5">
                  <KeyRound size={13} /> Palavra-Chave da Empresa (Opcional)
                </label>
                <p className="text-[10px] text-slate-400 mb-2">Digite o código da sua empresa para aprovação imediata.</p>
                <input type="text" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="Ex: AGRO2026" className="w-full bg-slate-950/80 border border-green-500/30 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all uppercase font-mono" />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Corporativo</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 text-slate-500" size={17} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Digite seu e-mail" className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Senha de Acesso</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 text-slate-500" size={17} />
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 text-slate-500 hover:text-slate-300 transition-colors p-1" title={showPassword ? "Ocultar senha" : "Ver senha"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/25 mt-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : <>{isRegisterMode ? 'Cadastrar Minha Conta' : 'Acessar o Painel'} <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="pt-1 text-center">
          <button type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setError(''); }} className="text-xs text-green-400 hover:text-green-300 font-semibold transition-colors">
            {isRegisterMode ? 'Já possui conta? Fazer login' : 'Primeiro acesso? Cadastre-se como organizador'}
          </button>
        </div>

        <footer className="pt-5 border-t border-slate-800/80 text-center space-y-1.5">
          <p className="text-[11px] text-slate-400 font-normal">
            © {new Date().getFullYear()} <strong>DDS ON</strong> • Todos os direitos reservados.
          </p>
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
            <span>Desenvolvido e Auditado por</span>
            <a href="https://amtst.vercel.app" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 font-bold inline-flex items-center gap-1 transition-colors underline underline-offset-2">
              AM TST <ExternalLink size={10} />
            </a>
          </div>
        </footer>

      </div>
    </main>
  );
}