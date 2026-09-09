// app/api/reuniao/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser, logSecurityEvent } from '@/lib/auth';
import { purgeExpiredOperationalData, purgeMeetingOperationalDataImmediate } from '@/lib/retention';

export const dynamic = 'force-dynamic';

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
    await prisma.$executeRawUnsafe('ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "documentHash" TEXT;');
    
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

// 1. GET: Busca reunião por ID específico ou busca reunião e histórico do organizador autenticado
export async function GET(req: Request) {
  try {
    await ensureDbColumns();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const attachmentId = searchParams.get('attachmentId');
    const isFull = searchParams.get('full') === 'true' || searchParams.get('includeFiles') === 'true';

    // Cenário 0: Download sob demanda de um anexo específico
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

    // Cenário A: Acesso a uma reunião específica por ID
    if (id) {
      // Se solicitado modo full (para gerar PDF com assinaturas e anexos)
      if (isFull) {
        const sessionUser = await getAuthenticatedUser(req);
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

        if (!meeting) {
          return NextResponse.json({ success: false, error: 'Reunião não encontrada' }, { status: 404 });
        }

        // Proteção IDOR: Apenas o organizador dono da reunião ou Super Admin pode ver dados completos
        const isOwner = sessionUser && (sessionUser.id === meeting.organizerId || sessionUser.role === 'SUPER_ADMIN');
        if (!isOwner) {
          logSecurityEvent('FORBIDDEN_ACCESS', {
            userId: sessionUser?.id,
            path: `/api/reuniao?id=${id}&full=true`,
            reason: 'IDOR_PREVENTED_ON_FULL_MEETING'
          });
          return NextResponse.json({ 
            success: false, 
            error: 'Acesso restrito: somente o organizador responsável pode carregar a ata completa com dados operacionais.' 
          }, { status: 403 });
        }

        return NextResponse.json({ success: true, meeting });
      }

      // Projeção ultraleve para participantes (QR Code / tela do colaborador):
      // Protege privacidade: omite selfies, assinaturas e arquivos pesados dos outros colaboradores
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
          documentHash: true,
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
              fileData: true,
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

    // Cenário B: Painel Admin do Organizador buscando suas reuniões e histórico
    // AUTORIZAÇÃO BASEADA EM SESSÃO: Valida usuário autenticado no servidor
    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      return NextResponse.json({ 
        success: false, 
        error: 'Sessão inválida ou expirada. Faça login novamente.',
        meeting: null, 
        history: [] 
      }, { status: 401 });
    }

    // Executa purga automática de dados operacionais expirados deste organizador
    purgeExpiredOperationalData(sessionUser.id).catch(() => {});

    // Polling padrão da reunião ativa do organizador autenticado
    const activeMeeting = await prisma.meeting.findFirst({
      where: {
        status: 'LIVE',
        organizerId: sessionUser.id
      },
      select: {
        id: true,
        topic: true,
        farm: true,
        type: true,
        classification: true,
        objective: true,
        programmaticContent: true,
        groupPhoto: true,
        status: true,
        documentHash: true,
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
            selfie: true,
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
        organizerId: sessionUser.id
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
        documentHash: true,
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

    return NextResponse.json({ success: true, meeting: activeMeeting, history });

  } catch (error) {
    console.error("Erro no GET /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao buscar dados da reunião' }, { status: 500 });
  }
}

// 2. POST: Abre uma nova sala de DDS vinculada estritamente ao organizador autenticado
export async function POST(req: Request) {
  try {
    await ensureDbColumns();

    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', { path: 'POST /api/reuniao', reason: 'NO_SESSION' });
      return NextResponse.json({ success: false, error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { topic, farm, groupPhoto, type, classification, objective, programmaticContent, attachments } = body;

    // Encerra apenas as reuniões ativas deste organizador autenticado
    await prisma.meeting.updateMany({
      where: {
        status: 'LIVE',
        organizerId: sessionUser.id
      },
      data: { status: 'ENDED' }
    });

    // Sanitização e Whitelist dos Anexos
    const sanitizedAttachments = Array.isArray(attachments)
      ? attachments.slice(0, 10).map((att: any, idx: number) => ({
          fileName: String(att.fileName || `anexo_${idx+1}`).slice(0, 100),
          displayName: String(att.displayName || att.fileName || `Anexo ${idx+1}`).slice(0, 100),
          description: att.description ? String(att.description).slice(0, 500) : null,
          mimeType: String(att.mimeType || 'application/pdf').slice(0, 50),
          fileSize: Number(att.fileSize) || 0,
          fileData: typeof att.fileData === 'string' ? att.fileData : '',
          pageCount: Number(att.pageCount) || 1,
          order: typeof att.order === 'number' ? att.order : idx
        }))
      : [];

    const newMeeting = await prisma.meeting.create({
      data: {
        topic: String(topic || 'DDS de Segurança').slice(0, 200).trim(),
        farm: String(farm || 'Unidade Operacional').slice(0, 150).trim(),
        type: type === 'REMOTE' ? 'REMOTE' : 'PRESENTIAL',
        classification: classification === 'Treinamento' ? 'Treinamento' : 'DDS',
        objective: objective ? String(objective).slice(0, 1000).trim() : null,
        programmaticContent: programmaticContent ? String(programmaticContent).slice(0, 3000).trim() : null,
        status: 'LIVE',
        organizerId: sessionUser.id,
        companyId: sessionUser.companyId || null,
        groupPhoto: typeof groupPhoto === 'string' && groupPhoto.length > 50 ? groupPhoto : null,
        attachments: sanitizedAttachments.length > 0 ? {
          create: sanitizedAttachments
        } : undefined
      },
      include: {
        attendees: true,
        attachments: {
          orderBy: { order: 'asc' }
        }
      }
    });

    logSecurityEvent('ADMIN_ACTION', {
      userId: sessionUser.id,
      reason: `MEETING_CREATED: ${newMeeting.id} (${newMeeting.topic})`
    });

    return NextResponse.json({ success: true, meeting: newMeeting });

  } catch (error) {
    console.error("Erro no POST /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao criar nova reunião' }, { status: 500 });
  }
}

// 3. PUT: Atualiza a reunião (anexa foto em grupo, sincroniza anexos ou encerra a reunião com congelamento SHA-256)
export async function PUT(req: Request) {
  try {
    await ensureDbColumns();

    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', { path: 'PUT /api/reuniao', reason: 'NO_SESSION' });
      return NextResponse.json({ success: false, error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { 
      action, meetingId, groupPhoto, status, createdAt, endedAt, 
      instructorName, classification, objective, programmaticContent, attachments 
    } = body;

    // --- RECURSO: PURGA MANUAL IMEDIATA SOB DEMANDA ---
    if (action === 'purge_operational_data' && meetingId) {
      const purged = await purgeMeetingOperationalDataImmediate(meetingId, sessionUser.id);
      if (purged) {
        return NextResponse.json({ success: true, message: 'Dados operacionais (fotos e assinaturas) purgados com sucesso da nuvem.' });
      }
      return NextResponse.json({ success: false, error: 'Reunião não elegível para purga ou não autorizada.' }, { status: 400 });
    }

    if (!meetingId) {
      // Encerra reuniões ativas do próprio usuário
      await prisma.meeting.updateMany({
        where: { status: 'LIVE', organizerId: sessionUser.id },
        data: { status: 'ENDED' }
      });
      return NextResponse.json({ success: true, message: 'DDS encerrado com sucesso' });
    }

    // PROTEÇÃO IDOR: Confirma se a reunião pertence ao organizador autenticado
    const existingMeeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        attendees: { select: { id: true, name: true, cpf: true, createdAt: true } },
        attachments: { select: { id: true, fileName: true, fileSize: true, fileData: true } }
      }
    });

    if (!existingMeeting) {
      return NextResponse.json({ success: false, error: 'Reunião não encontrada' }, { status: 404 });
    }

    const isAuthorized = existingMeeting.organizerId === sessionUser.id || sessionUser.role === 'SUPER_ADMIN';
    if (!isAuthorized) {
      logSecurityEvent('FORBIDDEN_ACCESS', {
        userId: sessionUser.id,
        path: `PUT /api/reuniao (${meetingId})`,
        reason: 'IDOR_ATTEMPT_ON_UPDATE'
      });
      return NextResponse.json({ success: false, error: 'Você não tem permissão para alterar esta reunião.' }, { status: 403 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (groupPhoto !== undefined) updateData.groupPhoto = groupPhoto;
    if (createdAt) updateData.createdAt = new Date(createdAt);
    if (endedAt !== undefined) updateData.endedAt = endedAt ? new Date(endedAt) : null;
    if (instructorName !== undefined) updateData.instructorName = instructorName;
    if (classification !== undefined) updateData.classification = classification;
    if (objective !== undefined) updateData.objective = objective ? String(objective).slice(0, 1000).trim() : null;
    if (programmaticContent !== undefined) {
      updateData.programmaticContent = programmaticContent ? String(programmaticContent).slice(0, 3000).trim() : null;
    }

    // Se nenhum status específico foi passado e não é apenas foto/anexos, o padrão é encerrar (ENDED)
    const isJustEditing = !status && groupPhoto === undefined && attachments === undefined && 
      (instructorName !== undefined || classification !== undefined || objective !== undefined || programmaticContent !== undefined || createdAt || endedAt !== undefined);
    if (!status && groupPhoto === undefined && attachments === undefined && !isJustEditing) {
      updateData.status = 'ENDED';
    }

    // Ao encerrar o DDS, gera e congela o hash SHA-256 de integridade documental
    if (status === 'ENDED' || updateData.status === 'ENDED') {
      const crypto = await import('crypto');
      const endTimestamp = updateData.endedAt ? new Date(updateData.endedAt).toISOString() : new Date().toISOString();
      const rawDigest = [
        meetingId,
        existingMeeting.topic || '',
        existingMeeting.createdAt?.toISOString() || '',
        endTimestamp,
        existingMeeting.attendees?.map(a => `${a.id}:${a.name}:${a.cpf}`).join(';') || '',
        existingMeeting.attachments?.map(att => `${att.id}:${att.fileName}`).join(';') || ''
      ].join('|');
      
      updateData.documentHash = crypto.createHash('sha256').update(rawDigest).digest('hex');
      if (!updateData.endedAt) updateData.endedAt = new Date();
    }

    // Sincroniza anexos se fornecidos preservando fileData se já existirem
    if (Array.isArray(attachments)) {
      const existingMap = new Map(existingMeeting.attachments.map(a => [a.id, a.fileData]));

      await prisma.meetingAttachment.deleteMany({
        where: { meetingId }
      });
      if (attachments.length > 0) {
        await prisma.meetingAttachment.createMany({
          data: attachments.slice(0, 10).map((att: any, idx: number) => ({
            id: att.id && !att.id.startsWith('local_') ? att.id : undefined,
            meetingId,
            fileName: String(att.fileName || `anexo_${idx+1}`).slice(0, 100),
            displayName: String(att.displayName || att.fileName || `Anexo ${idx+1}`).slice(0, 100),
            description: att.description ? String(att.description).slice(0, 500).trim() : null,
            mimeType: String(att.mimeType || 'application/pdf').slice(0, 50),
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

    logSecurityEvent('ADMIN_ACTION', {
      userId: sessionUser.id,
      reason: `MEETING_UPDATED: ${meetingId} (Status: ${updated.status})`
    });

    return NextResponse.json({ success: true, meeting: updated, message: 'DDS atualizado com sucesso' });

  } catch (error) {
    console.error("Erro no PUT /api/reuniao:", error);
    return NextResponse.json({ success: false, error: 'Erro ao atualizar reunião' }, { status: 500 });
  }
}

// 4. DELETE: Exclui reuniões específicas (Com proteção estrita de autorização IDOR)
export async function DELETE(req: Request) {
  try {
    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', { path: 'DELETE /api/reuniao', reason: 'NO_SESSION' });
      return NextResponse.json({ success: false, error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { meetingIds } = body;

    if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum ID de reunião fornecido para exclusão' }, { status: 400 });
    }

    // Filtra para garantir que o usuário só consiga deletar reuniões das quais é DONO
    const meetingsToDelete = await prisma.meeting.findMany({
      where: {
        id: { in: meetingIds },
        ...(sessionUser.role === 'SUPER_ADMIN' ? {} : { organizerId: sessionUser.id })
      },
      select: { id: true }
    });

    const authorizedIds = meetingsToDelete.map(m => m.id);

    if (authorizedIds.length === 0) {
      logSecurityEvent('FORBIDDEN_ACCESS', {
        userId: sessionUser.id,
        path: 'DELETE /api/reuniao',
        reason: 'IDOR_ATTEMPT_ON_DELETE'
      });
      return NextResponse.json({ success: false, error: 'Nenhuma reunião elegível ou autorizada para exclusão.' }, { status: 403 });
    }

    // Deleta anexos vinculados
    await prisma.meetingAttachment.deleteMany({
      where: { meetingId: { in: authorizedIds } }
    }).catch(() => {});

    // Deleta presenças (attendees)
    await prisma.attendance.deleteMany({
      where: { meetingId: { in: authorizedIds } }
    });

    // Deleta as reuniões autorizadas
    await prisma.meeting.deleteMany({
      where: { id: { in: authorizedIds } }
    });

    logSecurityEvent('ADMIN_ACTION', {
      userId: sessionUser.id,
      reason: `MEETINGS_DELETED: ${authorizedIds.join(',')}`
    });

    return NextResponse.json({ 
      success: true, 
      message: `${authorizedIds.length} DDS excluído(s) com sucesso.` 
    });

  } catch (error) {
    console.error('Erro no DELETE /api/reuniao:', error);
    return NextResponse.json({ success: false, error: 'Erro ao excluir reuniões' }, { status: 500 });
  }
}
