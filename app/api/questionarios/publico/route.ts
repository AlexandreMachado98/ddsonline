import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ success: false, error: 'Convite inválido.' }, { status: 400 });
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { shareToken: token },
      select: { id: true, title: true, status: true, passingScore: true,
        meeting: { select: { topic: true, status: true } },
        questions: { orderBy: { position: 'asc' }, select: {
          id: true, text: true, type: true, weight: true, position: true,
          options: { orderBy: { position: 'asc' }, select: { id: true, text: true, position: true } }
        } }
      }
    });
    if (!quiz || quiz.status !== 'PUBLISHED') return NextResponse.json({ success: false, error: 'Questionário indisponível.' }, { status: 404 });
    return NextResponse.json({ success: true, quiz }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ success: false, error: 'Não foi possível carregar o questionário.' }, { status: 500 }); }
}
