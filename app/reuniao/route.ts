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
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Erro ao buscar dados' }, { status: 500 });
  }
}

// 2. POST: Cria nova reunião com validade de 10 minutos
export async function POST(req: Request) {
  try {
    const { topic, farm } = await req.json();

    // Encerra reuniões anteriores
    await prisma.meeting.updateMany({
      where: { status: 'LIVE' },
      data: { status: 'ENDED' }
    });

    // Define expiração para exatamente 10 minutos a partir de agora
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const inviteToken = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newMeeting = await prisma.meeting.create({
      data: {
        topic,
        farm,
        status: 'LIVE',
        inviteExpiresAt: expiresAt,
        inviteToken: inviteToken
      }
    });

    return NextResponse.json({ success: true, meeting: newMeeting });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Erro ao criar reunião' }, { status: 500 });
  }
}

// 3. PATCH: Renova o link por mais 10 minutos (Quando o técnico clica em "Gerar Novo Link")
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
      }
    });

    return NextResponse.json({ success: true, meeting: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Erro ao renovar link' }, { status: 500 });
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
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Erro ao encerrar' }, { status: 500 });
  }
}