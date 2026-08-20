 import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const room = req.nextUrl.searchParams.get('room');
    const username = req.nextUrl.searchParams.get('username') || 'Participante';

    if (!room) {
      return NextResponse.json({ error: 'Parâmetro "room" é obrigatório.' }, { status: 400 });
    }

    const apiKey = (process.env.LIVEKIT_API_KEY || '').trim().replace(/['"]/g, '');
    const apiSecret = (process.env.LIVEKIT_API_SECRET || '').trim().replace(/['"]/g, '');
    let wsUrl = (process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || '').trim().replace(/['"]/g, '');

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: 'Credenciais do LiveKit ausentes no servidor (.env ou Vercel).' },
        { status: 500 }
      );
    }

    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = wsUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
    }
    wsUrl = wsUrl.replace(/\/$/, '');

    // Cria o token padrão oficial do LiveKit
    const identity = `${username.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Math.random().toString(36).substring(2, 7)}`;
    
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: username,
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
    console.error('Erro na API LiveKit:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao gerar token' }, { status: 500 });
  }
}