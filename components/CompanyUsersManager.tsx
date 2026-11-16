'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, Loader2, RefreshCw, Shield, ShieldCheck, UserCheck, UserX } from 'lucide-react';

type CompanyUser = { id: string; name: string; email: string; role: string; status: string; position: string | null; createdAt: string };

const API = '/api/usuarios';

async function callApi(method: string, body?: unknown) {
  const res = await fetch(API, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Ativa', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING_APPROVAL: { label: 'Aguardando aprovação', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  SUSPENDED: { label: 'Suspensa', cls: 'bg-red-50 text-red-700 border-red-200' },
  BLOCKED: { label: 'Bloqueada', cls: 'bg-red-50 text-red-700 border-red-200' }
};
const ROLE: Record<string, string> = { COMPANY_ADMIN: 'Administrador', ORGANIZER: 'Organizador', SUPER_ADMIN: 'Suporte da plataforma' };

export default function CompanyUsersManager() {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [me, setMe] = useState('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; action: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await callApi('GET');
      setUsers(d.users); setMe(d.me); setCompanyName(d.companyName); setCanManage(d.canManage); setHasAdmin(d.companyHasAdmin); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (action: string, userId?: string, ok?: string) => {
    setBusy(userId || action); setError(''); setConfirm(null);
    try { await callApi('PATCH', { action, userId }); await load(); if (ok) { setNotice(ok); setTimeout(() => setNotice(''), 4000); } }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  const pending = users.filter(u => u.status === 'PENDING_APPROVAL');

  return (
    <div className="space-y-5">
      {!loading && !hasAdmin && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={22}/>
          <p className="text-sm text-amber-900 flex-1"><b>Sua empresa ainda não tem administrador.</b> O administrador aprova novos cadastros e pode suspender contas. Assuma agora se você é o responsável pelo DDS ON na empresa; o botão some assim que alguém assumir.</p>
          <button type="button" disabled={busy === 'claim_admin'} onClick={() => act('claim_admin', undefined, 'Agora você é administrador da empresa.')} className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-extrabold text-white inline-flex items-center gap-1.5 disabled:opacity-60">{busy === 'claim_admin' ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>} Tornar-me administrador</button>
        </div>
      )}

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

      {canManage && pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 inline-flex items-center gap-2"><Clock3 size={16}/> {pending.length} cadastro(s) aguardando sua aprovação. Aprove só quem você reconhece.</div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-lg">Contas{companyName ? ` · ${companyName}` : ''}</h3>
            <p className="text-sm text-slate-500">{users.filter(u => u.status === 'ACTIVE').length} ativa(s) · {pending.length} aguardando · {users.filter(u => u.status === 'SUSPENDED').length} suspensa(s)</p>
          </div>
          <button type="button" onClick={() => { setLoading(true); load(); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"><RefreshCw size={14}/> Atualizar</button>
        </div>
        {loading ? <div className="py-12 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/>Carregando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="py-2 px-4">Nome</th><th className="py-2 px-4">E-mail</th><th className="py-2 px-4">Papel</th><th className="py-2 px-4">Situação</th><th className="py-2 px-4">Cadastro</th><th className="py-2 px-4"></th>
              </tr></thead>
              <tbody>{users.map(u => {
                const st = STATUS[u.status] || STATUS.ACTIVE;
                const isMe = u.id === me;
                const confirming = confirm?.id === u.id;
                return (
                  <tr key={u.id} className={`border-b border-slate-100 last:border-0 ${u.status === 'PENDING_APPROVAL' ? 'bg-amber-50/50' : ''}`}>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{u.name}{isMe && <span className="ml-1.5 text-[10px] font-bold text-slate-400">(você)</span>}<span className="block text-[11px] font-normal text-slate-500">{u.position}</span></td>
                    <td className="py-2.5 px-4 text-slate-600 break-all">{u.email}</td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">{u.role === 'COMPANY_ADMIN' && <Shield size={13} className="inline mr-1 text-emerald-600"/>}{ROLE[u.role] || u.role}</td>
                    <td className="py-2.5 px-4"><span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase whitespace-nowrap ${st.cls}`}>{st.label}</span></td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {canManage && !isMe && u.role !== 'SUPER_ADMIN' && (confirming ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">Confirmar?
                          <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-slate-200 px-2 py-1">Não</button>
                          <button type="button" onClick={() => act(confirm!.action, u.id, 'Conta atualizada.')} className="rounded-lg bg-slate-900 px-2 py-1 text-white">Sim</button>
                        </span>
                      ) : (
                        <span className="inline-flex flex-wrap justify-end gap-1.5">
                          {u.status === 'PENDING_APPROVAL' && <button type="button" disabled={busy === u.id} onClick={() => act('approve', u.id, `${u.name} aprovado(a).`)} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-extrabold text-white inline-flex items-center gap-1"><UserCheck size={12}/> Aprovar</button>}
                          {u.status === 'ACTIVE' && u.role === 'ORGANIZER' && <button type="button" onClick={() => setConfirm({ id: u.id, action: 'make_admin' })} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700">Tornar administrador</button>}
                          {u.role === 'COMPANY_ADMIN' && <button type="button" onClick={() => setConfirm({ id: u.id, action: 'remove_admin' })} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700">Remover administrador</button>}
                          {u.status === 'SUSPENDED' && <button type="button" disabled={busy === u.id} onClick={() => act('reactivate', u.id, `${u.name} reativado(a).`)} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-700 inline-flex items-center gap-1"><Check size={12}/> Reativar</button>}
                          {(u.status === 'ACTIVE' || u.status === 'PENDING_APPROVAL') && <button type="button" onClick={() => setConfirm({ id: u.id, action: 'suspend' })} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 inline-flex items-center gap-1"><UserX size={12}/> {u.status === 'PENDING_APPROVAL' ? 'Recusar' : 'Suspender'}</button>}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        <p className="px-4 sm:px-5 py-3 border-t border-slate-100 text-[11px] text-slate-500">Conta suspensa perde o acesso na hora. Os registros que ela já fez (DDS, atas, questionários) continuam guardados.</p>
      </section>
    </div>
  );
}
