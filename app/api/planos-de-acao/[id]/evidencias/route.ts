// app/api/planos-de-acao/[id]/evidencias/route.ts
// Gestão de Evidências Fotográficas (Antes, Durante, Depois, Complementar)

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { validateBase64Image } from '@/lib/fileValidation';

export const dynamic = 'force-dynamic';

// 1. POST: Upload de evidência fotográfica com validação por Magic Bytes
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const { id: actionPlanId } = params;
    const body = await req.json();
    const { 
      fileName, 
      displayName, 
      fileData, 
      mimeType, 
      fileSize, 
      caption, 
      evidenceType, 
      taskId, 
      notes 
    } = body;

    if (!fileData || typeof fileData !== 'string') {
      return NextResponse.json({ success: false, error: 'Dados da imagem são obrigatórios' }, { status: 400 });
    }

    // Validação estrita por Magic Bytes (JPEG/PNG/WebP, max 5MB)
    const validation = validateBase64Image(fileData, 5 * 1024 * 1024);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error || 'Formato de imagem inválido' }, { status: 400 });
    }

    const plan = await prisma.actionPlan.findUnique({
      where: { id: actionPlanId },
      select: { companyId: true, code: true }
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
    }

    if (authUser.role !== 'SUPER_ADMIN' && plan.companyId !== authUser.companyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    const validEvidenceType = ['BEFORE', 'DURING', 'AFTER', 'COMPLEMENTARY'].includes(evidenceType)
      ? evidenceType
      : 'COMPLEMENTARY';

    const attachment = await prisma.actionPlanAttachment.create({
      data: {
        actionPlanId,
        taskId: taskId || null,
        fileName: fileName?.trim() || `evidencia_${Date.now()}.${validation.detectedExt || 'jpg'}`,
        displayName: displayName?.trim() || caption?.trim() || 'Evidência Fotográfica',
        mimeType: validation.detectedMime || mimeType || 'image/jpeg',
        fileSize: fileSize || Math.ceil((fileData.length * 3) / 4),
        fileData,
        caption: caption?.trim() || null,
        evidenceType: validEvidenceType,
        authorId: authUser.id,
        notes: notes?.trim() || null
      },
      include: {
        author: { select: { id: true, name: true } }
      }
    });

    const typeLabels: Record<string, string> = {
      BEFORE: 'Antes da intervenção',
      DURING: 'Durante a execução',
      AFTER: 'Depois da intervenção',
      COMPLEMENTARY: 'Complementar'
    };

    await prisma.actionPlanHistory.create({
      data: {
        actionPlanId,
        userId: authUser.id,
        action: 'PHOTO_ADDED',
        details: `Evidência fotográfica (${typeLabels[validEvidenceType]}) adicionada por ${authUser.name}.`
      }
    });

    return NextResponse.json({ success: true, attachment }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao anexar evidência:', error);
    return NextResponse.json({ success: false, error: 'Falha ao processar upload de evidência' }, { status: 500 });
  }
}

// 2. DELETE: Remoção autorizada de evidência
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const { id: actionPlanId } = params;
    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json({ success: false, error: 'ID da evidência é obrigatório' }, { status: 400 });
    }

    const attachment = await prisma.actionPlanAttachment.findUnique({
      where: { id: attachmentId },
      include: { actionPlan: { select: { companyId: true, creatorId: true, responsibleId: true } } }
    });

    if (!attachment || attachment.actionPlanId !== actionPlanId) {
      return NextResponse.json({ success: false, error: 'Evidência não encontrada' }, { status: 404 });
    }

    if (authUser.role !== 'SUPER_ADMIN' && attachment.actionPlan?.companyId !== authUser.companyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    // Apenas quem enviou a foto, o criador do plano, o responsável ou administradores podem remover
    const canDelete = 
      authUser.role === 'SUPER_ADMIN' ||
      authUser.role === 'COMPANY_ADMIN' ||
      attachment.authorId === authUser.id ||
      attachment.actionPlan?.creatorId === authUser.id;

    if (!canDelete) {
      return NextResponse.json({ 
        success: false, 
        error: 'Sem autorização para remover esta evidência. Apenas o autor do envio ou administradores podem excluí-la.' 
      }, { status: 403 });
    }

    await prisma.actionPlanAttachment.delete({ where: { id: attachmentId } });

    await prisma.actionPlanHistory.create({
      data: {
        actionPlanId,
        userId: authUser.id,
        action: 'PHOTO_REMOVED',
        details: `Evidência fotográfica "${attachment.displayName || attachment.fileName}" removida por ${authUser.name}.`
      }
    });

    return NextResponse.json({ success: true, message: 'Evidência removida com sucesso' });
  } catch (error: any) {
    console.error('Erro ao remover evidência:', error);
    return NextResponse.json({ success: false, error: 'Falha ao remover evidência' }, { status: 500 });
  }
}
