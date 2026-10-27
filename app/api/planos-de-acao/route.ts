// app/api/planos-de-acao/route.ts
// API Central do Módulo de Planos de Ação do DDS-ON (Listagem, Dashboard, Criação, Atualização, Exclusão)

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser, logSecurityEvent } from '@/lib/auth';
import { resolveUserCompanyId } from '@/lib/actionPlanServer';
import { 
  canTransitionStatus, 
  calculateDeadlineState, 
  ActionPlanStatus,
  ActionPlanPriority,
  ActionPlanCriticality,
  ActionPlanOrigin
} from '@/lib/actionPlanUtils';

export const dynamic = 'force-dynamic';

// Helper: Gera código sequencial único do dia no formato PA-YYYYMMDD-0001
async function generateActionPlanCode(companyId: string): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `PA-${y}${m}${d}`;

  // Busca o último plano cadastrado hoje
  const lastPlan = await prisma.actionPlan.findFirst({
    where: {
      code: { startsWith: prefix }
    },
    orderBy: { code: 'desc' },
    select: { code: true }
  });

  let seq = 1;
  if (lastPlan && lastPlan.code) {
    const parts = lastPlan.code.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

// =========================================================================
// 1. GET: Listagem paginada, busca, filtros combinados ou métricas do Dashboard
// =========================================================================
export async function GET(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'list'; // 'list' | 'dashboard' | 'my' | 'overdue' | 'completed' | 'awaiting'
    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');
    const criticalityParam = searchParams.get('criticality');
    const originParam = searchParams.get('origin');
    const responsibleId = searchParams.get('responsibleId');
    const search = searchParams.get('search')?.trim();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '15', 10)));
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Cláusula Multi-tenant obrigatória
    const effectiveCompanyId = await resolveUserCompanyId(authUser);
    const companyFilter = authUser.role === 'SUPER_ADMIN' 
      ? {} 
      : { companyId: effectiveCompanyId };

    // Filtros dinâmicos
    const where: any = {
      ...companyFilter
    };

    // Filtros por Visão Especial
    if (view === 'my') {
      where.OR = [
        { responsibleId: authUser.id },
        { creatorId: authUser.id },
        { supervisorId: authUser.id },
        { verifierId: authUser.id }
      ];
    } else if (view === 'overdue') {
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
      where.dueDate = { lt: new Date() };
    } else if (view === 'completed') {
      where.status = 'COMPLETED';
    } else if (view === 'awaiting') {
      where.status = 'AWAITING_VALIDATION';
    } else if (view === 'in_progress') {
      where.status = 'IN_PROGRESS';
    }

    // Parâmetros explícitos de filtro
    if (statusParam && statusParam !== 'ALL') {
      where.status = statusParam;
    }
    if (priorityParam && priorityParam !== 'ALL') {
      where.priority = priorityParam;
    }
    if (criticalityParam && criticalityParam !== 'ALL') {
      where.criticality = criticalityParam;
    }
    if (originParam && originParam !== 'ALL') {
      where.origin = originParam;
    }
    if (responsibleId && responsibleId !== 'ALL') {
      where.responsibleId = responsibleId;
    }

    // Filtro por período
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    // Busca textual em múltiplos campos (código, título, setor, localização, problema)
    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { sector: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
            { problemDescription: { contains: search, mode: 'insensitive' } },
            { responsible: { name: { contains: search, mode: 'insensitive' } } }
          ]
        }
      ];
    }

    // --- MODO DASHBOARD: Calcula Indicadores Reais Agregados ---
    if (view === 'dashboard') {
      const allCompanyPlans = await prisma.actionPlan.findMany({
        where: companyFilter,
        include: {
          responsible: { select: { id: true, name: true } },
          verification: { select: { result: true } },
          tasks: { select: { id: true, status: true, weight: true } }
        }
      });

      const now = new Date();
      let total = allCompanyPlans.length;
      let open = 0;
      let inProgress = 0;
      let awaitingValidation = 0;
      let completed = 0;
      let suspended = 0;
      let cancelled = 0;
      let overdue = 0;
      let nearDue = 0;
      let completedOnTime = 0;
      let completedLate = 0;
      let totalResolutionDays = 0;
      let completedWithDatesCount = 0;

      const byPriority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
      const byCriticality: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 };
      const byResponsibleMap: Record<string, { id: string; name: string; total: number; completed: number; overdue: number }> = {};
      const byMonthMap: Record<string, { month: string; created: number; completed: number }> = {};

      for (const p of allCompanyPlans) {
        // Status Operacional
        if (p.status === 'OPEN') open++;
        else if (p.status === 'IN_PROGRESS') inProgress++;
        else if (p.status === 'AWAITING_VALIDATION') awaitingValidation++;
        else if (p.status === 'COMPLETED') completed++;
        else if (p.status === 'SUSPENDED') suspended++;
        else if (p.status === 'CANCELLED') cancelled++;

        // Prioridade e Criticidade
        if (byPriority[p.priority] !== undefined) byPriority[p.priority]++;
        if (byCriticality[p.criticality] !== undefined) byCriticality[p.criticality]++;

        // Situação do Prazo
        const dl = calculateDeadlineState(p.dueDate, p.completedAt, p.status as ActionPlanStatus, p.alertDaysBefore || 7);
        if (dl.state === 'OVERDUE') overdue++;
        if (dl.state === 'NEAR_DUE' || dl.state === 'DUE_TODAY') nearDue++;
        if (dl.state === 'COMPLETED_ON_TIME') completedOnTime++;
        if (dl.state === 'COMPLETED_LATE') completedLate++;

        // Tempo médio de resolução
        if (p.status === 'COMPLETED' && p.completedAt && p.createdAt) {
          const diffDays = Math.max(1, Math.round((new Date(p.completedAt).getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
          totalResolutionDays += diffDays;
          completedWithDatesCount++;
        }

        // Distribuição por Responsável
        const respName = p.responsible?.name || 'Não Atribuído';
        const respId = p.responsible?.id || 'unassigned';
        if (!byResponsibleMap[respId]) {
          byResponsibleMap[respId] = { id: respId, name: respName, total: 0, completed: 0, overdue: 0 };
        }
        byResponsibleMap[respId].total++;
        if (p.status === 'COMPLETED') byResponsibleMap[respId].completed++;
        if (dl.isOverdue) byResponsibleMap[respId].overdue++;

        // Evolução Mensal (últimos 6 meses)
        const cDate = new Date(p.createdAt);
        const mKey = `${cDate.getFullYear()}-${String(cDate.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonthMap[mKey]) {
          byMonthMap[mKey] = { month: mKey, created: 0, completed: 0 };
        }
        byMonthMap[mKey].created++;
        if (p.completedAt) {
          const compDate = new Date(p.completedAt);
          const compKey = `${compDate.getFullYear()}-${String(compDate.getMonth() + 1).padStart(2, '0')}`;
          if (!byMonthMap[compKey]) {
            byMonthMap[compKey] = { month: compKey, created: 0, completed: 0 };
          }
          byMonthMap[compKey].completed++;
        }
      }

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const onTimeRate = completed > 0 ? Math.round((completedOnTime / completed) * 100) : 100;
      const avgResolutionDays = completedWithDatesCount > 0 ? Math.round(totalResolutionDays / completedWithDatesCount) : 0;

      return NextResponse.json({
        success: true,
        metrics: {
          total,
          open,
          inProgress,
          awaitingValidation,
          completed,
          suspended,
          cancelled,
          overdue,
          nearDue,
          completedOnTime,
          completedLate,
          completionRate,
          onTimeRate,
          avgResolutionDays,
          byPriority,
          byCriticality,
          byResponsible: Object.values(byResponsibleMap).sort((a, b) => b.total - a.total).slice(0, 10),
          monthlyEvolution: Object.values(byMonthMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
        }
      });
    }

    // --- MODO LISTA PAGINADA ---
    const totalCount = await prisma.actionPlan.count({ where });

    const plans = await prisma.actionPlan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        responsible: { select: { id: true, name: true, email: true, position: true } },
        supervisor: { select: { id: true, name: true } },
        verifier: { select: { id: true, name: true } },
        verification: { select: { id: true, result: true, verifiedAt: true } },
        tasks: { select: { id: true, status: true, weight: true } },
        _count: {
          select: {
            attachments: true,
            comments: true,
            tasks: true,
            extensions: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: plans,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error: any) {
    console.error('Erro ao buscar planos de ação:', error);
    return NextResponse.json({ success: false, error: 'Falha interna ao processar consulta' }, { status: 500 });
  }
}

// =========================================================================
// 2. POST: Cadastro completo de Plano de Ação
// =========================================================================
export async function POST(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();

    // Obtém ou resolve automaticamente o companyId da empresa do usuário
    let companyId = await resolveUserCompanyId(authUser);
    if (authUser.role === 'SUPER_ADMIN' && body.companyId) {
      companyId = body.companyId;
    }
    const {
      title,
      description,
      sector,
      location,
      identificationDate,
      origin,
      originReferenceId,
      meetingId,
      category,
      criticality,
      priority,
      status,
      completedAt,
      problemDescription,
      identifiedRisk,
      potentialConsequences,
      identifiedCause,
      rootCause,
      immediateMeasures,
      additionalNotes,
      actionDescription,
      actionObjective,
      expectedResult,
      requiredResources,
      completionCriteria,
      responsibleId,
      supervisorId,
      verifierId,
      startDate,
      dueDate,
      alertDaysBefore,
      tasks,
      attachments
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'O título do plano de ação é obrigatório.' }, { status: 400 });
    }

    // Suporte a cadastro de planos já concluídos no passado (histórico/retroativo)
    const finalStatus: ActionPlanStatus = (['OPEN', 'IN_PROGRESS', 'AWAITING_VALIDATION', 'COMPLETED', 'SUSPENDED', 'CANCELLED'].includes(status))
      ? (status as ActionPlanStatus)
      : 'OPEN';

    let finalCompletedAt: Date | null = null;
    if (finalStatus === 'COMPLETED') {
      if (completedAt) {
        finalCompletedAt = new Date(completedAt);
      } else if (dueDate) {
        finalCompletedAt = new Date(dueDate);
      } else {
        finalCompletedAt = new Date();
      }
    }

    // Gera código sequencial automático oficial
    const code = await generateActionPlanCode(companyId);

    // Cria plano de ação no banco
    const newPlan = await prisma.actionPlan.create({
      data: {
        code,
        title: title.trim(),
        description: description?.trim() || null,
        companyId,
        sector: sector?.trim() || null,
        location: location?.trim() || null,
        identificationDate: identificationDate ? new Date(identificationDate) : new Date(),
        origin: (origin as ActionPlanOrigin) || 'OTHER',
        originReferenceId: originReferenceId || null,
        meetingId: meetingId || null,
        category: category?.trim() || 'SST',
        criticality: (criticality as ActionPlanCriticality) || 'MEDIUM',
        priority: (priority as ActionPlanPriority) || 'MEDIUM',
        status: finalStatus,
        completedAt: finalCompletedAt,

        // Problema / Investigação
        problemDescription: problemDescription?.trim() || null,
        identifiedRisk: identifiedRisk?.trim() || null,
        potentialConsequences: potentialConsequences?.trim() || null,
        identifiedCause: identifiedCause?.trim() || null,
        rootCause: rootCause?.trim() || null,
        immediateMeasures: immediateMeasures?.trim() || null,
        additionalNotes: additionalNotes?.trim() || null,

        // Ação Proposta
        actionDescription: actionDescription?.trim() || null,
        actionObjective: actionObjective?.trim() || null,
        expectedResult: expectedResult?.trim() || null,
        requiredResources: requiredResources?.trim() || null,
        completionCriteria: completionCriteria?.trim() || null,

        // Responsáveis
        creatorId: authUser.id,
        responsibleId: responsibleId || null,
        supervisorId: supervisorId || null,
        verifierId: verifierId || null,

        // Prazos
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        originalDueDate: dueDate ? new Date(dueDate) : null,
        alertDaysBefore: alertDaysBefore ? parseInt(alertDaysBefore, 10) : 7,

        // Subações iniciais (se fornecidas no formulário)
        tasks: Array.isArray(tasks) && tasks.length > 0 ? {
          create: tasks.map((t: any, idx: number) => ({
            description: t.description?.trim() || `Etapa ${idx + 1}`,
            responsibleId: t.responsibleId || responsibleId || null,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            weight: t.weight ? parseInt(t.weight, 10) : 1,
            position: idx,
            status: finalStatus === 'COMPLETED' ? 'COMPLETED' : 'OPEN',
            completedAt: finalStatus === 'COMPLETED' ? finalCompletedAt : null,
            notes: t.notes || null
          }))
        } : undefined,

        // Evidências anexadas diretamente no cadastro inicial (Fotos Antes/Durante/Depois)
        attachments: Array.isArray(attachments) && attachments.length > 0 ? {
          create: attachments.filter((att: any) => att && att.fileData).map((att: any) => ({
            fileName: String(att.fileName || 'evidencia.jpg').slice(0, 150),
            displayName: String(att.displayName || att.fileName || 'Evidência').slice(0, 150),
            mimeType: String(att.mimeType || 'image/jpeg').slice(0, 100),
            fileSize: Number(att.fileSize) || 0,
            fileData: att.fileData,
            evidenceType: ['BEFORE', 'DURING', 'AFTER', 'COMPLEMENTARY'].includes(att.evidenceType) ? att.evidenceType : 'COMPLEMENTARY',
            caption: att.caption ? String(att.caption).slice(0, 500) : null,
            authorId: authUser.id
          }))
        } : undefined
      },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
        tasks: true,
        attachments: true
      }
    });

    // Registra entrada na linha do tempo de Histórico Auditável
    await prisma.actionPlanHistory.create({
      data: {
        actionPlanId: newPlan.id,
        userId: authUser.id,
        action: 'CREATED',
        details: `Plano de Ação ${newPlan.code} criado por ${authUser.name}.`
      }
    });

    // Dispara notificação interna se houver responsável atribuído
    if (newPlan.responsibleId && newPlan.responsibleId !== authUser.id) {
      await prisma.actionPlanNotification.create({
        data: {
          actionPlanId: newPlan.id,
          userId: newPlan.responsibleId,
          type: 'NEW_ASSIGNMENT',
          title: 'Novo Plano de Ação Atribuído',
          message: `Você foi designado como responsável pelo plano ${newPlan.code}: "${newPlan.title}".`
        }
      });
    }

    logSecurityEvent('ADMIN_ACTION', {
      userId: authUser.id,
      path: '/api/planos-de-acao',
      reason: `Plano de ação criado: ${newPlan.code}`
    });

    return NextResponse.json({ success: true, plan: newPlan }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao cadastrar plano de ação:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar plano de ação' }, { status: 500 });
  }
}

// =========================================================================
// 3. PUT: Atualização cadastral ou transição da Máquina de Estados
// =========================================================================
export async function PUT(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { id, status: newStatus, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do plano de ação é obrigatório.' }, { status: 400 });
    }

    // Busca o plano existente e valida isolamento multi-tenant
    const currentPlan = await prisma.actionPlan.findUnique({
      where: { id },
      include: {
        tasks: true,
        attachments: true
      }
    });

    if (!currentPlan) {
      return NextResponse.json({ success: false, error: 'Plano de ação não encontrado.' }, { status: 404 });
    }

    const effectiveCompanyId = await resolveUserCompanyId(authUser);
    if (authUser.role !== 'SUPER_ADMIN' && currentPlan.companyId !== effectiveCompanyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado a este plano de ação.' }, { status: 403 });
    }

    const historyEntries: any[] = [];
    const dataToUpdate: any = {};

    // --- REGRA DA MÁQUINA DE ESTADOS ---
    if (newStatus && newStatus !== currentPlan.status) {
      if (!canTransitionStatus(currentPlan.status, newStatus)) {
        return NextResponse.json({
          success: false,
          error: `Transição inválida: Não é permitido mudar de "${currentPlan.status}" para "${newStatus}".`
        }, { status: 400 });
      }

      // REGRA: Responsável não pode aprovar a própria conclusão se houver verificador/supervisor diferente
      if (newStatus === 'COMPLETED' && currentPlan.verifierId && currentPlan.verifierId !== authUser.id) {
        if (currentPlan.responsibleId === authUser.id && authUser.role !== 'SUPER_ADMIN') {
          return NextResponse.json({
            success: false,
            error: 'O responsável não pode aprovar a própria conclusão. Envie o plano para validação do verificador designado.'
          }, { status: 403 });
        }
      }

      // REGRA: Conclusão permite data efetiva retroativa (ex: planos executados anteriormente)
      if (newStatus === 'COMPLETED') {
        dataToUpdate.completedAt = updateFields.completedAt 
          ? new Date(updateFields.completedAt) 
          : (currentPlan.dueDate ? new Date(currentPlan.dueDate) : new Date());
      }

      dataToUpdate.status = newStatus;
      historyEntries.push({
        actionPlanId: id,
        userId: authUser.id,
        action: 'STATUS_CHANGED',
        previousValue: currentPlan.status,
        newValue: newStatus,
        details: `Status alterado de ${currentPlan.status} para ${newStatus} por ${authUser.name}.`
      });

      // Notificação se enviado para validação
      if (newStatus === 'AWAITING_VALIDATION' && currentPlan.verifierId) {
        await prisma.actionPlanNotification.create({
          data: {
            actionPlanId: id,
            userId: currentPlan.verifierId,
            type: 'SENT_FOR_VALIDATION',
            title: 'Plano Aguardando Validação',
            message: `O plano ${currentPlan.code} foi marcado como concluído e aguarda sua validação de eficácia.`
          }
        });
      }
    }

    // Campos cadastrais atualizáveis
    if (updateFields.title !== undefined) dataToUpdate.title = updateFields.title.trim();
    if (updateFields.description !== undefined) dataToUpdate.description = updateFields.description?.trim() || null;
    if (updateFields.sector !== undefined) dataToUpdate.sector = updateFields.sector?.trim() || null;
    if (updateFields.location !== undefined) dataToUpdate.location = updateFields.location?.trim() || null;
    if (updateFields.category !== undefined) dataToUpdate.category = updateFields.category?.trim() || null;
    if (updateFields.criticality !== undefined) dataToUpdate.criticality = updateFields.criticality;
    if (updateFields.priority !== undefined) dataToUpdate.priority = updateFields.priority;
    if (updateFields.origin !== undefined) dataToUpdate.origin = updateFields.origin;

    // Diagnóstico
    if (updateFields.problemDescription !== undefined) dataToUpdate.problemDescription = updateFields.problemDescription?.trim() || null;
    if (updateFields.identifiedRisk !== undefined) dataToUpdate.identifiedRisk = updateFields.identifiedRisk?.trim() || null;
    if (updateFields.potentialConsequences !== undefined) dataToUpdate.potentialConsequences = updateFields.potentialConsequences?.trim() || null;
    if (updateFields.identifiedCause !== undefined) dataToUpdate.identifiedCause = updateFields.identifiedCause?.trim() || null;
    if (updateFields.rootCause !== undefined) dataToUpdate.rootCause = updateFields.rootCause?.trim() || null;
    if (updateFields.immediateMeasures !== undefined) dataToUpdate.immediateMeasures = updateFields.immediateMeasures?.trim() || null;
    if (updateFields.additionalNotes !== undefined) dataToUpdate.additionalNotes = updateFields.additionalNotes?.trim() || null;

    // Ação proposta
    if (updateFields.actionDescription !== undefined) dataToUpdate.actionDescription = updateFields.actionDescription?.trim() || null;
    if (updateFields.actionObjective !== undefined) dataToUpdate.actionObjective = updateFields.actionObjective?.trim() || null;
    if (updateFields.expectedResult !== undefined) dataToUpdate.expectedResult = updateFields.expectedResult?.trim() || null;
    if (updateFields.requiredResources !== undefined) dataToUpdate.requiredResources = updateFields.requiredResources?.trim() || null;
    if (updateFields.completionCriteria !== undefined) dataToUpdate.completionCriteria = updateFields.completionCriteria?.trim() || null;

    // Responsáveis (com histórico e notificação)
    if (updateFields.responsibleId !== undefined && updateFields.responsibleId !== currentPlan.responsibleId) {
      dataToUpdate.responsibleId = updateFields.responsibleId;
      historyEntries.push({
        actionPlanId: id,
        userId: authUser.id,
        action: 'RESPONSIBLE_CHANGED',
        previousValue: currentPlan.responsibleId || 'Nenhum',
        newValue: updateFields.responsibleId || 'Nenhum',
        details: `Responsável principal alterado por ${authUser.name}.`
      });

      if (updateFields.responsibleId) {
        await prisma.actionPlanNotification.create({
          data: {
            actionPlanId: id,
            userId: updateFields.responsibleId,
            type: 'RESPONSIBLE_CHANGED',
            title: 'Designação de Responsável',
            message: `Você agora é o responsável pelo plano ${currentPlan.code}: "${currentPlan.title}".`
          }
        });
      }
    }

    if (updateFields.supervisorId !== undefined) dataToUpdate.supervisorId = updateFields.supervisorId || null;
    if (updateFields.verifierId !== undefined) dataToUpdate.verifierId = updateFields.verifierId || null;

    // Prazos
    if (updateFields.startDate !== undefined) dataToUpdate.startDate = updateFields.startDate ? new Date(updateFields.startDate) : null;
    if (updateFields.alertDaysBefore !== undefined) dataToUpdate.alertDaysBefore = parseInt(updateFields.alertDaysBefore, 10);

    // Se houve alteração direta de prazo (sem prorrogação formal)
    if (updateFields.dueDate !== undefined) {
      const newDue = updateFields.dueDate ? new Date(updateFields.dueDate) : null;
      const oldDue = currentPlan.dueDate ? new Date(currentPlan.dueDate) : null;
      if (newDue?.getTime() !== oldDue?.getTime()) {
        dataToUpdate.dueDate = newDue;
        historyEntries.push({
          actionPlanId: id,
          userId: authUser.id,
          action: 'DEADLINE_CHANGED',
          previousValue: oldDue ? oldDue.toISOString().slice(0, 10) : 'Sem prazo',
          newValue: newDue ? newDue.toISOString().slice(0, 10) : 'Sem prazo',
          details: `Prazo de conclusão atualizado por ${authUser.name}.`
        });
      }
    }

    // Atualização explícita de data de conclusão (permite retificar histórico de planos anteriores)
    if (updateFields.completedAt !== undefined) {
      dataToUpdate.completedAt = updateFields.completedAt ? new Date(updateFields.completedAt) : null;
    }

    // Se foram enviadas novas evidências no update
    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      for (const att of body.attachments) {
        if (att && att.fileData && !att.id) {
          await prisma.actionPlanAttachment.create({
            data: {
              actionPlanId: id,
              fileName: String(att.fileName || 'evidencia.jpg').slice(0, 150),
              displayName: String(att.displayName || att.fileName || 'Evidência').slice(0, 150),
              mimeType: String(att.mimeType || 'image/jpeg').slice(0, 100),
              fileSize: Number(att.fileSize) || 0,
              fileData: att.fileData,
              evidenceType: ['BEFORE', 'DURING', 'AFTER', 'COMPLEMENTARY'].includes(att.evidenceType) ? att.evidenceType : 'COMPLEMENTARY',
              caption: att.caption ? String(att.caption).slice(0, 500) : null,
              authorId: authUser.id
            }
          });
        }
      }
    }

    // Executa update e criação dos registros de histórico em transação atômica
    const updatedPlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.actionPlan.update({
        where: { id },
        data: dataToUpdate,
        include: {
          responsible: { select: { id: true, name: true, email: true } },
          tasks: true
        }
      });

      if (historyEntries.length > 0) {
        await tx.actionPlanHistory.createMany({
          data: historyEntries
        });
      }

      return plan;
    });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error: any) {
    console.error('Erro ao atualizar plano de ação:', error);
    return NextResponse.json({ success: false, error: 'Falha ao atualizar plano de ação' }, { status: 500 });
  }
}

// =========================================================================
// 4. DELETE: Cancelamento / Exclusão de Plano de Ação
// =========================================================================
export async function DELETE(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID é obrigatório.' }, { status: 400 });
    }

    const plan = await prisma.actionPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plano não encontrado.' }, { status: 404 });
    }

    const effectiveCompanyId = await resolveUserCompanyId(authUser);
    if (authUser.role !== 'SUPER_ADMIN' && plan.companyId !== effectiveCompanyId) {
      return NextResponse.json({ success: false, error: 'Permissão negada.' }, { status: 403 });
    }

    // Uma solicitação de exclusão definitiva nunca deve cair silenciosamente em cancelamento.
    if (permanent && authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'COMPANY_ADMIN') {
      return NextResponse.json({ success: false, error: 'Somente administradores podem excluir definitivamente.' }, { status: 403 });
    }

    // Apenas Administradores podem excluir permanentemente
    if (permanent && (authUser.role === 'SUPER_ADMIN' || authUser.role === 'COMPANY_ADMIN')) {
      await prisma.actionPlan.delete({ where: { id } });
      logSecurityEvent('ADMIN_ACTION', {
        userId: authUser.id,
        path: '/api/planos-de-acao',
        reason: `Exclusão permanente do plano ${plan.code}`
      });
      return NextResponse.json({ success: true, message: 'Plano excluído permanentemente.' });
    }

    // Soft-delete padrão: muda status para CANCELLED
    await prisma.actionPlan.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    await prisma.actionPlanHistory.create({
      data: {
        actionPlanId: id,
        userId: authUser.id,
        action: 'STATUS_CHANGED',
        previousValue: plan.status,
        newValue: 'CANCELLED',
        details: `Plano cancelado por ${authUser.name}.`
      }
    });

    return NextResponse.json({ success: true, message: 'Plano de ação cancelado com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir plano de ação:', error);
    return NextResponse.json({ success: false, error: 'Falha ao excluir plano de ação' }, { status: 500 });
  }
}
