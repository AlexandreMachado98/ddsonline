 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// FORÇA A VERCEL A NUNCA CACHEAR ESTA ROTA (TEMPO REAL OBRIGATÓRIO)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

// 1. GET: Busca reunião ativa e histórico em tempo real
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizerId = searchParams.get('organizerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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

    if (organizerId && organizerId !== 'undefined' && organizerId !== 'null') {
      meetingWhere.organizerId = organizerId;
    }

    if (startDate || endDate) {
      meetingWhere.createdAt = dateFilter;
    }

    // Busca a reunião AO VIVO com todas as presenças atualizadas
    const activeMeeting = await (prisma as any).meeting.findFirst({
      where: {
        status: 'LIVE',
        ...(organizerId && organizerId !== 'undefined' ? { organizerId } : {})
      },
      include: {
        attendees: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const history = await (prisma as any).meeting.findMany({
      where: meetingWhere,
      include: {
        attendees: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(
      { success: true, meeting: activeMeeting, history },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao buscar dados' }, { status: 500 });
  }
}

// 2. POST: Abre nova reunião
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, farm, organizerId } = body;

    if (!topic || !farm) {
      return NextResponse.json({ success: false, error: 'Preencha o Tema e o Local da fazenda' }, { status: 400 });
    }

    try {
      await (prisma as any).meeting.updateMany({
        where: {
          status: 'LIVE',
          ...(organizerId ? { organizerId } : {})
        },
        data: { status: 'ENDED' }
      });
    } catch (e) {}

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const inviteToken = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newMeeting = await (prisma as any).meeting.create({
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
    return NextResponse.json({ success: false, error: error?.message || 'Falha ao salvar no banco' }, { status: 500 });
  }
}

// 3. PATCH: Renova link de 10 min
export async function PATCH(req: Request) {
  try {
    const { meetingId } = await req.json();
    const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();

    const updated = await (prisma as any).meeting.update({
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

    await (prisma as any).meeting.updateMany({
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