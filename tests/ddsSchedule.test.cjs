// tests/ddsSchedule.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('lib/ddsSchedule.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
});
const moduleObj = { exports: {} };
vm.runInNewContext(compiled.outputText, { require, console, exports: moduleObj.exports, module: moduleObj, Date }, { filename: 'ddsSchedule.js' });
const {
  buildThemeWindows, validateDurations, getThemeState, isAvailable,
  pickVisibleWeekIndex, overlapsAnyWeek, normalizeSlug, isValidSlug, buildWeekSummary
} = moduleObj.exports;

const H = 3600 * 1000;
// Segunda 16/11/2026 06:00 em Brasília (UTC-3) = 09:00 UTC
const START = new Date('2026-11-16T09:00:00.000Z');
const at = hours => new Date(START.getTime() + hours * H);

console.log('--- Testes do DDS Semanal ---');

// 1. Encadeamento: cada tema abre quando o anterior encerra
const windows = buildThemeWindows(START, [24, 24, 48, 24, 24, 24, 36]);
assert.equal(windows.length, 7);
assert.equal(windows[0].opensAt.toISOString(), '2026-11-16T09:00:00.000Z');
assert.equal(windows[0].closesAt.toISOString(), '2026-11-17T09:00:00.000Z');
for (let i = 1; i < 7; i++) assert.equal(windows[i].opensAt.getTime(), windows[i - 1].closesAt.getTime());
assert.equal(windows[3].opensAt.toISOString(), '2026-11-20T09:00:00.000Z', 'tema de 48 h empurra os seguintes');
assert.equal(windows[6].closesAt.toISOString(), '2026-11-24T21:00:00.000Z');
console.log('✓ 1. Temas encadeados, durações maiores empurram os seguintes.');

// 2. Validação das durações
assert.equal(validateDurations([24, 24, 24, 24, 24, 24, 24]), null);
assert.match(validateDurations([24, 24, 24]), /exatamente 7/);
assert.match(validateDurations([23, 24, 24, 24, 24, 24, 24]), /tema 1/);
assert.match(validateDurations([24, 24, 24, 24, 24, 24, 169]), /tema 7/);
assert.match(validateDurations([24, 24, 24.5, 24, 24, 24, 24]), /tema 3/);
console.log('✓ 2. Duração mínima de 24 h, máxima de 168 h e sempre 7 temas.');

// 3. Situação ao longo do tempo
const theme = { opensAt: at(24), closesAt: at(48), reopenUntil: null };
assert.equal(getThemeState(theme, at(23.99)).state, 'LOCKED');
assert.equal(getThemeState(theme, at(24)).state, 'OPEN', 'abre exatamente no horário');
assert.equal(getThemeState(theme, at(24)).availableUntil.getTime(), at(48).getTime());
assert.equal(getThemeState(theme, at(47.99)).state, 'OPEN');
assert.equal(getThemeState(theme, at(48)).state, 'CLOSED', 'encerra exatamente no horário');
assert.equal(getThemeState(theme, at(48)).availableUntil, null);
console.log('✓ 3. Bloqueado → Aberto → Encerrado nos horários exatos.');

// 4. Reabertura
const reopened = { ...theme, reopenUntil: at(60) };
assert.equal(getThemeState(reopened, at(50)).state, 'REOPENED');
assert.equal(getThemeState(reopened, at(50)).availableUntil.getTime(), at(60).getTime());
assert.equal(getThemeState(reopened, at(60)).state, 'CLOSED', 'reabertura também encerra sozinha');
assert.equal(isAvailable('REOPENED'), true);
assert.equal(isAvailable('LOCKED'), false);
// Reabertura antiga (antes do encerramento) não altera o prazo normal
assert.equal(getThemeState({ ...theme, reopenUntil: at(30) }, at(40)).availableUntil.getTime(), at(48).getTime());
console.log('✓ 4. Reabertura aceita assinaturas até o novo prazo e encerra sozinha.');

