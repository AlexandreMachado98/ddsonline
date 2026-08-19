 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. GET: Busca reunião ativa e histórico filtrado por organizador e período
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizerId = searchParams.get('organizerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Filtro por período
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const meetingWhere: any = {
      status: 'ENDED'
    };

    if (organizerId) {
      meetingWhere.organizerId = organizerId;
    }

    if (startDate || endDate) {
      meetingWhere.createdAt = dateFilter;
    }

    // Reunião ao vivo do organizador (se houver)
    const activeMeeting = await prisma.meeting.findFirst({
      where: {
        status: 'LIVE',
        ...(organizerId ? { organizerId } : {})
      },
      include: {
        attendees: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Histórico isolado e filtrado
    const history = await prisma.meeting.findMany({
      where: meetingWhere,
      include: {
        attendees: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, meeting: activeMeeting, history });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao buscar dados' }, { status: 500 });
  }
}

// 2. POST: Cria nova reunião vinculada ao ID do Organizador
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, farm, organizerId } = body;

    if (!topic || !farm) {
      return NextResponse.json({ success: false, error: 'Preencha o Tema e o Local da fazenda' }, { status: 400 });
    }

    // Encerra reuniões anteriores do organizador
    try {
      await prisma.meeting.updateMany({
        where: {
          status: 'LIVE',
          ...(organizerId ? { organizerId } : {})
        },
        data: { status: 'ENDED' }
      });
    } catch (e) {}

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const inviteToken = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newMeeting = await prisma.meeting.create({
      data: {
        topic: String(topic).trim(),
        farm: String(farm).trim(),
        status: 'LIVE',
        inviteExpiresAt: expiresAt,
        inviteToken: inviteToken,
        organizerId: organizerId || null
      },
      include: {
        attendees: true
      }
    });

    return NextResponse.json({ success: true, meeting: newMeeting });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
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
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// 4. PUT: Encerra reunião
export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { meetingId } = body;

    await prisma.meeting.updateMany({
      where: {
        status: 'LIVE',
        ...(meetingId ? { id: meetingId } : {})
      },
      data: { status: 'ENDED' }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}