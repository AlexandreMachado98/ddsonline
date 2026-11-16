'use client';

// Identificação do colaborador nas telas de assinatura e questionário.
// A matrícula vem primeiro: com os 4 números, o nome e a função cadastrados pelo
// organizador aparecem prontos e travados. Sem cadastro (ou sem internet), os
// campos ficam livres; o servidor confere de novo ao gravar.

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, Loader2, UserX } from 'lucide-react';

export type IdentityStatus = 'idle' | 'loading' | 'found' | 'manual' | 'blocked';

interface Props {
  registration: string;
  name: string;
  role: string;
  onRegistrationChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  /** Onde a consulta é feita: DDS em andamento ou questionário publicado. Sem escopo, os campos ficam livres. */
  scope: { meetingId?: string | null; quizToken?: string | null };
  onStatusChange?: (status: IdentityStatus) => void;
  inputClassName?: string;
  labelClassName?: string;
}

const DEFAULT_INPUT = 'w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3 text-base sm:text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all min-h-[48px]';
const DEFAULT_LABEL = 'block text-xs font-semibold text-slate-300 mb-1';

export default function CollaboratorIdentityFields({
  registration, name, role, onRegistrationChange, onNameChange, onRoleChange,
  scope, onStatusChange, inputClassName = DEFAULT_INPUT, labelClassName = DEFAULT_LABEL
}: Props) {
  const [status, setStatus] = useState<IdentityStatus>('idle');
  const [note, setNote] = useState('');
  const filledFromRegistry = useRef(false);
  const lastLookup = useRef('');

  const update = (next: IdentityStatus) => { setStatus(next); onStatusChange?.(next); };

  const scopeKey = scope.meetingId || scope.quizToken || '';
  useEffect(() => {
    if (!/^\d{4}$/.test(registration)) {
      lastLookup.current = '';
      if (filledFromRegistry.current) { onNameChange(''); onRoleChange(''); filledFromRegistry.current = false; }
      update('idle'); setNote('');
      return;
    }
    if (!scopeKey) { update('manual'); setNote(''); return; } // sem DDS identificado: preenchimento livre
    const key = `${scopeKey}:${registration}`;
    if (lastLookup.current === key) return;
    lastLookup.current = key;

    let cancelled = false;
    update('loading');
    const query = new URLSearchParams({ registration });
    if (scope.meetingId) query.set('meetingId', scope.meetingId);
    else if (scope.quizToken) query.set('quizToken', scope.quizToken);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/colaboradores/consulta?${query}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.success) {
          // Sem como consultar (rede, limite, DDS fechado): segue com preenchimento manual.
          if (filledFromRegistry.current) { onNameChange(''); onRoleChange(''); filledFromRegistry.current = false; }
          setNote(data.error || 'Não foi possível consultar o cadastro agora. Preencha seus dados.');
          update('manual');
          return;
        }
        if (data.found) {
          onNameChange(data.name); onRoleChange(data.role);
          filledFromRegistry.current = true; setNote('');
          update('found');
          return;
        }
        if (filledFromRegistry.current) { onNameChange(''); onRoleChange(''); filledFromRegistry.current = false; }
        setNote('');
        update(data.allowUnregistered ? 'manual' : 'blocked');
      } catch {
        if (cancelled) return;
        if (filledFromRegistry.current) { onNameChange(''); onRoleChange(''); filledFromRegistry.current = false; }
        setNote('Sem conexão para consultar o cadastro. Preencha seus dados; eles serão conferidos ao enviar.');
        update('manual');
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); lastLookup.current = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration, scopeKey]);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="identity-registration" className={labelClassName}>Matrícula</label>
        <div className="relative flex items-center">
          <input
            id="identity-registration"
            type="text"
            value={registration}
            onChange={e => onRegistrationChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Digite os 4 números da sua matrícula"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="off"
            enterKeyHint="next"
            aria-describedby="identity-registration-help"
            className={`${inputClassName} tracking-[0.3em] font-mono`}
          />
          {status === 'loading' && <Loader2 size={18} className="absolute right-3.5 text-emerald-400 animate-spin pointer-events-none" />}
          {status === 'found' && <BadgeCheck size={18} className="absolute right-3.5 text-emerald-400 pointer-events-none" />}
        </div>
        <p id="identity-registration-help" className="mt-1 text-[10px] text-slate-500">
          Digite primeiro a matrícula, incluindo zeros à esquerda. Seu nome e sua função aparecem automaticamente.
        </p>
      </div>

      {status === 'found' && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2" aria-live="polite">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300/80">Nome</p>
            <p className="text-base font-black text-white break-words">{name}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300/80">Função</p>
            <p className="text-sm font-bold text-white break-words">{role}</p>
          </div>
          <p className="text-[11px] text-emerald-200/80">Dados cadastrados pelo organizador. Algo errado? Avise o organizador do DDS.</p>
        </div>
      )}

      {status === 'blocked' && (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex gap-2.5 text-sm text-rose-200">
          <UserX size={18} className="shrink-0 mt-0.5 text-rose-300" />
          <p><b className="text-rose-100">Matrícula {registration} não cadastrada.</b> Confira o número. Se estiver certo, procure o organizador do DDS para fazer seu cadastro.</p>
        </div>
      )}

      {status === 'manual' && (
        <>
          {scopeKey && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2.5 text-xs text-amber-100" aria-live="polite">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-300" />
              <p>{note || <><b>Matrícula {registration} não cadastrada.</b> Confira o número. Se estiver certo, preencha seus dados.</>}</p>
            </div>
          )}
          <div>
            <label htmlFor="identity-name" className={labelClassName}>Nome Completo</label>
            <input id="identity-name" type="text" value={name} onChange={e => onNameChange(e.target.value)} placeholder="Ex: João da Silva"
              autoComplete="name" autoCapitalize="words" spellCheck={false} enterKeyHint="next" className={inputClassName} />
          </div>
          <div>
            <label htmlFor="identity-role" className={labelClassName}>Função / Cargo</label>
            <input id="identity-role" type="text" value={role} onChange={e => onRoleChange(e.target.value)} placeholder="Ex: Operador de Máquina"
              autoComplete="organization-title" autoCapitalize="sentences" enterKeyHint="done" className={inputClassName} />
          </div>
        </>
      )}
    </div>
  );
}

/** Mensagem para bloquear o envio enquanto a identificação não está pronta (ou null se pode seguir). */
export function identityBlockMessage(status: IdentityStatus): string | null {
  if (status === 'loading') return 'Aguarde: estamos consultando sua matrícula.';
  if (status === 'blocked') return 'Matrícula não cadastrada. Procure o organizador do DDS para fazer seu cadastro.';
  if (status === 'idle') return 'Digite os 4 números da sua matrícula.';
  return null;
}
