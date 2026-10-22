// app/api/planos-de-acao/notificacoes/route.ts
// Notificações Internas dos Planos de Ação

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const notifications = await prisma.actionPlanNotification.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        actionPlan: { select: { id: true, code: true, title: true } }
      }
    });

    const unreadCount = await prisma.actionPlanNotification.count({
      where: { userId: authUser.id, read: false }
    });

    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (error: any) {
    console.error('Erro ao buscar notificações:', error);
    return NextResponse.json({ success: false, error: 'Falha ao buscar notificações' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      await prisma.actionPlanNotification.updateMany({
        where: { userId: authUser.id, read: false },
        data: { read: true, readAt: new Date() }
      });
      return NextResponse.json({ success: true, message: 'Todas as notificações marcadas como lidas' });
    }

    if (notificationId) {
      await prisma.actionPlanNotification.update({
        where: { id: notificationId },
        data: { read: true, readAt: new Date() }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Parâmetro inválido' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro ao atualizar notificações:', error);
    return NextResponse.json({ success: false, error: 'Falha ao atualizar notificações' }, { status: 500 });
  }
}
