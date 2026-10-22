// app/api/planos-de-acao/[id]/comentarios/route.ts
// Apontamentos e Comentários Técnicos de Acompanhamento do Plano de Ação

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { resolveUserCompanyId } from '@/lib/actionPlanServer';

export const dynamic = 'force-dynamic';

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
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'O conteúdo do comentário é obrigatório' }, { status: 400 });
    }

    const plan = await prisma.actionPlan.findUnique({
      where: { id: actionPlanId },
      select: { companyId: true, code: true, responsibleId: true, creatorId: true }
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
    }

    const effectiveCompanyId = await resolveUserCompanyId(authUser);
    if (authUser.role !== 'SUPER_ADMIN' && plan.companyId !== effectiveCompanyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    const comment = await prisma.actionPlanComment.create({
      data: {
        actionPlanId,
        authorId: authUser.id,
        content: content.trim()
      },
      include: {
        author: { select: { id: true, name: true, photoURL: true } }
      }
    });

    await prisma.actionPlanHistory.create({
      data: {
        actionPlanId,
        userId: authUser.id,
        action: 'COMMENT_ADDED',
        details: `Comentário registrado por ${authUser.name}: "${content.trim().slice(0, 80)}${content.trim().length > 80 ? '...' : ''}"`
      }
    });

    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao adicionar comentário:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar comentário' }, { status: 500 });
  }
}
