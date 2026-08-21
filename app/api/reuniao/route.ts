 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizerId = searchParams.get('organizerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);

    const meetingWhere: any = { status: 'ENDED' };

    if (organizerId && organizerId !== 'undefined' && organizerId !== 'null') {
      meetingWhere.organizerId = organizerId;
    }

    if (startDate || endDate) {
      meetingWhere.createdAt = dateFilter;
    }

    const activeMeeting = await prisma.meeting.findFirst({
      where: {
        status: 'LIVE',
        ...(organizerId && organizerId !== 'undefined' ? { organizerId } : {})
      },
      include: {
        attendees: { orderBy: { createdAt: 'desc' } }
      }
    });

    const history = await prisma.meeting.findMany({
      where: meetingWhere,
      include: {
        attendees: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(
      { success: true, meeting: activeMeeting, history },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        }
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao buscar dados' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, farm, type, objective, organizerId, teamPhotos } = body;

    if (!topic || !farm) {
      return NextResponse.json({ success: false, error: 'Preencha o Tema e o Local da fazenda' }, { status: 400 });
    }

    try {
      await prisma.meeting.updateMany({
        where: {
          status: 'LIVE',
          ...(organizerId ? { organizerId } : {})
        },
        data: { status: 'ENDED' }
      });
    } catch (e) {}

    const newMeeting = await prisma.meeting.create({
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
    return NextResponse.json({ success: false, error: error?.message || 'Falha ao salvar' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { meetingId, teamPhotos } = body;

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: { teamPhotos: teamPhotos ? JSON.stringify(teamPhotos) : null },
      include: { attendees: true }
    });

    return NextResponse.json({ success: true, meeting: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

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

// 5. DELETE: EXCLUSÃO DE MÚLTIPLOS DDS
export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { meetingIds } = body;

    if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum DDS selecionado para exclusão.' }, { status: 400 });
    }

    // Apaga todas as presenças vinculadas (Exclusão em Cascata)
    await prisma.attendance.deleteMany({
      where: { meetingId: { in: meetingIds } }
    });

    // Apaga as reuniões
    await prisma.meeting.deleteMany({
      where: { id: { in: meetingIds } }
    });

    return NextResponse.json({ success: true, message: 'Excluído com sucesso.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao excluir DDS' }, { status: 500 });
  }
}