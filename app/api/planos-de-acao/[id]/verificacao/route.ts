// app/api/planos-de-acao/[id]/verificacao/route.ts
// Verificação de Eficácia & Validação SST do Plano de Ação

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { VerificationResult } from '@/lib/actionPlanUtils';

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
    const { result, notes, evidenceData, reopenIfIneffective } = body;

    if (!result || !['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE', 'PENDING'].includes(result)) {
      return NextResponse.json({ success: false, error: 'Resultado da verificação inválido.' }, { status: 400 });
    }

    const plan = await prisma.actionPlan.findUnique({
      where: { id: actionPlanId },
      include: { responsible: true, creator: true }
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
    }

    if (authUser.role !== 'SUPER_ADMIN' && plan.companyId !== authUser.companyId) {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    // REGRA DE SEGURANÇA: Responsável não pode validar a própria eficácia se houver verificador/auditor independente
    if (plan.verifierId && plan.verifierId !== authUser.id && plan.responsibleId === authUser.id && authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'A verificação de eficácia deve ser realizada pelo verificador designado ou auditor de SST independente.'
      }, { status: 403 });
    }

    const verificationRecord = await prisma.$transaction(async (tx) => {
      // Cria ou atualiza o registro de verificação de eficácia
      const verif = await tx.actionPlanVerification.upsert({
        where: { actionPlanId },
        create: {
          actionPlanId,
          verifierId: authUser.id,
          result: result as VerificationResult,
          notes: notes?.trim() || null,
          evidenceData: evidenceData || null,
          verifiedAt: new Date()
        },
        update: {
          verifierId: authUser.id,
          result: result as VerificationResult,
          notes: notes?.trim() || null,
          evidenceData: evidenceData || null,
          verifiedAt: new Date()
        },
        include: {
          verifier: { select: { id: true, name: true, email: true } }
        }
      });

      // Se a medida for ineficaz e solicitada reabertura
      if (result === 'INEFFECTIVE' && reopenIfIneffective) {
        await tx.actionPlan.update({
          where: { id: actionPlanId },
          data: { status: 'REOPENED' }
        });

        await tx.actionPlanHistory.create({
          data: {
            actionPlanId,
            userId: authUser.id,
            action: 'REOPENED',
            previousValue: plan.status,
            newValue: 'REOPENED',
            details: `Plano REABERTO por ${authUser.name} após verificação constatar resultado INEFICAZ. Parecer: "${notes || 'Sem parecer'}".`
          }
        });
      } else if (result === 'EFFECTIVE') {
        // Se foi considerado eficaz e estava aguardando validação, conclui o plano
        await tx.actionPlan.update({
          where: { id: actionPlanId },
          data: { 
            status: 'COMPLETED',
            completedAt: plan.completedAt || new Date()
          }
        });

        await tx.actionPlanHistory.create({
          data: {
            actionPlanId,
            userId: authUser.id,
            action: 'VERIFIED',
            previousValue: plan.status,
            newValue: 'COMPLETED',
            details: `Eficácia VALIDADA como EFICAZ por ${authUser.name}. Parecer: "${notes || 'Medidas eficazes'}".`
          }
        });
      }

      // Notifica o responsável sobre o resultado
      if (plan.responsibleId && plan.responsibleId !== authUser.id) {
        await tx.actionPlanNotification.create({
          data: {
            actionPlanId,
            userId: plan.responsibleId,
            type: result === 'EFFECTIVE' ? 'APPROVED' : 'RETURNED',
            title: `Validação de Eficácia: ${result === 'EFFECTIVE' ? 'Aprovada' : 'Atenção Necessária'}`,
            message: `O verificador ${authUser.name} avaliou a eficácia do plano ${plan.code} como ${result}.`
          }
        });
      }

      return verif;
    });

    return NextResponse.json({ success: true, verification: verificationRecord });
  } catch (error: any) {
    console.error('Erro na verificação de eficácia:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar verificação de eficácia' }, { status: 500 });
  }
}
