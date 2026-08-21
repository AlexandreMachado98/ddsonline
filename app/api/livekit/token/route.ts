 import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const room = searchParams.get('room');
    const username = searchParams.get('username') || 'Participante';
    const isAdmin = searchParams.get('isAdmin') === 'true';

    if (!room) {
      return NextResponse.json({ error: 'Parâmetro "room" é obrigatório.' }, { status: 400 });
    }

    const apiKey = (process.env.LIVEKIT_API_KEY || '').trim();
    const apiSecret = (process.env.LIVEKIT_API_SECRET || '').trim();
    let wsUrl = (process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || '').trim();

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: 'Credenciais do LiveKit ausentes no servidor (.env).' },
        { status: 500 }
      );
    }

    // Garante protocolo wss:// sem barras no final
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = wsUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
    }
    wsUrl = wsUrl.replace(/\/$/, '');

    // Identidade única para evitar o erro de desconexão por identidade duplicada
    const uniqueIdentity = `${username.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.random().toString(36).substring(2, 7)}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: uniqueIdentity,
      name: username,
      ttl: '4h', // Token válido por 4 horas
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
    return NextResponse.json({ error: error?.message || 'Erro no servidor de vídeo' }, { status: 500 });
  }
}