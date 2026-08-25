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

    // 1. ROTA DO COLABORADOR: Verifica o status do link
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

    // 2. ROTA DO ADMIN: Validação estrita do Organizador (Evita Flash de Reuniões Fantasmas)
    let validUserId: string | null = null;
    let userCompanyId: string | null = null;

    if (organizerId && organizerId !== 'undefined' && organizerId !== 'null' && organizerId.trim() !== '') {
      const user = await prisma.user.findUnique({
        where: { id: organizerId.trim() },
        select: { id: true, companyId: true, role: true }
      });
      if (user) {
        validUserId = user.id;
        userCompanyId = user.companyId;
      }
    }

    // Se o ID do usuário não for válido, não retorna reuniões aleatórias de outros técnicos
    if (!validUserId) {
      return NextResponse.json({ success: true, meeting: null, history: [] });
    }

    // Filtro estrito: Apenas reuniões deste organizador ou de sua empresa
    const ownerFilter: any = userCompanyId 
      ? { OR: [{ organizerId: validUserId }, { companyId: userCompanyId }] }
      : { organizerId: validUserId };

    // Auto-encerra reuniões LIVE abandonadas com mais de 24 horas
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.meeting.updateMany({
      where: {
        status: 'LIVE',
        ...ownerFilter,
        createdAt: { lt: oneDayAgo }
      },
      data: { status: 'ENDED' }
    });

    // Busca a reunião ativa legítima
    const activeMeeting = await prisma.meeting.findFirst({
      where: {
        status: 'LIVE',
        ...ownerFilter
      },
      include: {
        attendees: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filtros de Data para o Histórico
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);

    const meetingWhere: any = {
      status: 'ENDED',
      ...ownerFilter,
      ...(startDate || endDate ? { createdAt: dateFilter } : {})
    };

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

    let validOrganizerId: string | null = null;
    let resolvedCompanyId: string | null = null;

    if (organizerId && typeof organizerId === 'string' && organizerId.trim() !== '') {
      const user = await prisma.user.findUnique({
        where: { id: organizerId.trim() },
        include: { companyRel: true }
      });

      if (user) {
        if (user.role !== 'SUPER_ADMIN' && user.companyRel) {
          if (user.companyRel.status === 'SUSPENDED' || user.companyRel.status === 'BLOCKED') {
            return NextResponse.json(
              { success: false, error: '⛔ Sua empresa encontra-se com o acesso suspenso no DDS MASTER.' },
              { status: 403 }
            );
          }
        }
        validOrganizerId = user.id;
        resolvedCompanyId = user.companyId || null;
      }
    }

    if (!validOrganizerId) {
      const defaultUser = await prisma.user.findFirst({
        where: { status: 'ACTIVE' }
      });
      if (defaultUser) {
        validOrganizerId = defaultUser.id;
        resolvedCompanyId = defaultUser.companyId || null;
      }
    }

    // Encerra qualquer reunião anterior LIVE antes de abrir a nova
    try {
      await prisma.meeting.updateMany({
        where: {
          status: 'LIVE',
          ...(validOrganizerId ? { organizerId: validOrganizerId } : {})
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
        organizerId: validOrganizerId,
        companyId: resolvedCompanyId
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

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { meetingIds } = body;

    if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum DDS selecionado.' }, { status: 400 });
    }

    await prisma.attendance.deleteMany({
      where: { meetingId: { in: meetingIds } }
    });

    await prisma.meeting.deleteMany({
      where: { id: { in: meetingIds } }
    });

    return NextResponse.json({ success: true, message: 'Excluído com sucesso.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao excluir DDS' }, { status: 500 });
  }
}