// 5. Fuso horário: 06:00 em Brasília não vira 03:00
const w = buildThemeWindows(new Date('2026-11-16T06:00:00-03:00'), [24]);
assert.equal(w[0].opensAt.toISOString(), '2026-11-16T09:00:00.000Z');
assert.equal(getThemeState({ opensAt: w[0].opensAt, closesAt: w[0].closesAt }, new Date('2026-11-17T05:59:00-03:00')).state, 'OPEN');
assert.equal(getThemeState({ opensAt: w[0].opensAt, closesAt: w[0].closesAt }, new Date('2026-11-17T06:00:00-03:00')).state, 'CLOSED');
console.log('✓ 5. Horários de Brasília preservados (servidor em UTC).');

// 6. Semana exibida no link fixo
const weeks = [
  { startsAt: at(0), endsAt: at(168) },
  { startsAt: at(168), endsAt: at(336) }
];
assert.equal(pickVisibleWeekIndex(weeks, at(10)), 0, 'semana em andamento');
assert.equal(pickVisibleWeekIndex(weeks, at(200)), 1);
assert.equal(pickVisibleWeekIndex(weeks, at(-10)), 0, 'antes de tudo: próxima semana');
assert.equal(pickVisibleWeekIndex(weeks, at(400)), 1, 'depois de tudo: a última encerrada');
assert.equal(pickVisibleWeekIndex([], at(0)), -1);
console.log('✓ 6. Link fixo mostra a semana atual, a próxima ou a última.');

// 7. Sobreposição de semanas
assert.equal(overlapsAnyWeek(at(168), at(336), [weeks[0]]), false, 'encostada não sobrepõe');
assert.equal(overlapsAnyWeek(at(100), at(268), [weeks[0]]), true);
assert.equal(overlapsAnyWeek(at(100), at(268), [{ id: 'a', ...weeks[0] }], 'a'), false, 'ignora a própria semana');
console.log('✓ 7. Semanas não podem se sobrepor.');

// 8. Link fixo
assert.equal(normalizeSlug('Equipe de Campo – Vistec Ção'), 'equipe-de-campo-vistec-cao');
assert.equal(normalizeSlug('  --Olá!!  '), 'ola');
assert.equal(isValidSlug('vistec-campo'), true);
assert.equal(isValidSlug('ab'), false);
assert.equal(isValidSlug('Vistec'), false);
assert.equal(isValidSlug('-abc'), false);
assert.equal(isValidSlug('a--b'), false);
console.log('✓ 8. Link fixo normalizado e validado.');

// 9. Resumo da semana
const states = ['CLOSED', 'CLOSED', 'OPEN', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED'];
const summary = buildWeekSummary(states.map((state, order) => ({
  order, state,
  attendees: order === 0 ? [{ registration: '1234', name: 'Ana' }, { registration: '2222', name: 'Bruno' }]
    : order === 1 ? [{ registration: '1234', name: 'Ana Souza' }]
    : order === 2 ? [{ registration: null, name: 'Carla' }] : [],
  attempts: order === 0 ? [{ registration: '1234', name: 'Ana', score: 60 }, { registration: '1234', name: 'Ana', score: 90 }, { registration: '9999', name: 'Sem assinatura', score: 100 }] : []
})));
const byReg = Object.fromEntries(summary.rows.map(r => [r.registration || r.name, r]));
assert.equal(summary.rows.length, 3, 'quem só respondeu sem assinar não entra');
assert.equal(byReg['1234'].name, 'Ana Souza', 'usa o nome mais recente');
assert.equal(byReg['1234'].cells[0].score, 90, 'melhor nota do tema');
assert.equal(byReg['1234'].signedCount, 2);
assert.equal(byReg['1234'].missedCount, 1, 'faltou só no tema aberto; bloqueados não contam');
assert.equal(byReg['2222'].missedCount, 2);
assert.equal(byReg['Carla'].missedCount, 2, 'sem matrícula usa o nome');
assert.equal(summary.rows[0].missedCount, 2, 'quem mais faltou aparece primeiro');
assert.equal(JSON.stringify(summary.signedPerTheme), '[2,1,1,0,0,0,0]');
console.log('✓ 9. Resumo da semana por matrícula, com faltas e melhor nota.');

console.log('--- Todos os testes do DDS Semanal passaram ---');
