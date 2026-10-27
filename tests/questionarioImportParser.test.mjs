import assert from 'node:assert/strict';
import test from 'node:test';
import { parseText } from '../lib/questionarioImportParser.ts';

test('extrai questão com gabarito junto ao enunciado', () => {
  const questions = parseText('1. O que é APR?\nA) Análise Preliminar de Risco\nB) Autorização de Produção\nGabarito: A');
  assert.equal(questions.length, 1);
  assert.equal(questions[0].options[0].correct, true);
  assert.equal(questions[0].options[1].correct, false);
});

test('identifica gabarito em seção separada no final', () => {
  const questions = parseText('1. Qual EPI protege a cabeça?\nA) Capacete\nB) Luva\n2. O que fazer ao identificar risco grave?\nA) Ignorar\nB) Parar e comunicar\nGabarito\n1 - A\n2 - B');
  assert.equal(questions.length, 2);
  assert.equal(questions[0].options[0].correct, true);
  assert.equal(questions[1].options[1].correct, true);
});

test('recusa questões sem gabarito', () => {
  assert.throws(() => parseText('1. Pergunta?\nA) Sim\nB) Não'), /gabarito válido/);
});

test('recusa alternativas duplicadas', () => {
  assert.throws(() => parseText('1. Pergunta?\nA) Sim\nA) Não\nGabarito: A'), /repetidas/);
});

test('recusa texto sem questões', () => {
  assert.throws(() => parseText('Documento sem perguntas'), /Nenhuma questão/);
});
