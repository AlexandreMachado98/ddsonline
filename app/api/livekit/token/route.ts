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

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: 'Credenciais do LiveKit ausentes no servidor (.env).' },
        { status: 500 }
      );
    }

    // Cria o token criptografado de acesso à sala
    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      name: username,
    });

    at.addGrant({
      room,
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