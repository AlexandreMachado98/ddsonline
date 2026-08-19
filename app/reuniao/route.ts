 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. GET: Busca reunião ativa e histórico
export async function GET() {
  try {
    const activeMeeting = await prisma.meeting.findFirst({
      where: { status: 'LIVE' },
      include: {
        attendees: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const history = await prisma.meeting.findMany({
      where: { status: 'ENDED' },
      include: {
        attendees: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, meeting: activeMeeting, history });
  } catch (error: any) {
    console.error("Erro no GET /api/reuniao:", error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao buscar dados' }, { status: 500 });
  }
}

// 2. POST: Abre uma nova reunião
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, farm } = body;

    if (!topic || !farm) {
      return NextResponse.json({ success: false, error: 'Preencha o Tema e o Local da fazenda' }, { status: 400 });
    }

    // Encerra reuniões anteriores com segurança
    try {
      await prisma.meeting.updateMany({
        where: { status: 'LIVE' },
        data: { status: 'ENDED' }
      });
    } catch (e) {
      console.warn("Aviso ao encerrar anteriores:", e);
    }

    // Calcula expiração de 10 minutos
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const inviteToken = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newMeeting = await prisma.meeting.create({
      data: {
        topic: String(topic).trim(),
        farm: String(farm).trim(),
        status: 'LIVE',
        inviteExpiresAt: expiresAt,
        inviteToken: inviteToken
      },
      include: {
        attendees: true
      }
    });

    return NextResponse.json({ success: true, meeting: newMeeting });
  } catch (error: any) {
    console.error("Erro detalhado no POST /api/reuniao:", error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Falha ao salvar a nova reunião no banco de dados' 
    }, { status: 500 });
  }
}

// 3. PATCH: Renova o link por mais 10 minutos
export async function PATCH(req: Request) {
  try {
    const { meetingId } = await req.json();
    const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        inviteExpiresAt: newExpiresAt,
        inviteToken: newToken
      },
      include: {
        attendees: true
      }
    });

    return NextResponse.json({ success: true, meeting: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao renovar link' }, { status: 500 });
  }
}

// 4. PUT: Encerra reunião
export async function PUT() {
  try {
    await prisma.meeting.updateMany({
      where: { status: 'LIVE' },
      data: { status: 'ENDED' }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}