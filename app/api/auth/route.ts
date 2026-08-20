 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, email, password, name, role, company } = body;

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();

    // =========================================================================
    // 1. AÇÃO: CADASTRO DE NOVO TÉCNICO (Salva como PENDENTE para o dds-master)
    // =========================================================================
    if (action === 'register') {
      const existing = await (prisma as any).user.findUnique({
        where: { email: cleanEmail }
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Este e-mail já está cadastrado no sistema.' },
          { status: 400 }
        );
      }

      const newUser = await (prisma as any).user.create({
        data: {
          name: String(name || '').trim(),
          email: cleanEmail,
          password: cleanPassword,
          role: 'ORGANIZER',
          status: 'PENDING_APPROVAL', // Aparece na fila do dds-master para aprovação
          position: String(role || 'Técnico em Segurança do Trabalho').trim(),
          company: String(company || 'Unidade Rural').trim()
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Cadastro recebido! Aguarde a aprovação da moderação.',
        user: newUser
      });
    }

    // =========================================================================
    // 2. AÇÃO: LOGIN (Verifica se foi APROVADO no dds-master)
    // =========================================================================
    if (action === 'login') {
      let user = await (prisma as any).user.findUnique({
        where: { email: cleanEmail }
      });

      // Conta de Administrador Padrão
      if (!user && cleanEmail === 'admin@dds.com.br' && cleanPassword === '123456') {
        user = await (prisma as any).user.create({
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
        return NextResponse.json(
          { success: false, error: 'E-mail ou senha incorretos.' },
          { status: 401 }
        );
      }

      // Se for o admin principal, garante status ACTIVE
      if (cleanEmail === 'admin@dds.com.br' && user.status !== 'ACTIVE') {
        user = await (prisma as any).user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE' }
        });
      }

      // Trava 1: Se o usuário ainda não foi aprovado pelo dds-master
      if (user.status === 'PENDING_APPROVAL') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Seu cadastro ainda está em análise pela equipe da AM TST no DDS MASTER. Aguarde a liberação do seu acesso.' 
          },
          { status: 403 }
        );
      }

      // Trava 2: Se o usuário estiver bloqueado ou suspenso
      if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Seu acesso foi suspenso. Entre em contato com o suporte da AM TST.' 
          },
          { status: 403 }
        );
      }

      // Login aprovado com sucesso!
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company || 'Unidade Rural',
          status: user.status || 'ACTIVE'
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    console.error("Erro no Auth:", error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}