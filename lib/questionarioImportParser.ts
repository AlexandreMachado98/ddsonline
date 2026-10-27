export type Parsed = { text: string; options: { text: string; correct: boolean }[]; explanation?: string };

export function parseText(text: string): Parsed[] {
  const lines = text.replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
  const answers = new Map<number, string>();
  let answerSection = false;
  for (const line of lines) {
    if (/^(?:gabarito|respostas corretas)\s*:?$/i.test(line)) {
      answerSection = true;
      continue;
    }
    if (!answerSection) continue;
    for (const match of line.matchAll(/(?:^|[\s,;])(?:quest[aã]o\s*)?(\d{1,3})\s*[-.:)]\s*([A-H])\b/gi)) {
      answers.set(Number(match[1]), match[2].toUpperCase());
    }
  }
  const result: Parsed[] = [];
  let current: { number: number; text: string; options: { letter: string; text: string }[]; answer: string; explanation: string } | null = null;
  const finish = () => {
    if (!current) return;
    const answer = current.answer || answers.get(current.number) || '';
    if (!current.text || current.options.length < 2 || !current.options.some(o => o.letter === answer)) {
      throw new Error('Questão ' + current.number + ' sem alternativas ou gabarito válido. Revise o documento.');
    }
    if (new Set(current.options.map(o => o.letter)).size !== current.options.length) {
      throw new Error('Questão ' + current.number + ' contém letras de alternativas repetidas.');
    }
    result.push({
      text: current.text,
      options: current.options.map(o => ({ text: o.text, correct: o.letter === answer })),
      explanation: current.explanation
    });
  };
  for (const line of lines) {
    if (/^(?:gabarito|respostas corretas)\s*:?$/i.test(line)) break;
    const question = line.match(/^(?:quest[aã]o\s*)?(\d{1,3})[.)\-:]\s*(.+)$/i);
    const option = line.match(/^([A-H])[.)\-:]\s*(.+)$/i);
    const answer = line.match(/^(?:gabarito|resposta(?:\s+correta)?)\s*[:\-]\s*([A-H])\s*$/i);
    const explanation = line.match(/^(?:explica[cç][aã]o|justificativa)\s*[:\-]\s*(.+)$/i);
    if (question) {
      finish();
      current = { number: Number(question[1]), text: question[2], options: [], answer: '', explanation: '' };
    } else if (option && current) {
      current.options.push({ letter: option[1].toUpperCase(), text: option[2] });
    } else if (answer && current) {
      current.answer = answer[1].toUpperCase();
    } else if (explanation && current) {
      current.explanation = explanation[1];
    } else if (current && !current.options.length && !/^(?:p[aá]gina|page)\s+\d+/i.test(line)) {
      current.text += ' ' + line;
    }
  }
  finish();
  if (!result.length) throw new Error('Nenhuma questão identificada. Use numeração, alternativas A) e gabarito.');
  if (result.length > 100) throw new Error('Máximo de 100 questões por importação.');
  return result;
}

