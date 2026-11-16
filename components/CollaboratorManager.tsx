'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardPaste, Download, Info, Loader2, Pencil, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react';

type Collaborator = { id: string; registration: string; name: string; role: string; updatedAt: string };
type ImportResult = { added: number; updated: number; unchanged: number; invalid: { line: number; content: string; reason: string }[] };

const API = '/api/colaboradores';
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500';

async function callApi(method: string, body?: unknown) {
  const res = await fetch(API, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

export default function CollaboratorManager() {
  const [list, setList] = useState<Collaborator[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [allowUnregistered, setAllowUnregistered] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ registration: '', name: '', role: '' });
  const [editing, setEditing] = useState<Collaborator | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

  const load = useCallback(async () => {
    try {
      const d = await callApi('GET');
      setList(d.collaborators || []); setCompanyName(d.companyName); setAllowUnregistered(d.settings?.allowUnregistered ?? true);
      setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setError('');
    try { await fn(); await load(); if (ok) flash(ok); return true; }
    catch (e: any) { setError(e.message); return false; }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR');
    if (!q) return list;
    return list.filter(c => c.registration.includes(q) || c.name.toLocaleLowerCase('pt-BR').includes(q) || c.role.toLocaleLowerCase('pt-BR').includes(q));
  }, [list, search]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(() => callApi('POST', { action: 'create', ...form }), 'Colaborador cadastrado.')) setForm({ registration: '', name: '', role: '' });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (await run(() => callApi('PATCH', { action: 'update', ...editing }), 'Dados atualizados. Valem para as próximas assinaturas.')) setEditing(null);
  };

  const importPaste = async () => {
    setBusy(true); setError(''); setImportResult(null);
    try {
      const d = await callApi('POST', { action: 'import', text: pasteText });
      setImportResult(d);
      await load();
      if (!d.invalid?.length) { setShowPaste(false); setPasteText(''); }
      flash(`${d.added} incluído(s), ${d.updated} atualizado(s), ${d.unchanged} sem mudança.`);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const toggleAllow = () => run(() => callApi('PATCH', { action: 'settings', allowUnregistered: !allowUnregistered }),
    !allowUnregistered ? 'Matrículas não cadastradas voltam a ser aceitas.' : 'A partir de agora, só assina quem está no cadastro.');

  const downloadCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    // Matrícula como texto para o Excel não apagar zeros à esquerda.
    const csv = '﻿' + [['Matrícula', 'Nome', 'Função'], ...list.map(c => [`="${c.registration}"`, c.name, c.role])]
      .map((r, i) => r.map(v => (i > 0 && v.startsWith('="')) ? v : esc(v)).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'colaboradores-dds-on.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 flex items-start gap-2">
        <Info size={17} className="text-emerald-600 shrink-0 mt-0.5"/>
        <p className="text-sm text-slate-600"><b className="text-slate-800">Na assinatura, o colaborador digita só a matrícula</b> e o nome e a função cadastrados aqui aparecem prontos. Editar ou excluir alguém só vale para as próximas assinaturas: <b className="text-slate-800">listas já fechadas não mudam</b>.</p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-lg inline-flex items-center gap-2"><Users size={18} className="text-emerald-600"/> Colaboradores{companyName ? ` · ${companyName}` : ''}</h3>
            <p className="text-sm text-slate-500">{list.length} colaborador(es) cadastrado(s)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Buscar colaborador" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nome, matrícula ou função" className={`${inputCls} w-64`}/>
            <button type="button" onClick={() => { setShowPaste(v => !v); setImportResult(null); }} className={`rounded-lg border px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 ${showPaste ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'}`}><ClipboardPaste size={14}/> Colar da planilha</button>
            <button type="button" onClick={downloadCsv} disabled={!list.length} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 disabled:opacity-50"><Download size={14}/> Baixar lista</button>
            <button type="button" onClick={() => { setLoading(true); load(); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"><RefreshCw size={14}/> Atualizar</button>
          </div>
        </div>

        {showPaste && (
          <div className="m-4 sm:m-5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4 space-y-3">
            <p className="text-sm text-slate-700"><b>Copie no Excel as colunas Matrícula, Nome e Função</b> (uma pessoa por linha) e cole abaixo. Matrículas que já existem são atualizadas. Se o Excel tiver apagado os zeros à esquerda (42 em vez de 0042), o sistema completa.</p>
            <textarea id="paste-collaborators" value={pasteText} onChange={e => setPasteText(e.target.value)} rows={7} placeholder={'7188\tDaniela Mendes\tOperadora de colheita\n7191\tRobertti Costa dos Santos\tTratorista'} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"/>
            {importResult && importResult.invalid.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                <p className="font-bold">{importResult.invalid.length} linha(s) não foram importadas. Corrija e cole de novo só essas:</p>
                <ul className="list-disc pl-5 space-y-0.5 max-h-40 overflow-y-auto">
                  {importResult.invalid.map(i => <li key={i.line}>Linha {i.line}: {i.reason} <span className="font-mono text-amber-700">({i.content})</span></li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setShowPaste(false); setImportResult(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">Cancelar</button>
              <button type="button" disabled={busy || !pasteText.trim()} onClick={importPaste} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white inline-flex items-center gap-1.5 disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin"/> : <ClipboardPaste size={13}/>} Importar</button>
            </div>
          </div>
        )}

        <form onSubmit={add} className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end border-b border-slate-100 bg-slate-50/60">
          <label className="sm:col-span-2 text-xs font-bold text-slate-600">Matrícula
            <input id="new-registration" required inputMode="numeric" maxLength={4} value={form.registration} onChange={e => setForm(f => ({ ...f, registration: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="0000" className={`mt-1 ${inputCls} font-mono tracking-widest`}/>
          </label>
          <label className="sm:col-span-5 text-xs font-bold text-slate-600">Nome completo
            <input id="new-name" required maxLength={100} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex.: Ana Paula Souza" className={`mt-1 ${inputCls}`}/>
          </label>
          <label className="sm:col-span-3 text-xs font-bold text-slate-600">Função
            <input id="new-role" required maxLength={80} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Ex.: Tratorista" className={`mt-1 ${inputCls}`}/>
          </label>
          <button disabled={busy} className="sm:col-span-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2.5 text-xs font-extrabold text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-60"><Plus size={14}/> Cadastrar</button>
          <p className="sm:col-span-12 text-[11px] text-slate-500">O nome é padronizado automaticamente (ex.: &quot;JOÃO DA SILVA&quot; vira &quot;João da Silva&quot;).</p>
        </form>

        {loading ? <div className="py-12 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/>Carregando...</div> :
          list.length === 0 ? (
            <div className="p-8 text-center">
              <Users size={32} className="mx-auto text-slate-300"/>
              <p className="mt-2 font-bold text-slate-800">Nenhum colaborador cadastrado</p>
              <p className="text-sm text-slate-500">Cadastre um por vez acima ou use &quot;Colar da planilha&quot; para incluir todos de uma vez.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="py-2 px-4">Matrícula</th><th className="py-2 px-4">Nome</th><th className="py-2 px-4">Função</th><th className="py-2 px-4"></th>
                </tr></thead>
                <tbody>
                  {filtered.map(c => editing?.id === c.id ? (
                    <tr key={c.id} className="bg-amber-50 border-b border-amber-100">
                      <td className="py-2 px-4 w-28"><input aria-label="Matrícula" inputMode="numeric" maxLength={4} value={editing.registration} onChange={e => setEditing({ ...editing, registration: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={`${inputCls} font-mono`}/></td>
                      <td className="py-2 px-4"><input aria-label="Nome" maxLength={100} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className={inputCls} autoFocus/></td>
                      <td className="py-2 px-4"><input aria-label="Função" maxLength={80} value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} className={inputCls}/></td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 mr-1.5" title="Cancelar"><X size={14}/></button>
                        <button type="button" disabled={busy} onClick={saveEdit} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white inline-flex items-center gap-1"><Check size={13}/> Salvar</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-700">{c.registration}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{c.name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{c.role}</td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {confirmId === c.id ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600">Excluir {c.name.split(' ')[0]}?
                            <button type="button" onClick={() => setConfirmId(null)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600">Não</button>
                            <button type="button" disabled={busy} onClick={async () => { if (await run(() => callApi('DELETE', { id: c.id }), `${c.name} excluído(a). As listas já fechadas não mudam.`)) setConfirmId(null); }} className="rounded-lg bg-red-600 px-2 py-1 text-white">Sim, excluir</button>
                          </span>
                        ) : (
                          <>
                            <button type="button" onClick={() => { setEditing({ ...c }); setConfirmId(null); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 inline-flex items-center gap-1 mr-1.5"><Pencil size={12}/> Editar</button>
                            <button type="button" onClick={() => { setConfirmId(c.id); setEditing(null); }} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 inline-flex items-center gap-1"><Trash2 size={12}/> Excluir</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={4} className="py-6 px-4 text-sm text-slate-500">Nenhum colaborador encontrado para &quot;{search}&quot;.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-start gap-3">
          <button type="button" role="switch" aria-checked={allowUnregistered} aria-label="Aceitar matrícula não cadastrada" disabled={busy} onClick={toggleAllow}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${allowUnregistered ? 'bg-emerald-600' : 'bg-slate-300'}`}>
            <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${allowUnregistered ? 'translate-x-5' : 'translate-x-0.5'}`}/>
          </button>
          <p className="text-sm text-slate-600"><b className="text-slate-800">Aceitar matrícula não cadastrada</b><br/>
            {allowUnregistered
              ? 'Ligado: quem não está no cadastro pode assinar digitando nome e função. Bom enquanto você monta o cadastro.'
              : 'Desligado: só assina quem está no cadastro. Os demais recebem a orientação de procurar o organizador.'}
          </p>
        </div>
      </section>
    </div>
  );
}
