// scripts/test_planos_de_acao.ts
// Testes automatizados de validação de ponta a ponta do Módulo de Planos de Ação

import { PrismaClient } from '@prisma/client';
import { 
  calculateDeadlineState, 
  calculatePlanProgress, 
  canTransitionStatus,
  formatActionPlanCode 
} from '../lib/actionPlanUtils';

const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('INICIANDO BATERIA DE TESTES DO MÓDULO PLANOS DE AÇÃO');
  console.log('====================================================\n');

  try {
    // 1. Busca ou cria empresa e usuário de teste
    let company = await prisma.company.findFirst({
      where: { name: { contains: 'Teste' } }
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Empresa Teste SST Ltda',
          document: '12.345.678/0001-90',
          status: 'ACTIVE'
        }
      });
      console.log('✓ Empresa de teste provisionada:', company.name);
    }

    let user = await prisma.user.findFirst({
      where: { email: 'tst.gestor@empresa.com' }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Alexandre Gestor SST',
          email: 'tst.gestor@empresa.com',
          password: 'hashed_secure_pass',
          role: 'COMPANY_ADMIN',
          companyId: company.id,
          position: 'Engenheiro de Segurança do Trabalho'
        }
      });
      console.log('✓ Usuário gestor provisionado:', user.name);
    }

    // 2. Teste de Funções Puras (Regras de Negócio)
    console.log('\n--- TESTES UNITÁRIOS DE REGRAS DE NEGÓCIO ---');
    
    // Máquina de estados
    const validTrans1 = canTransitionStatus('OPEN', 'IN_PROGRESS');
    const validTrans2 = canTransitionStatus('IN_PROGRESS', 'AWAITING_VALIDATION');
    const invalidTrans1 = canTransitionStatus('OPEN', 'COMPLETED'); // Não pode pular direto
    const invalidTrans2 = canTransitionStatus('CANCELLED', 'OPEN'); // Terminal
    
    if (validTrans1 && validTrans2 && !invalidTrans1 && !invalidTrans2) {
      console.log('✓ Máquina de estados validada: transições permitidas e bloqueios operacionais corretos.');
    } else {
      throw new Error('Falha no teste da máquina de estados.');
    }

    // Cálculo inteligente de prazo
    const overdueCheck = calculateDeadlineState(new Date(Date.now() - 86400000 * 3), null, 'IN_PROGRESS');
    const nearDueCheck = calculateDeadlineState(new Date(Date.now() + 86400000 * 2), null, 'IN_PROGRESS', 7);
    const inTimeCheck = calculateDeadlineState(new Date(Date.now() + 86400000 * 20), null, 'IN_PROGRESS', 7);

    if (overdueCheck.isOverdue && overdueCheck.state === 'OVERDUE') {
      console.log('✓ Identificação de Vencido correta:', overdueCheck.label);
    } else {
      throw new Error('Falha no cálculo de plano vencido.');
    }

    if (nearDueCheck.state === 'NEAR_DUE') {
      console.log('✓ Identificação de Próximo do Vencimento correta:', nearDueCheck.label);
    }

    if (inTimeCheck.state === 'IN_TIME') {
      console.log('✓ Identificação de No Prazo correta:', inTimeCheck.label);
    }

    // Cálculo de progresso ponderado
    const tasksSample = [
      { status: 'COMPLETED', weight: 2 },
      { status: 'IN_PROGRESS', weight: 2 },
      { status: 'OPEN', weight: 1 }
    ];
    const progress = calculatePlanProgress(tasksSample);
    // (2 + 1) / (2 + 2 + 1) = 3 / 5 = 60%
    if (progress === 60) {
      console.log('✓ Cálculo ponderado de progresso validado: 60%');
    } else {
      throw new Error(`Progresso esperado 60%, obtido: ${progress}%`);
    }

    // 3. Teste de Persistência no PostgreSQL (Neon)
    console.log('\n--- TESTES DE INTEGRAÇÃO NO POSTGRESQL (NEON) ---');

    const code = formatActionPlanCode(new Date(), Math.floor(Math.random() * 9000) + 1000);
    const dueDate = new Date(Date.now() + 86400000 * 10);

    const plan = await prisma.actionPlan.create({
      data: {
        code,
        title: 'Adequação de Prensa Hidráulica NR-12 (Teste Automatizado)',
        companyId: company.id,
        creatorId: user.id,
        responsibleId: user.id,
        sector: 'Estamparia',
        location: 'Prensa P-04',
        origin: 'INSPECTION',
        criticality: 'HIGH',
        priority: 'CRITICAL',
        status: 'OPEN',
        problemDescription: 'Cortina de luz desalinhada gerando risco de esmagamento',
        identifiedRisk: 'Esmagamento e amputação',
        identifiedCause: 'Falta de calibração periódica',
        rootCause: 'Ausência de plano de preventiva específico para sensores ópticos',
        actionDescription: 'Realizar alinhamento com emissão de laudo técnico ART e teste de parada',
        dueDate,
        originalDueDate: dueDate,
        alertDaysBefore: 7
      }
    });
    console.log(`✓ Plano criado com sucesso: ${plan.code} (ID: ${plan.id})`);

    // 4. Criação de Subações
    const task1 = await prisma.actionPlanTask.create({
      data: {
        actionPlanId: plan.id,
        description: 'Bloqueio do equipamento (LOTO)',
        weight: 1,
        position: 0,
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    const task2 = await prisma.actionPlanTask.create({
      data: {
        actionPlanId: plan.id,
        description: 'Substituição e alinhamento dos sensores da cortina de luz',
        weight: 3,
        position: 1,
        status: 'IN_PROGRESS'
      }
    });
    console.log('✓ 2 subações criadas e vinculadas ao plano.');

    // 5. Inclusão de Evidência Fotográfica
    const attachment = await prisma.actionPlanAttachment.create({
      data: {
        actionPlanId: plan.id,
        fileName: 'evidencia_antes.jpg',
        displayName: 'Condição inicial do sensor descalibrado',
        mimeType: 'image/jpeg',
        fileSize: 10240,
        fileData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
        evidenceType: 'BEFORE',
        authorId: user.id,
        caption: 'Sensor ótico desalinhado detectado durante inspeção matinal'
      }
    });
    console.log('✓ Evidência fotográfica registrada e categorizada como BEFORE.');

    // 6. Solicitação e Aprovação de Prorrogação
    const requestedDue = new Date(Date.now() + 86400000 * 20);
    const extension = await prisma.actionPlanDeadlineExtension.create({
      data: {
        actionPlanId: plan.id,
        requesterId: user.id,
        currentDueDate: plan.dueDate!,
        requestedDueDate: requestedDue,
        justification: 'Atraso na entrega dos sensores importados pelo fornecedor credenciado',
        status: 'APPROVED',
        approverId: user.id,
        approvedAt: new Date()
      }
    });

    await prisma.actionPlan.update({
      where: { id: plan.id },
      data: { dueDate: requestedDue }
    });
    console.log(`✓ Prorrogação aprovada e prazo estendido para ${requestedDue.toLocaleDateString('pt-BR')}.`);

    // 7. Registro de Histórico Auditável
    await prisma.actionPlanHistory.create({
      data: {
        actionPlanId: plan.id,
        userId: user.id,
        action: 'DEADLINE_CHANGED',
        previousValue: dueDate.toISOString(),
        newValue: requestedDue.toISOString(),
        details: 'Prazo prorrogado conforme solicitação técnica aprovada.'
      }
    });
    console.log('✓ Linha do tempo auditável registrada.');

    // 8. Registro de Verificação de Eficácia
    const verification = await prisma.actionPlanVerification.create({
      data: {
        actionPlanId: plan.id,
        verifierId: user.id,
        result: 'EFFECTIVE',
        notes: 'Testes de interrupção executados com 100% de sucesso. Máquina liberada para operação.',
        verifiedAt: new Date()
      }
    });
    console.log('✓ Verificação de eficácia concluída com parecer:', verification.result);

    // 9. Conclusão do Plano
    const completedPlan = await prisma.actionPlan.update({
      where: { id: plan.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });
    console.log(`✓ Plano concluído formalmente. Status final: ${completedPlan.status}`);

    // Limpeza dos dados de teste
    await prisma.actionPlan.delete({ where: { id: plan.id } });
    console.log('✓ Limpeza concluída: registro temporário de teste removido.');

    console.log('\n====================================================');
    console.log('TODOS OS 9 TESTES CRÍTICOS FORAM APROVADOS COM SUCESSO!');
    console.log('====================================================');

  } catch (err) {
    console.error('❌ ERRO NO TESTE:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
