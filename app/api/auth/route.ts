import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { email, password, name, companyName } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'E-mail é obrigatório' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Busca se o usuário já existe
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { companyRel: true }
    });

    // 2. Se não existir, cria o usuário e sua empresa no banco
    if (!user) {
      let company = null;
      if (companyName) {
        company = await prisma.company.create({
          data: {
            name: companyName.trim(),
            status: 'ACTIVE'
          }
        });
      }

      user = await prisma.user.create({
        data: {
          name: name?.trim() || cleanEmail.split('@')[0],
          email: cleanEmail,
          password: password || '123456',
          role: 'ORGANIZER',
          status: 'ACTIVE',
          position: 'Técnico em Segurança do Trabalho',
          company: companyName?.trim() || 'Empresa Padrão',
          companyId: company?.id || null
        },
        include: { companyRel: true }
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position,
        company: user.company || user.companyRel?.name || '',
        companyId: user.companyId
      }
    });
  } catch (error) {
    console.error("Erro na autenticação:", error);
    return NextResponse.json({ success: false, error: 'Falha ao autenticar usuário' }, { status: 500 });
  }
}
