 import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const room = searchParams.get('room');
    const username = searchParams.get('username') || 'Participante';

    if (!room) {
      return NextResponse.json({ error: 'Parâmetro "room" é obrigatório.' }, { status: 400 });
    }

    // LIMPEZA RIGOROSA: Remove aspas duplas, aspas simples, barras e espaços acidentais
    let apiKey = (process.env.LIVEKIT_API_KEY || '').trim().replace(/['"]/g, '');
    let apiSecret = (process.env.LIVEKIT_API_SECRET || '').trim().replace(/['"]/g, '');
    let wsUrl = (process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || '').trim().replace(/['"]/g, '');

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: 'Credenciais do LiveKit ausentes no servidor (.env ou Vercel).' },
        { status: 500 }
      );
    }

    // Garante formato limpo de WebSocket wss:// sem barras no final
    if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
    if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = `wss://${wsUrl}`;
    }
    wsUrl = wsUrl.replace(/\/$/, '');

    // Identidade única e limpa por conexão
    const safeName = username.replace(/[^a-zA-Z0-9_-]/g, '_');
    const identity = `${safeName}_${Math.random().toString(36).substring(2, 7)}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: username,
      ttl: '4h',
    });

    at.addGrant({
      room: room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token, wsUrl });
  } catch (error: any) {
    console.error('Erro ao gerar token LiveKit:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao gerar token' }, { status: 500 });
  }
}