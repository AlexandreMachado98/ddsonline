// app/api/planos-de-acao/[id]/prorrogacao/route.ts
// Gestão e Governança de Prorrogação de Prazos do Plano de Ação

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 1. POST: Solicitação formal de prorrogação pelo responsável
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
    const { requestedDueDate, justification, evidenceData } = body;

    if (!requestedDueDate) {
      return NextResponse.json({ success: false, error: 'A nova data de prazo é obrigatória.' }, { status: 400 });
    }

    if (!justification || justification.trim().length < 10) {
      return NextResponse.json({ success: false, error: 'A justificativa da prorrogação deve conter no mínimo 10 caracteres.' }, { status: 400 });
    }

    const plan = await prisma.actionPlan.findUnique({
      where: { id: actionPlanId },
      include: {
        supervisor: { select: { id: true } },
        creator: { select: { id: true } }
      }
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
    }

    if (authUser.role !== 'SUPER_ADMIN' && plan.companyId !== authUser.companyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    const currentDue = plan.dueDate || new Date();
    const newDueDateObj = new Date(requestedDueDate);

    if (newDueDateObj.getTime() <= currentDue.getTime()) {
      return NextResponse.json({ success: false, error: 'A nova data deve ser posterior ao prazo atual.' }, { status: 400 });
    }

    // Registra a solicitação de prorrogação
    const extension = await prisma.actionPlanDeadlineExtension.create({
      data: {
        actionPlanId,
        requesterId: authUser.id,
        currentDueDate: currentDue,
        requestedDueDate: newDueDateObj,
        justification: justification.trim(),
        evidenceData: evidenceData || null,
        status: 'PENDING'
      },
      include: {
        requester: { select: { id: true, name: true } }
      }
    });

    // Registra no histórico do plano
    await prisma.actionPlanHistory.create({
      data: {
        actionPlanId,
        userId: authUser.id,
        action: 'EXTENSION_REQUESTED',
        previousValue: currentDue.toISOString().slice(0, 10),
        newValue: newDueDateObj.toISOString().slice(0, 10),
        details: `Solicitação de prorrogação enviada por ${authUser.name}. Justificativa: "${justification.trim()}".`
      }
    });

    // Notifica supervisor ou criador do plano para aprovação
    const targetApproverId = plan.supervisorId || plan.creatorId;
    if (targetApproverId && targetApproverId !== authUser.id) {
      await prisma.actionPlanNotification.create({
        data: {
          actionPlanId,
          userId: targetApproverId,
          type: 'EXTENSION_REQUESTED',
          title: 'Solicitação de Prorrogação de Prazo',
          message: `${authUser.name} solicitou prorrogação de prazo para o plano ${plan.code} até ${newDueDateObj.toLocaleDateString('pt-BR')}.`
        }
      });
    }

    return NextResponse.json({ success: true, extension }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao solicitar prorrogação:', error);
    return NextResponse.json({ success: false, error: 'Falha ao processar solicitação de prorrogação' }, { status: 500 });
  }
}

// 2. PATCH: Aprovação ou Rejeição de Prorrogação por usuário autorizado
export async function PATCH(
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
    const { extensionId, approved, approvalNotes } = body;

    if (!extensionId || typeof approved !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Dados incompletos para decisão de prorrogação.' }, { status: 400 });
    }

    const extension = await prisma.actionPlanDeadlineExtension.findUnique({
      where: { id: extensionId },
      include: {
        actionPlan: true
      }
    });

    if (!extension || extension.actionPlanId !== actionPlanId) {
      return NextResponse.json({ success: false, error: 'Solicitação de prorrogação não encontrada.' }, { status: 404 });
    }

    const plan = extension.actionPlan;
    if (authUser.role !== 'SUPER_ADMIN' && plan.companyId !== authUser.companyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    // REGRA DE SEGURANÇA: O solicitante NÃO pode aprovar a própria prorrogação
    if (extension.requesterId === authUser.id && authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ 
        success: false, 
        error: 'Você não pode aprovar sua própria solicitação de prorrogação de prazo.' 
      }, { status: 403 });
    }

    const newStatus = approved ? 'APPROVED' : 'REJECTED';

    const result = await prisma.$transaction(async (tx) => {
      // Atualiza o registro da prorrogação
      const updatedExt = await tx.actionPlanDeadlineExtension.update({
        where: { id: extensionId },
        data: {
          status: newStatus,
          approverId: authUser.id,
          approvalNotes: approvalNotes?.trim() || null,
          approvedAt: new Date()
        },
        include: {
          requester: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } }
        }
      });

      // Se aprovado, atualiza o prazo no plano de ação principal
      if (approved) {
        // Se for a primeira prorrogação, preserva o originalDueDate
        const originalDue = plan.originalDueDate || plan.dueDate;
        await tx.actionPlan.update({
          where: { id: actionPlanId },
          data: {
            dueDate: extension.requestedDueDate,
            originalDueDate: originalDue
          }
        });
      }

      // Registra no histórico auditável
      await tx.actionPlanHistory.create({
        data: {
          actionPlanId,
          userId: authUser.id,
          action: approved ? 'EXTENSION_APPROVED' : 'EXTENSION_REJECTED',
          previousValue: extension.currentDueDate.toISOString().slice(0, 10),
          newValue: approved ? extension.requestedDueDate.toISOString().slice(0, 10) : extension.currentDueDate.toISOString().slice(0, 10),
          details: `Prorrogação de prazo ${approved ? 'APROVADA' : 'REJEITADA'} por ${authUser.name}. Novo prazo: ${new Date(extension.requestedDueDate).toLocaleDateString('pt-BR')}. Notas: "${approvalNotes || 'Sem observações'}".`
        }
      });

      // Notifica o solicitante sobre a decisão
      await tx.actionPlanNotification.create({
        data: {
          actionPlanId,
          userId: extension.requesterId,
          type: approved ? 'APPROVED' : 'RETURNED',
          title: `Prorrogação ${approved ? 'Aprovada' : 'Rejeitada'}`,
          message: `Sua solicitação de prorrogação para o plano ${plan.code} foi ${approved ? 'aprovada' : 'rejeitada'} por ${authUser.name}.`
        }
      });

      return updatedExt;
    });

    return NextResponse.json({ success: true, extension: result });
  } catch (error: any) {
    console.error('Erro ao aprovar/rejeitar prorrogação:', error);
    return NextResponse.json({ success: false, error: 'Falha ao processar decisão' }, { status: 500 });
  }
}
