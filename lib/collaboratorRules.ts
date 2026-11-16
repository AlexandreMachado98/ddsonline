// lib/collaboratorRules.ts
// Regras puras do cadastro de colaboradores (testadas em tests/collaboratorRules.test.cjs).

export const REGISTRATION_PATTERN = /^\d{4}$/;

const LOWER_PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du']);

/**
 * Padroniza o nome: espaços simples e iniciais maiúsculas, com partículas em
 * minúsculo. "ALEXANDRE  ANTONIO DA silva" → "Alexandre Antonio da Silva".
 */
export function normalizePersonName(value: string): string {
  const words = String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR').split(' ').filter(Boolean);
  return words.map((word, i) => {
    if (i > 0 && LOWER_PARTICLES.has(word)) return word;
    // Nomes compostos com hífen ou apóstrofo: "maria-clara" → "Maria-Clara", "d'avila" → "D'Avila"
    return word.replace(/(^|[-'’])(\p{L})/gu, (_m, sep, ch) => sep + ch.toLocaleUpperCase('pt-BR'));
  }).join(' ').slice(0, 100);
}

/** Função/cargo: espaços simples e primeira letra maiúscula, mantendo o restante como digitado. */
export function normalizeRole(value: string): string {
  const role = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return role ? role.charAt(0).toLocaleUpperCase('pt-BR') + role.slice(1) : '';
}

export function validateCollaborator(input: { registration: string; name: string; role: string }): string | null {
  if (!REGISTRATION_PATTERN.test(String(input.registration || '').trim())) return 'A matrícula precisa ter exatamente 4 números.';
  if (normalizePersonName(input.name).split(' ').length < 2) return 'Informe nome e sobrenome.';
  if (!normalizeRole(input.role)) return 'Informe a função.';
  return null;
}

export interface PastedCollaborator { registration: string; name: string; role: string; line: number }

/**
 * Lê linhas coladas do Excel (colunas separadas por tabulação) ou de CSV (; ou ,):
 * Matrícula, Nome, Função. Ignora linha de cabeçalho. Matrícula com menos de 4
 * dígitos ganha zeros à esquerda (o Excel costuma apagá-los: 42 → 0042).
 */
export function parseCollaboratorPaste(text: string): { rows: PastedCollaborator[]; invalid: { line: number; content: string; reason: string }[] } {
  const rows: PastedCollaborator[] = [];
  const invalid: { line: number; content: string; reason: string }[] = [];
  const seen = new Map<string, number>();
  String(text || '').split(/\r?\n/).forEach((raw, idx) => {
    const line = idx + 1;
    if (!raw.trim()) return;
    const sep = raw.includes('\t') ? '\t' : raw.includes(';') ? ';' : ',';
    const cols = raw.split(sep).map(c => c.trim().replace(/^"|"$/g, '').trim());
    if (idx === 0 && /matr[ií]cula/i.test(cols[0] || '')) return; // cabeçalho
    const regDigits = (cols[0] || '').replace(/\D/g, '');
    const registration = regDigits.length > 0 && regDigits.length <= 4 ? regDigits.padStart(4, '0') : regDigits;
    const candidate = { registration, name: cols[1] || '', role: cols[2] || '' };
    const error = validateCollaborator(candidate);
    if (error) { invalid.push({ line, content: raw.slice(0, 120), reason: error }); return; }
    const entry = { registration, name: normalizePersonName(candidate.name), role: normalizeRole(candidate.role), line };
    // Matrícula repetida na própria lista: vale a última linha.
    if (seen.has(registration)) rows[seen.get(registration)!] = entry;
    else { seen.set(registration, rows.length); rows.push(entry); }
  });
  return { rows, invalid };
}
