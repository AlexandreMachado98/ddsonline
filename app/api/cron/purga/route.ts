// app/api/cron/purga/route.ts
// Tarefa diária da Vercel (vercel.json → crons): apaga as selfies dos DDS encerrados há
// mais de 48 h. A Vercel envia "Authorization: Bearer <CRON_SECRET>" automaticamente;
// sem CRON_SECRET configurado a rota fica desligada (o painel do organizador também
// dispara a mesma limpeza, então nada fica parado).

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { purgeExpiredSelfiesThrottled } from '@/lib/retention';

export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }
  const selfiesRemoved = await purgeExpiredSelfiesThrottled(true);
  return NextResponse.json({ success: true, selfiesRemoved }, { headers: { 'Cache-Control': 'no-store' } });
}
