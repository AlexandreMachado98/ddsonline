// app/api/competicoes/pontos-extras/route.ts
// Critérios de pontuação extra (com peso editável) e lançamentos manuais por colaborador.
//
// Corpo das requisições: { kind: 'criterion' | 'entry', ... }
//  - POST   criterion: { competitionId, name, weight }
//  - PATCH  criterion: { id, name?, weight? }
//  - DELETE criterion: { id }   (remove também os lançamentos do critério)
//  - POST   entry:     { competitionId, criterionId, registration, name, quantity, note? }
//  - PATCH  entry:     { id, criterionId?, registration?, name?, quantity?, note? }
//  - DELETE entry:     { id }

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const json = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status });

// P2021 = tabela inexistente (migração de pontos extras ainda não aplicada no banco).
const isMissingTable = (e: any) => e?.code === 'P2021';
const missingTableResponse = () =>
  json('Pontos extras ainda não habilitados: o banco de dados precisa ser atualizado (migração competition_bonus_points).', 503);

function canManage(user: any, competition: any) {
  return user.role === 'SUPER_ADMIN' ||
    competition.organizerId === user.id ||
    (user.role === 'COMPANY_ADMIN' && user.companyId === competition.companyId);
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const isInt = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

async function loadCompetition(user: any, competitionId: unknown) {
  if (typeof competitionId !== 'string' || !competitionId) return { error: json('Competição não informada.', 400) };
  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) return { error: json('Competição não encontrada.', 404) };
  if (!canManage(user, competition)) return { error: json('Acesso negado a esta competição.', 403) };
  if (competition.status === 'CANCELLED') return { error: json('Competição cancelada não pode ser alterada.', 400) };
  return { competition };
}

async function readBody(req: Request) {
  try { return await req.json(); } catch { return null; }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  const body = await readBody(req);
  if (!body) return json('Solicitação inválida.', 400);

  try {
    const { competition, error } = await loadCompetition(user, body.competitionId);
    if (error) return error;

    if (body.kind === 'criterion') {
      const name = text(body.name, 80);
      const weight = Number(body.weight ?? 1);
      if (!name) return json('Informe o nome do critério.', 400);
      if (!isInt(weight, 0, 1000)) return json('O peso deve ser um número inteiro entre 0 e 1000.', 400);
      const criterion = await prisma.competitionBonusCriterion.create({
        data: { competitionId: competition!.id, name, weight }
      });
      return NextResponse.json({ success: true, criterion }, { status: 201 });
    }

    if (body.kind === 'entry') {
      const registration = text(body.registration, 40);
      const name = text(body.name, 160);
      const quantity = Number(body.quantity ?? 1);
      if (!registration) return json('Informe a matrícula do colaborador.', 400);
      if (!name) return json('Informe o nome do colaborador.', 400);
      if (!isInt(quantity, -1000, 1000) || quantity === 0) return json('A quantidade deve ser um número inteiro entre -1000 e 1000, diferente de zero.', 400);
      const criterion = await prisma.competitionBonusCriterion.findFirst({
        where: { id: String(body.criterionId || ''), competitionId: competition!.id }
      });
      if (!criterion) return json('Critério de pontuação não encontrado.', 404);
      const entry = await prisma.competitionBonusEntry.create({
        data: {
          competitionId: competition!.id, criterionId: criterion.id,
          participantRegistration: registration, participantName: name,
          quantity, note: text(body.note, 500) || null, createdById: user.id
        }
      });
      return NextResponse.json({ success: true, entry }, { status: 201 });
    }

    return json('Tipo de operação inválido.', 400);
  } catch (e) {
    if (isMissingTable(e)) return missingTableResponse();
    console.error('Erro ao incluir pontos extras:', e);
    return json('Não foi possível salvar os pontos extras.', 500);
  }
}

