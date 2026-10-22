// app/api/planos-de-acao/[id]/route.ts
// Detalhes Completos de um Plano de Ação (Subações, Evidências, Histórico, Prorrogações, Validação)

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do plano é obrigatório' }, { status: 400 });
    }

    const plan = await prisma.actionPlan.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, document: true } },
        creator: { select: { id: true, name: true, email: true, position: true } },
        responsible: { select: { id: true, name: true, email: true, position: true } },
        supervisor: { select: { id: true, name: true, email: true, position: true } },
        verifier: { select: { id: true, name: true, email: true, position: true } },
        meeting: { select: { id: true, topic: true, createdAt: true, farm: true } },
        tasks: {
          orderBy: { position: 'asc' },
          include: {
            responsible: { select: { id: true, name: true } }
          }
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true } }
          }
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, photoURL: true } }
          }
        },
        history: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true } }
          }
        },
        extensions: {
          orderBy: { createdAt: 'desc' },
          include: {
            requester: { select: { id: true, name: true } },
            approver: { select: { id: true, name: true } }
          }
        },
        verification: {
          include: {
            verifier: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plano de ação não encontrado' }, { status: 404 });
    }

    // Validação Multi-tenant
    if (authUser.role !== 'SUPER_ADMIN' && plan.companyId !== authUser.companyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado a este plano de ação' }, { status: 403 });
    }

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    console.error('Erro ao buscar detalhes do plano de ação:', error);
    return NextResponse.json({ success: false, error: 'Falha ao processar requisição' }, { status: 500 });
  }
}
