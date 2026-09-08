import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

let dbInitialized = false;
async function ensureDbColumns() {
  if (dbInitialized) return;
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "objective" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "programmaticContent" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "instructorName" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "classification" TEXT DEFAULT \'DDS\';');
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "groupPhoto" TEXT;');
    
    // Cria tabela de anexos e evidências se não existir
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MeetingAttachment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "meetingId" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "displayName" TEXT,
        "description" TEXT,
        "mimeType" TEXT NOT NULL,
        "fileSize" INTEGER NOT NULL,
        "fileData" TEXT NOT NULL,
        "pageCount" INTEGER DEFAULT 1,
        "order" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MeetingAttachment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingAttachment_meetingId_idx" ON "MeetingAttachment"("meetingId");`);
    
    dbInitialized = true;
  } catch (e) {
    console.error("ensureDbColumns error:", e);
  }
}

// 1. GET: Busca reunião por ID específico ou busca reunião e histórico ISOLADOS do organizador
export async function GET(req: Request) {
  try {
    await ensureDbColumns();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const attachmentId = searchParams.get('attachmentId');
    const organizerId = searchParams.get('organizerId');
    const email = searchParams.get('email')?.trim().toLowerCase();
    const isFull = searchParams.get('full') === 'true' || searchParams.get('includeFiles') === 'true';

    // Cenário 0: Download sob demanda de um anexo específico (evita transferir megabytes em polling)
    if (attachmentId) {
      const attachment = await prisma.meetingAttachment.findUnique({
        where: { id: attachmentId },
        select: {
          id: true,
          meetingId: true,
          fileName: true,
          displayName: true,
          description: true,
          mimeType: true,
          fileSize: true,
          fileData: true,
          pageCount: true,
          order: true
        }
      });
      if (!attachment) {
        return NextResponse.json({ success: false, error: 'Anexo não encontrado' }, { status: 404 });
      }
      return NextResponse.json({ success: true, attachment });
    }

    // Cenário A: Colaborador acessando reunião específica ou visualização completa com 'full=true'
    if (id) {
      if (isFull) {
        // Carga completa sob demanda (para gerar PDF de Ata Oficial ou Abrir Prévia Completa)
        const meeting = await prisma.meeting.findUnique({
          where: { id },
          include: {
            attendees: {
              orderBy: { createdAt: 'desc' }
            },
            attachments: {
              orderBy: { order: 'asc' }
            },
            organizer: {
              select: { name: true, position: true, company: true }
            }
          }
        });
        return NextResponse.json({ success: true, meeting });
      }

      // Projeção ultraleve para polling da sala de DDS (evita transferir selfies, assinaturas e PDFs a cada 20s)
      const meeting = await prisma.meeting.findUnique({
        where: { id },
        select: {
          id: true,
          topic: true,
          farm: true,
          type: true,
          classification: true,
          objective: true,
          programmaticContent: true,
          status: true,
          createdAt: true,
          endedAt: true,
          instructorName: true,
          organizerId: true,
          companyId: true,
          organizer: {
            select: { name: true, position: true, company: true }
          },
          attendees: {
            select: {
              id: true,
              name: true,
              cpf: true,
              createdAt: true,
              leftAt: true,
              exitReason: true
            },
            orderBy: { createdAt: 'desc' }
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              displayName: true,
              description: true,
              mimeType: true,
              fileSize: true,
              pageCount: true,
              order: true,
              createdAt: true
            },
            orderBy: { order: 'asc' }
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

      // Se solicitado modo full para o admin (sob demanda)
      if (isFull) {
        const meeting = await prisma.meeting.findFirst({
          where: {
            status: 'LIVE',
            ...whereOrganizer
          },
          include: {
            attendees: {
              orderBy: { createdAt: 'desc' }
            },
            attachments: {
              orderBy: { order: 'asc' }
            },
            organizer: {
              select: { name: true, position: true, company: true }
            }
          }
        });
        return NextResponse.json({ success: true, meeting });
      }

      // Polling padrão: Projeção ultraleve (reduz payload de ~30MB para ~15KB)
      const meeting = await prisma.meeting.findFirst({
        where: {
          status: 'LIVE',
          ...whereOrganizer
        },
        select: {
          id: true,
          topic: true,
          farm: true,
          type: true,
          classification: true,
          objective: true,
          programmaticContent: true,
          groupPhoto: true, // Necessário apenas na reunião ativa
          status: true,
          createdAt: true,
          endedAt: true,
          instructorName: true,
          organizerId: true,
          companyId: true,
          organizer: {
            select: { name: true, position: true, company: true }
          },
          attendees: {
            select: {
              id: true,
              name: true,
              cpf: true,
              selfie: true, // Necessário para o avatar do card ao vivo
              createdAt: true,
              leftAt: true,
              exitReason: true
            },
            orderBy: { createdAt: 'desc' }
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              displayName: true,
              description: true,
              mimeType: true,
              fileSize: true,
              pageCount: true,
              order: true,
              createdAt: true
            },
            orderBy: { order: 'asc' }
          }
        }
      });

      // Histórico de DDS concluídos: Omite estritamente groupPhoto, assinaturas e fileData pesados
      const history = await prisma.meeting.findMany({
        where: {
          status: 'ENDED',
          ...whereOrganizer
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          topic: true,
          farm: true,
          type: true,
          classification: true,
          objective: true,
          programmaticContent: true,
          status: true,
          createdAt: true,
          endedAt: true,
          instructorName: true,
          organizerId: true,
          companyId: true,
          organizer: {
            select: { name: true, position: true, company: true }
          },
          attendees: {
            select: {
              id: true,
              name: true,
              cpf: true,
              createdAt: true,
              leftAt: true,
              exitReason: true
            },
            orderBy: { createdAt: 'asc' }
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              displayName: true,
              description: true,
              mimeType: true,
              fileSize: true,
              pageCount: true,
              order: true,
              createdAt: true
            },
            orderBy: { order: 'asc' }
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
    await ensureDbColumns();
    const body = await req.json();
    const { topic, farm, organizerId, email, groupPhoto, type, classification, objective, programmaticContent, attachments } = body;

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

    // Cria a nova sala com identificação, tipo, isolamento, foto em grupo e anexos
    const newMeeting = await prisma.meeting.create({
      data: {
        topic: topic || 'DDS de Segurança',
        farm: farm || 'Unidade Rural',
        type: type || 'REMOTE',
        classification: classification || 'DDS',
        objective: objective ? objective.trim() : null,
        programmaticContent: programmaticContent ? programmaticContent.trim() : null,
        status: 'LIVE',
        organizerId: user ? user.id : null,
        companyId: user?.companyId || null,
        groupPhoto: groupPhoto || null,
        attachments: Array.isArray(attachments) && attachments.length > 0 ? {
          create: attachments.map((att: any, idx: number) => ({
            fileName: att.fileName || `anexo_${idx+1}`,
            displayName: att.displayName || att.fileName || `Anexo ${idx+1}`,
            description: att.description ? String(att.description).trim() : null,
            mimeType: att.mimeType || 'application/pdf',
            fileSize: Number(att.fileSize) || 0,
            fileData: att.fileData || '',
            pageCount: Number(att.pageCount) || 1,
            order: typeof att.order === 'number' ? att.order : idx
          }))
        } : undefined
      },
      include: {
        attendees: true,
        attachments: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    return NextResponse.json({ success: true, meeting: newMeeting });
  } catch (error) {
    console.error("Erro no POST /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao criar nova reunião: ' + ((error as any).message || error) }, { status: 500 });
  }
}

// 3. PUT: Atualiza a reunião (anexa foto em grupo, sincroniza anexos ou encerra a reunião)
export async function PUT(req: Request) {
  try {
    await ensureDbColumns();
    const body = await req.json().catch(() => ({}));
    const { 
      meetingId, organizerId, groupPhoto, status, createdAt, endedAt, 
      instructorName, classification, objective, programmaticContent, attachments 
    } = body;

    if (meetingId) {
      const updateData: any = {};
      if (status) updateData.status = status;
      if (groupPhoto !== undefined) updateData.groupPhoto = groupPhoto;
      if (createdAt) updateData.createdAt = new Date(createdAt);
      if (endedAt !== undefined) updateData.endedAt = endedAt ? new Date(endedAt) : null;
      if (instructorName !== undefined) updateData.instructorName = instructorName;
      if (classification !== undefined) updateData.classification = classification;
      if (objective !== undefined) updateData.objective = objective ? objective.trim() : null;
      if (programmaticContent !== undefined) {
        updateData.programmaticContent = programmaticContent ? programmaticContent.trim() : null;
      }

      // Se nenhum status específico foi passado e não é apenas foto/anexos, o padrão é encerrar (ENDED)
      const isJustEditing = !status && groupPhoto === undefined && attachments === undefined && 
        (instructorName !== undefined || classification !== undefined || objective !== undefined || programmaticContent !== undefined || createdAt || endedAt !== undefined);
      if (!status && groupPhoto === undefined && attachments === undefined && !isJustEditing) {
        updateData.status = 'ENDED';
      }

      // Sincroniza anexos se fornecidos preservando fileData se já existirem
      if (Array.isArray(attachments)) {
        const existingAttachments = await prisma.meetingAttachment.findMany({
          where: { meetingId },
          select: { id: true, fileData: true }
        });
        const existingMap = new Map(existingAttachments.map(a => [a.id, a.fileData]));

        await prisma.meetingAttachment.deleteMany({
          where: { meetingId }
        });
        if (attachments.length > 0) {
          await prisma.meetingAttachment.createMany({
            data: attachments.map((att: any, idx: number) => ({
              id: att.id && !att.id.startsWith('local_') ? att.id : undefined,
              meetingId,
              fileName: att.fileName || `anexo_${idx+1}`,
              displayName: att.displayName || att.fileName || `Anexo ${idx+1}`,
              description: att.description ? String(att.description).trim() : null,
              mimeType: att.mimeType || 'application/pdf',
              fileSize: Number(att.fileSize) || 0,
              fileData: att.fileData || (att.id ? existingMap.get(att.id) || '' : ''),
              pageCount: Number(att.pageCount) || 1,
              order: typeof att.order === 'number' ? att.order : idx
            }))
          });
        }
      }

      const updated = await prisma.meeting.update({
        where: { id: meetingId },
        data: updateData,
        include: {
          attendees: {
            orderBy: { createdAt: 'desc' }
          },
          attachments: {
            orderBy: { order: 'asc' }
          },
          organizer: {
            select: { name: true, position: true, company: true }
          }
        }
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

    // Deleta anexos vinculados
    await prisma.meetingAttachment.deleteMany({
      where: {
        meetingId: { in: meetingIds }
      }
    }).catch(() => {});

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
