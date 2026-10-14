// tests/quizRanking.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('lib/quizRanking.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
});

const moduleObj = { exports: {} };
const context = { require, console, process, exports: moduleObj.exports, module: moduleObj };
vm.runInNewContext(compiled.outputText, context, { filename: 'quizRanking.js' });

const { computeQuizRanking, sanitizePublicName } = moduleObj.exports;

console.log('--- Iniciando Testes do Motor de Ranking Inteligente ---');

// 1. Teste: Questionário sem respostas (Estado vazio)
const emptyResult = computeQuizRanking([], 5, { quizTitle: 'NR-35' });
assert.equal(emptyResult.totalParticipants, 0);
assert.equal(emptyResult.ranking.length, 0);
assert.equal(emptyResult.averageScore, 0);
assert.equal(emptyResult.podium.first.length, 0);
console.log('✓ Teste 1: Questionário sem respostas tratado com sucesso.');

// 2. Teste: Ranking com 1 participante
const singleAttempt = [
  {
    id: 'att-1',
    participantName: 'Carlos Silva',
    participantDoc: 'Soldador',
    score: 100,
    earnedPoints: 5,
    possiblePoints: 5,
    passed: true,
    level: 'EXCELLENT',
    submittedAt: '2026-10-14T10:00:00Z',
    answers: [{ correct: true }, { correct: true }, { correct: true }, { correct: true }, { correct: true }]
  }
];
const singleResult = computeQuizRanking(singleAttempt, 5);
assert.equal(singleResult.totalParticipants, 1);
assert.equal(singleResult.ranking[0].position, 1);
assert.equal(singleResult.ranking[0].participantName, 'Carlos Silva');
assert.equal(singleResult.podium.first.length, 1);
assert.equal(singleResult.podium.first[0].participantName, 'Carlos Silva');
assert.equal(singleResult.podium.second.length, 0);
assert.equal(singleResult.approvalRate, 100);
console.log('✓ Teste 2: Ranking com 1 participante validado.');

// 3. Teste: Vários participantes e ordenação estrita por nota
const multipleAttempts = [
  { id: '1', participantName: 'João Silva', score: 100, earnedPoints: 5, possiblePoints: 5, passed: true },
  { id: '2', participantName: 'Maria Souza', score: 80, earnedPoints: 4, possiblePoints: 5, passed: true },
  { id: '3', participantName: 'Ana Oliveira', score: 60, earnedPoints: 3, possiblePoints: 5, passed: false }
];
const multiResult = computeQuizRanking(multipleAttempts, 5);
assert.equal(multiResult.ranking[0].participantName, 'João Silva');
assert.equal(multiResult.ranking[0].position, 1);
assert.equal(multiResult.ranking[1].participantName, 'Maria Souza');
assert.equal(multiResult.ranking[1].position, 2);
assert.equal(multiResult.ranking[2].participantName, 'Ana Oliveira');
assert.equal(multiResult.ranking[2].position, 3);
assert.equal(multiResult.podium.first.length, 1);
assert.equal(multiResult.podium.second.length, 1);
assert.equal(multiResult.podium.third.length, 1);
console.log('✓ Teste 3: Ordenação de múltiplos participantes validada.');

// 4. Teste: Empate na pontuação resolvido pela quantidade de acertos
const tieBreakerByCorrect = [
  { id: '1', participantName: 'Aline', score: 80, earnedPoints: 8, possiblePoints: 10, passed: true },
  { id: '2', participantName: 'Bruno', score: 80, earnedPoints: 4, possiblePoints: 5, passed: true }
];
const tieResult = computeQuizRanking(tieBreakerByCorrect, 10);
assert.equal(tieResult.ranking[0].participantName, 'Aline');
assert.equal(tieResult.ranking[0].position, 1);
assert.equal(tieResult.ranking[1].participantName, 'Bruno');
assert.equal(tieResult.ranking[1].position, 2);
console.log('✓ Teste 4: Desempate por quantidade de acertos validado.');

