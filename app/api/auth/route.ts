 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, email, password, name, role, company, secretKey } = body;

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();

    // =========================================================================
    // 1. CADASTRO DE TÉCNICO COM VINCULAÇÃO INTELIGENTE DE EMPRESA
    // =========================================================================
    if (action === 'register') {
      const existing = await prisma.user.findUnique({
        where: { email: cleanEmail }
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Este e-mail já está cadastrado no sistema.' },
          { status: 400 }
        );
      }

      let companyId = null;
      let companyNameStr = String(company || 'Unidade Rural').trim();
      let finalStatus = 'PENDING_APPROVAL';

      if (secretKey && secretKey.trim() !== '') {
        const foundCompany = await prisma.company.findFirst({
          where: { secretKey: String(secretKey).trim().toUpperCase() }
        });

        if (foundCompany) {
          // KILL-SWITCH NO CADASTRO: Se a empresa estiver suspensa, impede o cadastro
          if (foundCompany.status === 'SUSPENDED' || foundCompany.status === 'BLOCKED') {
            return NextResponse.json(
              { success: false, error: '⛔ Esta empresa encontra-se com o acesso suspenso pela administração.' },
              { status: 403 }
            );
          }

          companyId = foundCompany.id;
          companyNameStr = foundCompany.name;
          
          if (foundCompany.autoApproveWithKey) {
            finalStatus = 'ACTIVE';
          }
        } else {
          return NextResponse.json(
            { success: false, error: 'Palavra-Chave da Empresa inválida. Verifique com seu gestor.' },
            { status: 400 }
          );
        }
      }

      const newUser = await prisma.user.create({
        data: {
          name: String(name || '').trim(),
          email: cleanEmail,
          password: cleanPassword,
          role: 'ORGANIZER',
          status: finalStatus as any,
          position: String(role || 'Técnico em Segurança do Trabalho').trim(),
          company: companyNameStr,
          companyId: companyId
        }
      });

      return NextResponse.json({
        success: true,
        pendingApproval: finalStatus === 'PENDING_APPROVAL',
        message: finalStatus === 'ACTIVE' 
          ? 'Cadastro aprovado e vinculado à empresa com sucesso!' 
          : 'Cadastro recebido! Aguarde a aprovação.',
        user: newUser
      });
    }

    // =========================================================================
    // 2. LOGIN DO TÉCNICO (COM KILL-SWITCH ATIVADO)
    // =========================================================================
    if (action === 'login') {
      let user = await prisma.user.findUnique({
        where: { email: cleanEmail },
        include: {
          companyRel: true // Inclui os dados em tempo real da Empresa vinculada
        }
      });

      if (!user && cleanEmail === 'admin@dds.com.br' && cleanPassword === '123456') {
        user = await prisma.user.create({
          data: {
            name: 'Alexandre Machado',
            email: 'admin@dds.com.br',
            password: '123456',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            position: 'Técnico Master',
            company: 'AM TST'
          },
          include: {
            companyRel: true
          }
        });
      }

      if (!user || user.password !== cleanPassword) {
        return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 });
      }

      if (cleanEmail === 'admin@dds.com.br' && user.status !== 'ACTIVE') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE' },
          include: { companyRel: true }
        });
      }

      // 1. Bloqueio por status do próprio usuário
      if (user.status === 'PENDING_APPROVAL') {
        return NextResponse.json(
          { success: false, error: '⛔ Seu cadastro está na fila de aprovação do DDS MASTER. Aguarde a liberação.' },
          { status: 403 }
        );
      }

      if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
        return NextResponse.json(
          { success: false, error: '⛔ Acesso de usuário Bloqueado ou Suspenso. Entre em contato com a AM TST.' },
          { status: 403 }
        );
      }

      // 2. KILL-SWITCH DA EMPRESA: Se a empresa estiver suspensa no DDS Master, barra o login imediatamente
      if (user.role !== 'SUPER_ADMIN' && user.companyRel) {
        if (user.companyRel.status === 'SUSPENDED' || user.companyRel.status === 'BLOCKED') {
          return NextResponse.json(
            { success: false, error: `⛔ O acesso da empresa "${user.companyRel.name}" foi SUSPENSO pelo DDS MASTER. Entre em contato com a administração.` },
            { status: 403 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.companyRel?.name || user.company || 'Unidade',
          status: user.status
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}