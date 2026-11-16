// app/api/usuarios/route.ts
// Usuários da empresa: lista de contas, aprovação de cadastros e suspensão.
//
// GET                                  → contas da empresa + permissões de quem pede
// PATCH { action, userId }             → approve | suspend | reactivate | make_admin | remove_admin
// PATCH { action: 'claim_admin' }      → só quando a empresa ainda não tem administrador
//
// Contas suspensas perdem o acesso na hora (a sessão é conferida a cada requisição).

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser, logSecurityEvent } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const json = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

async function companyAdmins(companyId: string) {
  return prisma.user.count({ where: { companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' } });
}

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  if (!user.companyId) return json('Sua conta não está vinculada a uma empresa.', 400);
  try {
    const [users, admins, company] = await Promise.all([
      prisma.user.findMany({
        where: { companyId: user.companyId },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, email: true, role: true, status: true, position: true, createdAt: true }
      }),
      companyAdmins(user.companyId),
      prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } })
    ]);
    const canManage = user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN';
    return NextResponse.json({
      success: true, companyName: company?.name || null, users, me: user.id,
      canManage, companyHasAdmin: admins > 0
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return json('Não foi possível carregar os usuários.', 500);
  }
}

export async function PATCH(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  if (!user.companyId) return json('Sua conta não está vinculada a uma empresa.', 400);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== 'string') return json('Solicitação inválida.', 400);

  try {
    if (body.action === 'claim_admin') {
      // Empresa sem administrador (contas antigas entravam todas como organizador):
      // o primeiro organizador ativo que pedir assume. Serializado para não haver dois.
      const result = await prisma.$transaction(async tx => {
        await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))', 'claim_admin:' + user.companyId);
        const admins = await tx.user.count({ where: { companyId: user.companyId!, role: 'COMPANY_ADMIN', status: 'ACTIVE' } });
        if (admins > 0) return 'HAS_ADMIN';
        await tx.user.update({ where: { id: user.id }, data: { role: 'COMPANY_ADMIN' } });
        return 'OK';
      });
      if (result === 'HAS_ADMIN') return json('A empresa já tem um administrador. Peça a ele as permissões.', 409);
      logSecurityEvent('ADMIN_ACTION', { userId: user.id, reason: `CLAIMED_COMPANY_ADMIN (${user.companyId})` });
      return NextResponse.json({ success: true });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'COMPANY_ADMIN') return json('Só administradores da empresa podem alterar contas.', 403);
    const targetId = typeof body.userId === 'string' ? body.userId : '';
    if (!targetId) return json('Informe a conta.', 400);
    if (targetId === user.id) return json('Você não pode alterar a sua própria conta.', 400);
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, companyId: true, role: true, status: true, name: true } });
    if (!target || target.companyId !== user.companyId) return json('Conta não encontrada nesta empresa.', 404);
    if (target.role === 'SUPER_ADMIN') return json('Esta conta não pode ser alterada aqui.', 403);

    const data: { status?: 'ACTIVE' | 'SUSPENDED'; role?: 'COMPANY_ADMIN' | 'ORGANIZER' } = {};
    switch (body.action) {
      case 'approve':
        if (target.status !== 'PENDING_APPROVAL') return json('Esta conta não está aguardando aprovação.', 400);
        data.status = 'ACTIVE'; break;
      case 'suspend':
        if (target.status === 'SUSPENDED') return json('Esta conta já está suspensa.', 400);
        if (target.role === 'COMPANY_ADMIN' && target.status === 'ACTIVE' && await companyAdmins(user.companyId) <= 1) return json('Não é possível suspender o último administrador.', 400);
        data.status = 'SUSPENDED'; break;
      case 'reactivate':
        if (target.status !== 'SUSPENDED') return json('Esta conta não está suspensa.', 400);
        data.status = 'ACTIVE'; break;
      case 'make_admin':
        if (target.status !== 'ACTIVE') return json('Aprove ou reative a conta antes de torná-la administradora.', 400);
        data.role = 'COMPANY_ADMIN'; break;
      case 'remove_admin':
        if (target.role !== 'COMPANY_ADMIN') return json('Esta conta não é administradora.', 400);
        if (await companyAdmins(user.companyId) <= 1) return json('A empresa precisa de pelo menos um administrador.', 400);
        data.role = 'ORGANIZER'; break;
      default:
        return json('Ação inválida.', 400);
    }
    await prisma.user.update({ where: { id: target.id }, data });
    logSecurityEvent('ADMIN_ACTION', { userId: user.id, reason: `USER_${body.action.toUpperCase()} (${target.id})` });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao alterar usuário:', error);
    return json('Não foi possível salvar.', 500);
  }
}