// 5. Teste: Empate real compartilhado de notas e acertos (Exemplo exato do prompt)
// | Posição | Colaborador | Acertos | Aproveitamento |
// | 🥇 1º   | João Silva  | 5/5     | 100%           |
// | 🥈 2º   | Maria Souza | 4/5     | 80%            |
// | 🥉 2º   | Pedro Santos| 4/5     | 80%            |
// | 4º      | Ana Oliveira| 3/5     | 60%            |
const sharedTieAttempts = [
  { id: '1', participantName: 'João Silva', score: 100, earnedPoints: 5, possiblePoints: 5, passed: true },
  { id: '2', participantName: 'Maria Souza', score: 80, earnedPoints: 4, possiblePoints: 5, passed: true },
  { id: '3', participantName: 'Pedro Santos', score: 80, earnedPoints: 4, possiblePoints: 5, passed: true },
  { id: '4', participantName: 'Ana Oliveira', score: 60, earnedPoints: 3, possiblePoints: 5, passed: false }
];
const sharedTieResult = computeQuizRanking(sharedTieAttempts, 5);
assert.equal(sharedTieResult.ranking[0].position, 1);
assert.equal(sharedTieResult.ranking[0].participantName, 'João Silva');
assert.equal(sharedTieResult.ranking[1].position, 2);
assert.equal(sharedTieResult.ranking[2].position, 2); // Compartilham a 2ª posição!
assert.equal(sharedTieResult.ranking[1].isTie, true);
assert.equal(sharedTieResult.ranking[2].isTie, true);
assert.equal(sharedTieResult.ranking[3].position, 4); // Próximo é 4º lugar!
assert.equal(sharedTieResult.podium.first.length, 1);
assert.equal(sharedTieResult.podium.second.length, 2); // Maria e Pedro no 2º lugar
console.log('✓ Teste 5: Empate compartilhado (1º, 2º, 2º, 4º) validado com fidelidade absoluta.');

// 6. Teste: Desduplicação de colaborador (Não permite duplicidade de posições por participante)
const duplicateAttempts = [
  { id: '1', participantName: 'Carlos Silva', score: 40, earnedPoints: 2, possiblePoints: 5, passed: false },
  { id: '2', participantName: 'Carlos Silva', score: 100, earnedPoints: 5, possiblePoints: 5, passed: true },
  { id: '3', participantName: 'Beatriz Lima', score: 80, earnedPoints: 4, possiblePoints: 5, passed: true }
];
const dedupResult = computeQuizRanking(duplicateAttempts, 5);
assert.equal(dedupResult.totalParticipants, 2);
assert.equal(dedupResult.ranking.length, 2);
assert.equal(dedupResult.ranking[0].participantName, 'Carlos Silva');
assert.equal(dedupResult.ranking[0].score, 100);
console.log('✓ Teste 6: Desduplicação de tentativas preservando melhor nota validada.');

// 7. Teste: Anonimização de nomes para visualização pública (LGPD)
assert.equal(sanitizePublicName('João Pedro da Silva'), 'João P. D. Silva');
assert.equal(sanitizePublicName('Carlos Souza'), 'Carlos Souza');
assert.equal(sanitizePublicName('Roberto'), 'Roberto');
console.log('✓ Teste 7: Anonimização e proteção LGPD validada.');

// 8. Teste: Desempate por menor tempo de conclusão quando nota e acertos são iguais
const timeTieAttempts = [
  { id: '1', participantName: 'Carlos Devagar', score: 100, earnedPoints: 5, possiblePoints: 5, timeSpentSeconds: 120, passed: true },
  { id: '2', participantName: 'Alexandre Rapido', score: 100, earnedPoints: 5, possiblePoints: 5, timeSpentSeconds: 45, passed: true },
  { id: '3', participantName: 'Sebastião Medio', score: 100, earnedPoints: 5, possiblePoints: 5, timeSpentSeconds: 80, passed: true }
];
const timeTieResult = computeQuizRanking(timeTieAttempts, 5);
assert.equal(timeTieResult.ranking[0].participantName, 'Alexandre Rapido');
assert.equal(timeTieResult.ranking[0].position, 1);
assert.equal(timeTieResult.ranking[0].timeSpentFormatted, '45s');

assert.equal(timeTieResult.ranking[1].participantName, 'Sebastião Medio');
assert.equal(timeTieResult.ranking[1].position, 2);
assert.equal(timeTieResult.ranking[1].timeSpentFormatted, '1m 20s');

assert.equal(timeTieResult.ranking[2].participantName, 'Carlos Devagar');
assert.equal(timeTieResult.ranking[2].position, 3);
assert.equal(timeTieResult.ranking[2].timeSpentFormatted, '2m 00s');

assert.equal(timeTieResult.podium.first[0].participantName, 'Alexandre Rapido');
assert.equal(timeTieResult.podium.second[0].participantName, 'Sebastião Medio');
assert.equal(timeTieResult.podium.third[0].participantName, 'Carlos Devagar');
console.log('✓ Teste 8: Desempate por menor tempo de conclusão validado com sucesso.');

console.log('✅ TODOS OS 8 TESTES AUTOMATIZADOS DO MOTOR DE RANKING PASSARAM!');
