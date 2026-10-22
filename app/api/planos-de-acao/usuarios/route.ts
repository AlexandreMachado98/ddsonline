// app/api/planos-de-acao/usuarios/route.ts
// Listagem de Usuários / Colaboradores Autorizados da Empresa para Atribuição

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

    const where: any = {
      status: 'ACTIVE'
    };

    if (authUser.role !== 'SUPER_ADMIN') {
      where.companyId = authUser.companyId || 'unassigned';
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        role: true,
        photoURL: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json({ success: false, error: 'Falha ao buscar usuários' }, { status: 500 });
  }
}
