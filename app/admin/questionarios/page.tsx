'use client';
import { useState } from 'react';
import Link from 'next/link';
import { gradeQuiz, QuizQuestion, QuizAnswer } from '@/lib/quizGrading';

const initial: QuizQuestion[] = [{
  id: 'q1', text: 'Antes de iniciar uma atividade, qual atitude é mais segura?', type: 'SINGLE_CHOICE', weight: 1,
  options: [
    { id: 'a', text: 'Identificar os riscos e conferir as medidas preventivas', correct: true },
    { id: 'b', text: 'Iniciar imediatamente para ganhar tempo', correct: false }
  ]
}];

export default function QuestionariosPreview() {
  const [title, setTitle] = useState('Avaliação de percepção de riscos');
  const [questions, setQuestions] = useState<QuizQuestion[]>(initial);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [passingScore, setPassingScore] = useState(70);
  const [mode, setMode] = useState<'editor' | 'collaborator'>('editor');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReturnType<typeof gradeQuiz> | null>(null);
  const field = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100';
  const action = 'rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500';
  function updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    setQuestions(old => old.map(q => q.id === id ? { ...q, ...patch } : q));
  }
  function choose(qid: string, oid: string) {
    setAnswers(old => [...old.filter(a => a.questionId !== qid), { questionId: qid, selectedOptionIds: [oid] }]);
  }
  function submit() {
    try {
      const graded = gradeQuiz(questions, answers, { passingScore, criticalBelow: Math.min(40, passingScore), excellentFrom: Math.max(90, passingScore) });
      setResult(graded); setSubmitted(true); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível corrigir.'); }
  }
  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-10">
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin" className="text-cyan-400">← Voltar ao DDS Online</Link>
      <header className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">DDS Online · Prévia isolada</p>
        <h1 className="mt-2 text-2xl font-bold">Questionários e avaliações</h1>
        <p className="mt-2 text-sm text-slate-400">Demonstração local. Não publica, compartilha nem salva respostas no servidor.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className={action} onClick={() => { setMode('editor'); setSubmitted(false); setResult(null); }}>Visão do organizador</button>
          <button className="rounded-xl border border-slate-600 px-4 py-3" onClick={() => { setMode('collaborator'); setSubmitted(false); setResult(null); setAnswers([]); }}>Testar como colaborador</button>
        </div>
      </header>
      {mode === 'editor' ? <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <label className="block space-y-2"><span>Título do questionário</span><input className={field} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="block space-y-2"><span>Nota mínima para aprovação (%)</span><input type="number" min="0" max="100" className={field} value={passingScore} onChange={e => setPassingScore(Number(e.target.value))} /></label>
        {questions.map((q, index) => <div key={q.id} className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between"><strong>Pergunta {index + 1}</strong><button className="text-rose-400" onClick={() => setQuestions(old => old.filter(x => x.id !== q.id))}>Excluir</button></div>
          <input aria-label="Enunciado" className={field} value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })} />
          <label className="block text-sm">Peso <input type="number" min="1" className={field} value={q.weight} onChange={e => updateQuestion(q.id, { weight: Number(e.target.value) })} /></label>
          <p className="text-sm text-slate-400">Marque a alternativa correta:</p>
          {q.options.map(o => <div key={o.id} className="flex items-center gap-3"><input aria-label="Alternativa correta" type="radio" name={q.id} checked={o.correct} onChange={() => updateQuestion(q.id, { options: q.options.map(x => ({ ...x, correct: x.id === o.id })) })} /><input className={field} value={o.text} onChange={e => updateQuestion(q.id, { options: q.options.map(x => x.id === o.id ? { ...x, text: e.target.value } : x) })} /></div>)}
          <button className="text-sm text-cyan-400" onClick={() => updateQuestion(q.id, { options: [...q.options, { id: crypto.randomUUID(), text: '', correct: false }] })}>+ Alternativa</button>
        </div>)}
        <button className={action} onClick={() => setQuestions(old => [...old, { id: crypto.randomUUID(), text: '', type: 'SINGLE_CHOICE', weight: 1, options: [{ id: crypto.randomUUID(), text: '', correct: true }, { id: crypto.randomUUID(), text: '', correct: false }] }])}>+ Adicionar pergunta</button>
      </section> : <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-bold">{title}</h2>
        {questions.map((q, i) => <fieldset key={q.id} className="space-y-3 rounded-xl border border-slate-700 p-4" disabled={submitted}>
          <legend className="px-2 font-semibold">{i + 1}. {q.text}</legend>
          {q.options.map(o => <label key={o.id} className="flex items-center gap-3 rounded-lg bg-slate-800 p-3"><input type="radio" name={q.id} checked={answers.find(a => a.questionId === q.id)?.selectedOptionIds.includes(o.id) || false} onChange={() => choose(q.id, o.id)} /><span>{o.text}</span></label>)}
        </fieldset>)}
        {!submitted && <button className={action} onClick={submit}>Finalizar e corrigir</button>}
        {error && <p role="alert" className="text-rose-400">{error}</p>}
        {result && <div className="rounded-xl border border-cyan-700 bg-slate-950 p-5" role="status"><h3 className="text-xl font-bold">Resultado: {result.score}%</h3><p>{result.correctCount} de {result.totalQuestions} questões corretas</p><p className={result.passed ? 'text-emerald-400' : 'text-amber-400'}>{result.passed ? 'Aprovado' : 'Abaixo do aproveitamento mínimo'}</p></div>}
      </section>}
    </div>
  </main>;
}
