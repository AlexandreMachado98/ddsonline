// tests/collaboratorRules.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('lib/collaboratorRules.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const moduleObj = { exports: {} };
vm.runInNewContext(compiled.outputText, { require, console, exports: moduleObj.exports, module: moduleObj }, { filename: 'collaboratorRules.js' });
const { normalizePersonName, normalizeRole, validateCollaborator, parseCollaboratorPaste } = moduleObj.exports;

console.log('--- Testes do cadastro de colaboradores ---');

assert.equal(normalizePersonName('ALEXANDRE  ANTONIO ADAO MACHADO'), 'Alexandre Antonio Adao Machado');
assert.equal(normalizePersonName('  roBERTTI costa DOS santos '), 'Robertti Costa dos Santos');
assert.equal(normalizePersonName('hélio cezário de magalhães'), 'Hélio Cezário de Magalhães');
assert.equal(normalizePersonName('maria-clara d\'avila'), "Maria-Clara D'Avila");
assert.equal(normalizePersonName('De Souza Ana'), 'De Souza Ana', 'partícula no início continua maiúscula');
console.log('✓ 1. Nomes padronizados (maiúsculas, espaços, partículas, acentos).');

assert.equal(normalizeRole('  operador   de máquina '), 'Operador de máquina');
assert.equal(normalizeRole(''), '');
console.log('✓ 2. Função padronizada.');

assert.equal(validateCollaborator({ registration: '0042', name: 'Ana Souza', role: 'Tratorista' }), null);
assert.match(validateCollaborator({ registration: '42', name: 'Ana Souza', role: 'Tratorista' }), /4 números/);
assert.match(validateCollaborator({ registration: '1234', name: 'Ana', role: 'Tratorista' }), /sobrenome/);
assert.match(validateCollaborator({ registration: '1234', name: 'Ana Souza', role: ' ' }), /função/);
console.log('✓ 3. Validação de matrícula, nome completo e função.');

const pasted = parseCollaboratorPaste([
  'Matrícula\tNome\tFunção',
  '7188\tDANIELA MENDES\tOperadora',
  '42\tjoão da silva\tTratorista',
  '',
  '7191;Robertti Costa;Mecânico',
  'abc\tSem Matricula\tAuxiliar',
  '7188\tDaniela Mendes Prado\tOperadora de colheita',
  '7300\tSó\tAuxiliar'
].join('\n'));
assert.equal(pasted.rows.length, 3, 'cabeçalho e linhas inválidas fora; repetida conta uma vez');
const byReg = Object.fromEntries(pasted.rows.map(r => [r.registration, r]));
assert.equal(byReg['0042'].name, 'João da Silva', 'zeros à esquerda que o Excel apaga');
assert.equal(byReg['7191'].role, 'Mecânico', 'aceita ; como separador');
assert.equal(byReg['7188'].name, 'Daniela Mendes Prado', 'matrícula repetida: vale a última linha');
assert.equal(pasted.invalid.length, 2);
assert.equal(pasted.invalid[0].line, 6);
assert.match(pasted.invalid[1].reason, /sobrenome/);
console.log('✓ 4. Lista colada do Excel: cabeçalho, zeros à esquerda, separadores, repetidas e linhas inválidas.');

console.log('--- Todos os testes do cadastro de colaboradores passaram ---');
