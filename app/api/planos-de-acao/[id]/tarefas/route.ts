// app/api/planos-de-acao/[id]/tarefas/route.ts
// Gestão de Subações e Etapas Executivas do Plano de Ação

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { resolveUserCompanyId } from '@/lib/actionPlanServer';
import { ActionPlanStatus } from '@/lib/actionPlanUtils';

export const dynamic = 'force-dynamic';

// 1. POST: Criação de nova subação
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
    const { description, responsibleId, dueDate, weight, notes } = body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Descrição da etapa é obrigatória' }, { status: 400 });
    }

    const plan = await prisma.actionPlan.findUnique({
      where: { id: actionPlanId },
      include: { tasks: { select: { position: true }, orderBy: { position: 'desc' }, take: 1 } }
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
    }

    const effectiveCompanyId = await resolveUserCompanyId(authUser);
    if (authUser.role !== 'SUPER_ADMIN' && plan.companyId !== effectiveCompanyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    const nextPosition = plan.tasks.length > 0 ? (plan.tasks[0].position + 1) : 0;

    const newTask = await prisma.actionPlanTask.create({
      data: {
        actionPlanId,
        description: description.trim(),
        responsibleId: responsibleId || plan.responsibleId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        weight: weight ? Math.max(1, parseInt(weight, 10)) : 1,
        position: nextPosition,
        status: 'OPEN',
        notes: notes?.trim() || null
      },
      include: {
        responsible: { select: { id: true, name: true } }
      }
    });

    await prisma.actionPlanHistory.create({
      data: {
        actionPlanId,
        userId: authUser.id,
        action: 'EDITED',
        details: `Subação adicionada: "${newTask.description}" por ${authUser.name}.`
      }
    });

    return NextResponse.json({ success: true, task: newTask }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao adicionar subação:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar subação' }, { status: 500 });
  }
}

// 2. PUT: Atualização de subação existente (andamento, conclusão, status, notas)
export async function PUT(
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
    const { taskId, description, responsibleId, dueDate, status, weight, notes } = body;

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'ID da subação é obrigatório' }, { status: 400 });
    }

    const task = await prisma.actionPlanTask.findUnique({
      where: { id: taskId },
      include: { actionPlan: { select: { companyId: true } } }
    });

    if (!task || task.actionPlanId !== actionPlanId) {
      return NextResponse.json({ success: false, error: 'Subação não encontrada' }, { status: 404 });
    }

    const effectiveCompanyId = await resolveUserCompanyId(authUser);
    if (authUser.role !== 'SUPER_ADMIN' && task.actionPlan.companyId !== effectiveCompanyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    const updateData: any = {};
    if (description !== undefined) updateData.description = description.trim();
    if (responsibleId !== undefined) updateData.responsibleId = responsibleId || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (weight !== undefined) updateData.weight = Math.max(1, parseInt(weight, 10));
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    if (status !== undefined && status !== task.status) {
      updateData.status = status as ActionPlanStatus;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }

    const updatedTask = await prisma.actionPlanTask.update({
      where: { id: taskId },
      data: updateData,
      include: { responsible: { select: { id: true, name: true } } }
    });

    if (status && status !== task.status) {
      await prisma.actionPlanHistory.create({
        data: {
          actionPlanId,
          userId: authUser.id,
          action: 'STATUS_CHANGED',
          previousValue: task.status,
          newValue: status,
          details: `Etapa "${task.description}" atualizada para ${status} por ${authUser.name}.`
        }
      });
    }

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error: any) {
    console.error('Erro ao atualizar subação:', error);
    return NextResponse.json({ success: false, error: 'Falha ao atualizar subação' }, { status: 500 });
  }
}

// 3. DELETE: Remoção de subação
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
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'ID da subação é obrigatório' }, { status: 400 });
    }

    const task = await prisma.actionPlanTask.findUnique({
      where: { id: taskId },
      include: { actionPlan: { select: { companyId: true } } }
    });

    if (!task || task.actionPlanId !== actionPlanId) {
      return NextResponse.json({ success: false, error: 'Subação não encontrada' }, { status: 404 });
    }

    const effectiveCompanyId = await resolveUserCompanyId(authUser);
    if (authUser.role !== 'SUPER_ADMIN' && task.actionPlan.companyId !== effectiveCompanyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    await prisma.actionPlanTask.delete({ where: { id: taskId } });

    await prisma.actionPlanHistory.create({
      data: {
        actionPlanId,
        userId: authUser.id,
        action: 'EDITED',
        details: `Subação "${task.description}" removida por ${authUser.name}.`
      }
    });

    return NextResponse.json({ success: true, message: 'Subação removida com sucesso' });
  } catch (error: any) {
    console.error('Erro ao remover subação:', error);
    return NextResponse.json({ success: false, error: 'Falha ao remover subação' }, { status: 500 });
  }
}
