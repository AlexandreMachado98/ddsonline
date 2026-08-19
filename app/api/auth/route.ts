 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, password, name, role, company } = body;

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();

    // 1. CADASTRO DE NOVO ORGANIZADOR
    if (action === 'register') {
      const existing = await (prisma as any).user.findUnique({
        where: { email: cleanEmail }
      });

      if (existing) {
        return NextResponse.json({ success: false, error: 'Este e-mail já está cadastrado.' }, { status: 400 });
      }

      const newUser = await (prisma as any).user.create({
        data: {
          name: String(name || '').trim(),
          email: cleanEmail,
          password: cleanPassword,
          role: String(role || 'Técnico em Segurança do Trabalho').trim(),
          company: String(company || 'Unidade Rural').trim()
        }
      });

      return NextResponse.json({ success: true, user: newUser });
    }

    // 2. LOGIN DO ORGANIZADOR
    if (action === 'login') {
      let user = await (prisma as any).user.findUnique({
        where: { email: cleanEmail }
      });

      // Cria a conta demo automaticamente no banco se for o primeiro login
      if (!user && cleanEmail === 'admin@dds.com.br' && cleanPassword === '123456') {
        user = await (prisma as any).user.create({
          data: {
            name: 'Alexandre Machado',
            email: 'admin@dds.com.br',
            password: '123456',
            role: 'Técnico em Segurança do Trabalho Master',
            company: 'Agropecuária Progresso'
          }
        });
      }

      if (!user || user.password !== cleanPassword) {
        return NextResponse.json({ success: false, error: 'E-mail ou senha incorretos.' }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    console.error("Erro na API de Auth:", error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro no servidor' }, { status: 500 });
  }
}