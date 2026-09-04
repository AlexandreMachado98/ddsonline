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
          },
          organizer: {
            select: { name: true, position: true, company: true }
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
          },
          organizer: {
            select: { name: true, position: true, company: true }
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
    const { topic, farm, organizerId, email, groupPhoto, type, classification } = body;

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
        classification: classification || 'DDS',
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
    const { meetingId, organizerId, groupPhoto, status, createdAt, endedAt, instructorName, classification, objective } = body;

    if (meetingId) {
      const updateData: any = {};
      if (status) updateData.status = status;
      if (groupPhoto !== undefined) updateData.groupPhoto = groupPhoto;
      if (createdAt) updateData.createdAt = new Date(createdAt);
      if (endedAt !== undefined) updateData.endedAt = endedAt ? new Date(endedAt) : null;
      if (instructorName !== undefined) updateData.instructorName = instructorName;
      if (classification !== undefined) updateData.classification = classification;
      if (objective !== undefined) updateData.objective = objective;

      // Se nenhum status específico foi passado e não é apenas foto, o padrão é encerrar (ENDED)
      // Mas NÃO encerra se estamos apenas editando campos como instructorName/classification
      const isJustEditing = !status && groupPhoto === undefined && 
        (instructorName !== undefined || classification !== undefined || createdAt || endedAt !== undefined);
      if (!status && groupPhoto === undefined && !isJustEditing) {
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
// 4. DELETE: Exclui reuniões específicas
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { meetingIds } = body;

    if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum ID de reunião fornecido para exclusão' }, { status: 400 });
    }

    // Deleta primeiro as presenças (attendees) para evitar erro de chave estrangeira
    await prisma.attendance.deleteMany({
      where: {
        meetingId: { in: meetingIds }
      }
    });

    // Em seguida, deleta as reuniões
    await prisma.meeting.deleteMany({
      where: {
        id: { in: meetingIds }
      }
    });

    return NextResponse.json({ success: true, message: 'DDS excluído(s) com sucesso' });
  } catch (error) {
    console.error('Erro no DELETE /api/reuniao:', error);
    return NextResponse.json({ success: false, error: 'Erro ao excluir reuniões' }, { status: 500 });
  }
}
