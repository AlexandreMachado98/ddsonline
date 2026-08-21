 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

// 1. GET: Busca reunião ativa, histórico E verifica status para desligamento global
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const meetingId = searchParams.get('meetingId');
    const organizerId = searchParams.get('organizerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Se o celular estiver perguntando apenas o status da reunião (Para derrubar a chamada)
    if (meetingId) {
      const targetMeeting = await (prisma as any).meeting.findUnique({
        where: { id: meetingId },
        select: { status: true }
      });
      return NextResponse.json({ success: true, status: targetMeeting?.status || 'ENDED' });
    }

    // Filtros de Histórico do Painel
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);

    const meetingWhere: any = { status: 'ENDED' };
    if (organizerId && organizerId !== 'undefined' && organizerId !== 'null') {
      meetingWhere.organizerId = organizerId;
    }
    if (startDate || endDate) meetingWhere.createdAt = dateFilter;

    const activeMeeting = await (prisma as any).meeting.findFirst({
      where: {
        status: 'LIVE',
        ...(organizerId && organizerId !== 'undefined' ? { organizerId } : {})
      },
      include: { attendees: { orderBy: { createdAt: 'desc' } } }
    });

    const history = await (prisma as any).meeting.findMany({
      where: meetingWhere,
      include: { attendees: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, meeting: activeMeeting, history });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao buscar dados' }, { status: 500 });
  }
}

// 2. POST: Cria novo DDS
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, farm, type, objective, organizerId, teamPhotos } = body;

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

    const newMeeting = await (prisma as any).meeting.create({
      data: {
        topic: String(topic).trim(),
        farm: String(farm).trim(),
        type: type || 'PRESENTIAL',
        objective: objective ? String(objective).trim() : null,
        teamPhotos: teamPhotos ? JSON.stringify(teamPhotos) : null,
        status: 'LIVE',
        organizerId: organizerId || null
      },
      include: { attendees: true }
    });

    return NextResponse.json({ success: true, meeting: newMeeting });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Falha ao salvar no banco' }, { status: 500 });
  }
}

// 3. PATCH: Atualiza fotos da equipe
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { meetingId, teamPhotos } = body;

    const updated = await (prisma as any).meeting.update({
      where: { id: meetingId },
      data: { teamPhotos: teamPhotos ? JSON.stringify(teamPhotos) : null },
      include: { attendees: true }
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