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
      let finalStatus = 'PENDING_APPROVAL'; // Por padrão, vai para a fila

      // Se o técnico digitou uma palavra-chave, procura a empresa no banco
      if (secretKey && secretKey.trim() !== '') {
        const foundCompany = await prisma.company.findFirst({
          where: { secretKey: String(secretKey).trim().toUpperCase() }
        });

        if (foundCompany) {
          companyId = foundCompany.id;
          companyNameStr = foundCompany.name; // Puxa o nome real da empresa do banco
          
          // Se a empresa permite aprovação automática, já libera o técnico!
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
    // 2. LOGIN DO TÉCNICO
    // =========================================================================
    if (action === 'login') {
      let user = await prisma.user.findUnique({
        where: { email: cleanEmail }
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
          }
        });
      }

      if (!user || user.password !== cleanPassword) {
        return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 });
      }

      if (cleanEmail === 'admin@dds.com.br' && user.status !== 'ACTIVE') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE' }
        });
      }

      if (user.status === 'PENDING_APPROVAL') {
        return NextResponse.json(
          { success: false, error: '⛔ Seu cadastro está na fila de aprovação do DDS MASTER. Aguarde a liberação.' },
          { status: 403 }
        );
      }

      if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
        return NextResponse.json(
          { success: false, error: '⛔ Acesso Bloqueado ou Suspenso. Entre em contato com a AM TST.' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company || 'Unidade',
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