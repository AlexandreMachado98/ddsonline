const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('lib/quizGrading.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const moduleObj = { exports: {} };
const context = { require, console, process, exports: moduleObj.exports, module: moduleObj };
vm.runInNewContext(compiled.outputText, context, { filename: 'quizGrading.js' });
const { gradeQuiz } = moduleObj.exports;
const settings = { passingScore: 70, criticalBelow: 40, excellentFrom: 90 };
const q = [{ id: '1', text: 'Segurança?', type: 'SINGLE_CHOICE', weight: 2, options: [
  { id: 'a', text: 'Sim', correct: true }, { id: 'b', text: 'Não', correct: false }
] }, { id: '2', text: 'EPIs?', type: 'MULTIPLE_CHOICE', weight: 1, options: [
  { id: 'c', text: 'Capacete', correct: true }, { id: 'd', text: 'Luvas', correct: true }, { id: 'e', text: 'Nenhum', correct: false }
] }];
function run(answers) { return gradeQuiz(q, answers, settings); }
assert.equal(run([{questionId:'1',selectedOptionIds:['a']},{questionId:'2',selectedOptionIds:['c','d']}]).score, 100);
assert.equal(run([{questionId:'1',selectedOptionIds:['a']},{questionId:'2',selectedOptionIds:['c']}]).score, 66.67);
assert.equal(run([{questionId:'1',selectedOptionIds:['b']},{questionId:'2',selectedOptionIds:['e']}]).level, 'CRITICAL');
assert.equal(run([{questionId:'1',selectedOptionIds:['a','b']}]).correctCount, 0);
assert.equal(run([]).score, 0);
assert.throws(() => run([{questionId:'1',selectedOptionIds:['invalid']}]));
assert.throws(() => run([{questionId:'1',selectedOptionIds:['a']},{questionId:'1',selectedOptionIds:['a']}]));
assert.throws(() => gradeQuiz([], [], settings));
assert.throws(() => gradeQuiz(q, [], {passingScore:20,criticalBelow:30,excellentFrom:90}));
console.log('9 verificações do motor de correção passaram.');
