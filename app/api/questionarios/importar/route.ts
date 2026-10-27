import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Parsed = { text: string; options: { text: string; correct: boolean }[]; explanation?: string };

function parseText(text: string): Parsed[] {
  const lines = text.replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
  const answers = new Map<number, string>();
  let inKey = false;
  for (const line of lines) {
    if (/^(?:gabarito|respostas corretas)\s*:?$/i.test(line)) { inKey = true; continue; }
    if (inKey) {
      const matches = [...line.matchAll(/(?:^|\s|[,;])(?:quest[aã]o\s*)?(\d{1,3})\s*[-.:)]\s*([A-H])\b/gi)];
      for (const m of matches) answers.set(Number(m[1]), m[2].toUpperCase());
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
    result.push({ text: current.text, options: current.options.map(o => ({ text: o.text, correct: o.letter === answer })), explanation: current.explanation });
  };
  for (const line of lines) {
    if (/^(?:gabarito|respostas corretas)\s*:?$/i.test(line)) break;
    const question = line.match(/^(?:quest[aã]o\s*)?(\d{1,3})[.)\-:]\s*(.+)$/i);
    const option = line.match(/^([A-H])[.)\-:]\s*(.+)$/i);
    const answer = line.match(/^(?:gabarito|resposta(?:\s+correta)?)\s*[:\-]\s*([A-H])\s*$/i);
    const explanation = line.match(/^(?:explica[cç][aã]o|justificativa)\s*[:\-]\s*(.+)$/i);
    if (question) { finish(); current = { number: Number(question[1]), text: question[2], options: [], answer: '', explanation: '' }; }
    else if (option && current) current.options.push({ letter: option[1].toUpperCase(), text: option[2] });
    else if (answer && current) current.answer = answer[1].toUpperCase();
    else if (explanation && current) current.explanation = explanation[1];
    else if (current && !current.options.length && !/^(?:p[aá]gina|page)\s+\d+/i.test(line)) current.text += ' ' + line;
  }
  finish();
  if (!result.length) throw new Error('Nenhuma questão identificada. Use numeração, alternativas A) e gabarito.');
  if (result.length > 100) throw new Error('Máximo de 100 questões por importação.');
  return result;
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ success: false, error: 'Sessão inválida.' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'Selecione um arquivo.' }, { status: 400 });
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'xlsx'].includes(extension || '') || file.size > 5 * 1024 * 1024 || file.size === 0) {
      return NextResponse.json({ success: false, error: 'Formato inválido ou arquivo acima de 5 MB.' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';
    if (extension === 'docx') {
      const mammoth = await import('mammoth');
      text = (await mammoth.extractRawText({ buffer })).value;
    } else if (extension === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const parsed = await pdfParse(buffer, { max: 50 });
      text = parsed.text;
    } else {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('Planilha sem abas.');
      const rows: string[][] = [];
      sheet.eachRow(row => rows.push((row.values as any[]).slice(1).map(v => typeof v === 'string' ? v : v == null ? '' : String(typeof v === 'object' && 'text' in v ? v.text : v))));
      if (!rows.length) throw new Error('Planilha vazia.');
      const header = rows[0].map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''));
      const find = (...names: string[]) => header.findIndex(h => names.includes(h));
      const qi = find('pergunta', 'questao', 'enunciado'), ai = find('gabarito', 'resposta', 'respostacorreta');
      const cols = 'ABCDEFGH'.split('').map(letter => find(letter.toLowerCase(), 'alternativa' + letter.toLowerCase(), 'opcao' + letter.toLowerCase()));
      if (qi < 0 || ai < 0 || cols[0] < 0 || cols[1] < 0) throw new Error('Use colunas Pergunta, Alternativa A, Alternativa B e Gabarito.');
      const questions = rows.slice(1).filter(row => row.some(Boolean)).map((row, i) => {
        const answer = (row[ai] || '').trim().toUpperCase();
        const options = cols.flatMap((index, pos) => index < 0 || !row[index]?.trim() ? [] : [{ letter: 'ABCDEFGH'[pos], text: row[index].trim() }]);
        if (!row[qi]?.trim() || options.length < 2 || !options.some(o => o.letter === answer)) throw new Error('Linha ' + (i + 2) + ' inválida.');
        return { text: row[qi].trim(), options: options.map(o => ({ text: o.text, correct: o.letter === answer })) };
      });
      if (!questions.length || questions.length > 100) throw new Error('A planilha deve conter de 1 a 100 questões.');
      return NextResponse.json({ success: true, questions }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const questions = parseText(text);
    return NextResponse.json({ success: true, questions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Falha ao extrair questões.' }, { status: 422 });
  }
}
