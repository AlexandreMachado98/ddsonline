// app/api/colaboradores/route.ts
// Cadastro de colaboradores da empresa do usuário logado.
//
// GET                                              → lista + configuração
// POST   { action: 'create', registration, name, role }
// POST   { action: 'import', text }                → linhas coladas do Excel/CSV (Matrícula, Nome, Função)
// PATCH  { action: 'update', id, registration, name, role }
// PATCH  { action: 'settings', allowUnregistered }
// DELETE { id }
//
// As assinaturas guardam uma cópia do nome e da função: editar ou excluir aqui
// só vale para as próximas assinaturas.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { ensureCollaboratorTables } from '@/lib/collaboratorTables';
import { normalizePersonName, normalizeRole, validateCollaborator, parseCollaboratorPaste } from '@/lib/collaboratorRules';

export const dynamic = 'force-dynamic';

const json = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

async function context(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return { error: json('Sessão inválida.', 401) };
  if (!user.companyId) return { error: json('Sua conta não está vinculada a uma empresa. O cadastro de colaboradores é por empresa.', 400) };
  if (!(await ensureCollaboratorTables())) return { error: json('O cadastro de colaboradores está indisponível no momento. Tente novamente em instantes.', 503) };
  return { user, companyId: user.companyId };
}

async function readBody(req: Request) {
  try { return await req.json(); } catch { return null; }
}

export async function GET(req: Request) {
  const ctx = await context(req);
  if (ctx.error) return ctx.error;
  try {
    const [collaborators, settings, company] = await Promise.all([
      prisma.collaborator.findMany({
        where: { companyId: ctx.companyId },
        orderBy: { name: 'asc' },
        select: { id: true, registration: true, name: true, role: true, updatedAt: true }
      }),
      prisma.collaboratorSettings.findUnique({ where: { companyId: ctx.companyId } }),
      prisma.company.findUnique({ where: { id: ctx.companyId }, select: { name: true } })
    ]);
    return NextResponse.json({
      success: true, companyName: company?.name || null, collaborators,
      settings: { allowUnregistered: settings?.allowUnregistered ?? true }
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao listar colaboradores:', error);
    return json('Não foi possível carregar os colaboradores.', 500);
  }
}

export async function POST(req: Request) {
  const ctx = await context(req);
  if (ctx.error) return ctx.error;
  const body = await readBody(req);
  if (!body) return json('Solicitação inválida.', 400);
  try {
    if (body.action === 'create') {
      const input = { registration: String(body.registration || '').trim(), name: String(body.name || ''), role: String(body.role || '') };
      const error = validateCollaborator(input);
      if (error) return json(error, 400);
      const existing = await prisma.collaborator.findUnique({ where: { companyId_registration: { companyId: ctx.companyId, registration: input.registration } }, select: { name: true } });
      if (existing) return json(`A matrícula ${input.registration} já está cadastrada para ${existing.name}. Use Editar para corrigir.`, 409);
      const collaborator = await prisma.collaborator.create({
        data: { companyId: ctx.companyId, registration: input.registration, name: normalizePersonName(input.name), role: normalizeRole(input.role), createdById: ctx.user!.id },
        select: { id: true, registration: true, name: true, role: true, updatedAt: true }
      });
      return NextResponse.json({ success: true, collaborator }, { status: 201 });
    }

    if (body.action === 'import') {
      const text = typeof body.text === 'string' ? body.text.slice(0, 500_000) : '';
      const { rows, invalid } = parseCollaboratorPaste(text);
      if (rows.length > 3000) return json('Importe no máximo 3.000 colaboradores por vez.', 400);
      const existing = await prisma.collaborator.findMany({
        where: { companyId: ctx.companyId, registration: { in: rows.map(r => r.registration) } },
        select: { id: true, registration: true, name: true, role: true }
      });
      const byReg = new Map(existing.map(e => [e.registration, e]));
      const toCreate = rows.filter(r => !byReg.has(r.registration));
      const toUpdate = rows.filter(r => { const e = byReg.get(r.registration); return e && (e.name !== r.name || e.role !== r.role); });
      // Novos numa única gravação; atualizações em lotes pequenos (limite de tempo da hospedagem).
      if (toCreate.length) {
        await prisma.collaborator.createMany({
          data: toCreate.map(r => ({ companyId: ctx.companyId, registration: r.registration, name: r.name, role: r.role, createdById: ctx.user!.id })),
          skipDuplicates: true
        });
      }
      for (let i = 0; i < toUpdate.length; i += 100) {
        await prisma.$transaction(toUpdate.slice(i, i + 100).map(r => prisma.collaborator.update({
          where: { id: byReg.get(r.registration)!.id }, data: { name: r.name, role: r.role }
        })));
      }
      return NextResponse.json({
        success: true,
        added: toCreate.length,
        updated: toUpdate.length,
        unchanged: rows.length - toCreate.length - toUpdate.length,
        invalid
      });
    }

    return json('Ação inválida.', 400);
  } catch (error) {
    console.error('Erro ao salvar colaborador:', error);
    return json('Não foi possível salvar.', 500);
  }
}

export async function PATCH(req: Request) {
  const ctx = await context(req);
  if (ctx.error) return ctx.error;
  const body = await readBody(req);
  if (!body) return json('Solicitação inválida.', 400);
  try {
    if (body.action === 'settings') {
      const allowUnregistered = Boolean(body.allowUnregistered);
      await prisma.collaboratorSettings.upsert({
        where: { companyId: ctx.companyId },
        update: { allowUnregistered },
        create: { companyId: ctx.companyId, allowUnregistered }
      });
      return NextResponse.json({ success: true, settings: { allowUnregistered } });
    }

    if (body.action === 'update') {
      const current = await prisma.collaborator.findUnique({ where: { id: String(body.id || '') } });
      if (!current || current.companyId !== ctx.companyId) return json('Colaborador não encontrado.', 404);
      const input = { registration: String(body.registration ?? current.registration).trim(), name: String(body.name ?? current.name), role: String(body.role ?? current.role) };
      const error = validateCollaborator(input);
      if (error) return json(error, 400);
      if (input.registration !== current.registration) {
        const clash = await prisma.collaborator.findUnique({ where: { companyId_registration: { companyId: ctx.companyId, registration: input.registration } }, select: { name: true } });
        if (clash) return json(`A matrícula ${input.registration} já pertence a ${clash.name}.`, 409);
      }
      const collaborator = await prisma.collaborator.update({
        where: { id: current.id },
        data: { registration: input.registration, name: normalizePersonName(input.name), role: normalizeRole(input.role) },
        select: { id: true, registration: true, name: true, role: true, updatedAt: true }
      });
      return NextResponse.json({ success: true, collaborator });
    }

    return json('Ação inválida.', 400);
  } catch (error) {
    console.error('Erro ao atualizar colaborador:', error);
    return json('Não foi possível salvar as alterações.', 500);
  }
}

export async function DELETE(req: Request) {
  const ctx = await context(req);
  if (ctx.error) return ctx.error;
  const body = await readBody(req);
  if (!body || typeof body.id !== 'string') return json('Solicitação inválida.', 400);
  try {
    const current = await prisma.collaborator.findUnique({ where: { id: body.id }, select: { companyId: true } });
    if (!current || current.companyId !== ctx.companyId) return json('Colaborador não encontrado.', 404);
    await prisma.collaborator.delete({ where: { id: body.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir colaborador:', error);
    return json('Não foi possível excluir.', 500);
  }
}
