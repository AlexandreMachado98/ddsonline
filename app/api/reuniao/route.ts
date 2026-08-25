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
    const meetingId = searchParams.get('meetingId');
    const organizerId = searchParams.get('organizerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 1. ROTA DO COLABORADOR: Consulta APENAS a reunião exata do link
    if (meetingId) {
      const targetMeeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { id: true, status: true, topic: true, farm: true, type: true }
      });
      
      if (!targetMeeting) {
        return NextResponse.json({ success: false, status: 'ENDED' });
      }

      return NextResponse.json({ 
        success: true, 
        status: targetMeeting.status, 
        meeting: targetMeeting 
      });
    }

    // 2. ROTA DO ORGANIZADOR: Isolamento Absoluto por Usuário
    if (!organizerId || organizerId === 'undefined' || organizerId === 'null' || organizerId.trim() === '') {
      return NextResponse.json({ success: true, meeting: null, history: [] });
    }

    const cleanOrgId = organizerId.trim();

    // Valida se o organizador existe no banco
    const user = await prisma.user.findUnique({
      where: { id: cleanOrgId },
      select: { id: true }
    });

    if (!user) {
      // Usuário não encontrado: painel totalmente limpo
      return NextResponse.json({ success: true, meeting: null, history: [] });
    }

    // Auto-encerra reuniões LIVE abandonadas com mais de 24h deste técnico
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.meeting.updateMany({
      where: {
        status: 'LIVE',
        organizerId: user.id,
        createdAt: { lt: oneDayAgo }
      },
      data: { status: 'ENDED' }
    });

    // Busca a reunião ativa EXCLUSIVAMENTE deste organizador
    const activeMeeting = await prisma.meeting.findFirst({
      where: {
        status: 'LIVE',
        organizerId: user.id
      },
      include: {
        attendees: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filtros de Data para o Histórico EXCLUSIVO deste organizador
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);

    const history = await prisma.meeting.findMany({
      where: {
        status: 'ENDED',
        organizerId: user.id,
        ...(startDate || endDate ? { createdAt: dateFilter } : {})
      },
      include: {
        attendees: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(
      { success: true, meeting: activeMeeting, history },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
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

    if (!organizerId || typeof organizerId !== 'string' || organizerId.trim() === '') {
      return NextResponse.json({ success: false, error: 'Organizador não autenticado.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: organizerId.trim() },
      include: { companyRel: true }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
    }

    // Bloqueio se a empresa estiver suspensa
    if (user.role !== 'SUPER_ADMIN' && user.companyRel) {
      if (user.companyRel.status === 'SUSPENDED' || user.companyRel.status === 'BLOCKED') {
        return NextResponse.json(
          { success: false, error: '⛔ Sua empresa encontra-se com o acesso suspenso no DDS MASTER.' },
          { status: 403 }
        );
      }
    }

    // Encerra qualquer reunião anterior LIVE EXCLUSIVAMENTE deste organizador
    try {
      await prisma.meeting.updateMany({
        where: {
          status: 'LIVE',
          organizerId: user.id
        },
        data: { status: 'ENDED' }
      });
    } catch (e) {}

    // Cria a nova reunião isolada
    const newMeeting = await prisma.meeting.create({
      data: {
        topic: String(topic).trim(),
        farm: String(farm).trim(),
        type: type || 'PRESENTIAL',
        objective: objective ? String(objective).trim() : null,
        teamPhotos: teamPhotos ? JSON.stringify(teamPhotos) : null,
        status: 'LIVE',
        organizerId: user.id,
        companyId: user.companyId || null
      },
      include: { attendees: true }
    });

    return NextResponse.json({ success: true, meeting: newMeeting });
  } catch (error: any) {
    console.error("Erro ao criar reunião:", error);
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

// Exclusão em cascata completa do DDS e suas presenças
export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { meetingIds } = body;

    if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum DDS selecionado.' }, { status: 400 });
    }

    // 1. Apaga todas as presenças vinculadas aos DDSs selecionados
    await prisma.attendance.deleteMany({
      where: { meetingId: { in: meetingIds } }
    });

    // 2. Apaga os DDSs
    await prisma.meeting.deleteMany({
      where: { id: { in: meetingIds } }
    });

    return NextResponse.json({ success: true, message: 'DDSs e presenças excluídos permanentemente do banco de dados.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao excluir DDS' }, { status: 500 });
  }
}