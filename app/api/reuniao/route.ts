import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 1. GET: Busca reunião por ID específico ou busca reunião e histórico ISOLADOS do organizador
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const organizerId = searchParams.get('organizerId');
    const email = searchParams.get('email')?.trim().toLowerCase();

    // Cenário A: Colaborador acessando reunião específica pelo ID do link
    if (id) {
      const meeting = await prisma.meeting.findUnique({
        where: { id },
        include: {
          attendees: {
            orderBy: { createdAt: 'desc' }
          },
          organizer: {
            select: { name: true, position: true, company: true }
          }
        }
      });
      return NextResponse.json({ success: true, meeting });
    }

    // Cenário B: Painel Admin do Organizador buscando seus próprios DDS
    if (organizerId || email) {
      const whereOrganizer = organizerId 
        ? { organizerId } 
        : { organizer: { email: email } };

      const meeting = await prisma.meeting.findFirst({
        where: {
          status: 'LIVE',
          ...whereOrganizer
        },
        include: {
          attendees: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      const history = await prisma.meeting.findMany({
        where: {
          status: 'ENDED',
          ...whereOrganizer
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          attendees: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      return NextResponse.json({ success: true, meeting, history });
    }

    // Cenário C: Acesso sem identificador - Retorna vazio para não vazar reuniões de outros usuários
    return NextResponse.json({ success: true, meeting: null, history: [] });
  } catch (error) {
    console.error("Erro no GET /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao buscar dados da reunião' }, { status: 500 });
  }
}

// 2. POST: Abre uma nova sala de DDS vinculada estritamente ao organizador
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, farm, organizerId, email, groupPhoto, type } = body;

    let user = null;

    if (organizerId) {
      user = await prisma.user.findUnique({ where: { id: organizerId } });
    }
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    }

    // Se o usuário ainda não existir no banco, cria o usuário padrão
    if (!user && email) {
      user = await prisma.user.create({
        data: {
          email: email.trim().toLowerCase(),
          name: email.split('@')[0],
          password: 'demo',
          role: 'ORGANIZER'
        }
      });
    }

    // Encerra apenas as reuniões antigas DESTE organizador específico
    if (user) {
      await prisma.meeting.updateMany({
        where: {
          status: 'LIVE',
          organizerId: user.id
        },
        data: { status: 'ENDED' }
      });
    }

    // Cria a nova sala com identificação, tipo, isolamento e foto em grupo
    const newMeeting = await prisma.meeting.create({
      data: {
        topic: topic || 'DDS de Segurança',
        farm: farm || 'Unidade Rural',
        type: type || 'REMOTE',
        status: 'LIVE',
        organizerId: user ? user.id : null,
        companyId: user?.companyId || null,
        groupPhoto: groupPhoto || null
      },
      include: {
        attendees: true
      }
    });
    
    return NextResponse.json({ success: true, meeting: newMeeting });
  } catch (error) {
    console.error("Erro no POST /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao criar nova reunião: ' + ((error as any).message || error) }, { status: 500 });
  }
}

// 3. PUT: Atualiza a reunião (anexa foto em grupo ou encerra a reunião)
export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { meetingId, organizerId, groupPhoto, status } = body;

    if (meetingId) {
      const updateData: any = {};
      if (status) updateData.status = status;
      if (groupPhoto !== undefined) updateData.groupPhoto = groupPhoto;

      // Se nenhum status específico foi passado e não é apenas foto, o padrão é encerrar (ENDED)
      if (!status && groupPhoto === undefined) {
        updateData.status = 'ENDED';
      }

      const updated = await prisma.meeting.update({
        where: { id: meetingId },
        data: updateData
      });

      return NextResponse.json({ success: true, meeting: updated, message: 'DDS atualizado com sucesso' });
    } else if (organizerId) {
      await prisma.meeting.updateMany({
        where: { status: 'LIVE', organizerId },
        data: { status: 'ENDED' }
      });
    } else {
      await prisma.meeting.updateMany({
        where: { status: 'LIVE' },
        data: { status: 'ENDED' }
      });
    }

    return NextResponse.json({ success: true, message: 'DDS encerrado com sucesso' });
  } catch (error) {
    console.error("Erro no PUT /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao atualizar reunião' }, { status: 500 });
  }
}