export async function PATCH(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  const body = await readBody(req);
  if (!body || typeof body.id !== 'string') return json('Solicitação inválida.', 400);

  try {
    if (body.kind === 'criterion') {
      const current = await prisma.competitionBonusCriterion.findUnique({ where: { id: body.id } });
      if (!current) return json('Critério não encontrado.', 404);
      const { error } = await loadCompetition(user, current.competitionId);
      if (error) return error;
      const data: { name?: string; weight?: number } = {};
      if (body.name !== undefined) {
        const name = text(body.name, 80);
        if (!name) return json('Informe o nome do critério.', 400);
        data.name = name;
      }
      if (body.weight !== undefined) {
        const weight = Number(body.weight);
        if (!isInt(weight, 0, 1000)) return json('O peso deve ser um número inteiro entre 0 e 1000.', 400);
        data.weight = weight;
      }
      const criterion = await prisma.competitionBonusCriterion.update({ where: { id: current.id }, data });
      return NextResponse.json({ success: true, criterion });
    }

    if (body.kind === 'entry') {
      const current = await prisma.competitionBonusEntry.findUnique({ where: { id: body.id } });
      if (!current) return json('Lançamento não encontrado.', 404);
      const { competition, error } = await loadCompetition(user, current.competitionId);
      if (error) return error;
      const data: { criterionId?: string; participantRegistration?: string; participantName?: string; quantity?: number; note?: string | null } = {};
      if (body.criterionId !== undefined) {
        const criterion = await prisma.competitionBonusCriterion.findFirst({ where: { id: String(body.criterionId), competitionId: competition!.id } });
        if (!criterion) return json('Critério de pontuação não encontrado.', 404);
        data.criterionId = criterion.id;
      }
      if (body.registration !== undefined) {
        const registration = text(body.registration, 40);
        if (!registration) return json('Informe a matrícula do colaborador.', 400);
        data.participantRegistration = registration;
      }
      if (body.name !== undefined) {
        const name = text(body.name, 160);
        if (!name) return json('Informe o nome do colaborador.', 400);
        data.participantName = name;
      }
      if (body.quantity !== undefined) {
        const quantity = Number(body.quantity);
        if (!isInt(quantity, -1000, 1000) || quantity === 0) return json('A quantidade deve ser um número inteiro entre -1000 e 1000, diferente de zero.', 400);
        data.quantity = quantity;
      }
      if (body.note !== undefined) data.note = text(body.note, 500) || null;
      const entry = await prisma.competitionBonusEntry.update({ where: { id: current.id }, data });
      return NextResponse.json({ success: true, entry });
    }

    return json('Tipo de operação inválido.', 400);
  } catch (e) {
    if (isMissingTable(e)) return missingTableResponse();
    console.error('Erro ao editar pontos extras:', e);
    return json('Não foi possível atualizar os pontos extras.', 500);
  }
}

export async function DELETE(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  const body = await readBody(req);
  if (!body || typeof body.id !== 'string') return json('Solicitação inválida.', 400);

  try {
    if (body.kind === 'criterion') {
      const current = await prisma.competitionBonusCriterion.findUnique({ where: { id: body.id } });
      if (!current) return json('Critério não encontrado.', 404);
      const { error } = await loadCompetition(user, current.competitionId);
      if (error) return error;
      await prisma.competitionBonusCriterion.delete({ where: { id: current.id } });
      return NextResponse.json({ success: true });
    }
    if (body.kind === 'entry') {
      const current = await prisma.competitionBonusEntry.findUnique({ where: { id: body.id } });
      if (!current) return json('Lançamento não encontrado.', 404);
      const { error } = await loadCompetition(user, current.competitionId);
      if (error) return error;
      await prisma.competitionBonusEntry.delete({ where: { id: current.id } });
      return NextResponse.json({ success: true });
    }
    return json('Tipo de operação inválido.', 400);
  } catch (e) {
    if (isMissingTable(e)) return missingTableResponse();
    console.error('Erro ao excluir pontos extras:', e);
    return json('Não foi possível excluir.', 500);
  }
}
