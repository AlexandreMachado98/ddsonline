import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let userDbInitialized = false;
async function ensureUserColumns() {
  if (userDbInitialized) return;
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "photoURL" TEXT;');
    userDbInitialized = true;
  } catch (e) {
    console.error('ensureUserColumns error:', e);
  }
}

// 1. GET: Retorna dados do perfil do usuário autenticado
export async function GET(req: Request) {
  try {
    await ensureUserColumns();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Identificador do usuário ausente.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        position: true,
        company: true,
        companyId: true,
        photoURL: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Erro no GET /api/usuario/perfil:', error);
    return NextResponse.json({ success: false, error: 'Falha ao buscar dados do perfil.' }, { status: 500 });
  }
}

// 2. PUT: Atualização SEGURA do perfil (somente name e photoURL)
export async function PUT(req: Request) {
  try {
    await ensureUserColumns();
    const body = await req.json().catch(() => ({}));
    const { userId, name, photoURL, role, status, companyId, email } = body;

    // REGRA DE SEGURANÇA DDS MASTER:
    // Se o cliente enviar tentativa de alterar permissões, negar estritamente
    if (role !== undefined || status !== undefined || companyId !== undefined || email !== undefined) {
      return NextResponse.json({
        success: false,
        error: 'Ação não permitida: Permissões, e-mail e status são controlados exclusivamente pelo DDS Master.'
      }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Identificador do usuário ausente.' }, { status: 400 });
    }

    // Validação de Existência
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado.' }, { status: 404 });
    }

    // Whitelist estrita de campos editáveis
    const dataToUpdate: { name?: string; photoURL?: string | null } = {};

    // 1. Validação do Nome de Exibição
    if (name !== undefined) {
      const cleanName = String(name).replace(/\s+/g, ' ').trim();
      if (cleanName.length < 2) {
        return NextResponse.json({ success: false, error: 'O nome deve ter no mínimo 2 caracteres.' }, { status: 400 });
      }
      if (cleanName.length > 60) {
        return NextResponse.json({ success: false, error: 'O nome deve ter no máximo 60 caracteres.' }, { status: 400 });
      }
      dataToUpdate.name = cleanName;
    }

    // 2. Validação da Foto de Perfil
    if (photoURL !== undefined) {
      if (photoURL === null || photoURL === '') {
        dataToUpdate.photoURL = null; // Remoção da foto
      } else if (typeof photoURL === 'string') {
        // Validação de formato DataURL seguro
        const isDataUrl = photoURL.startsWith('data:image/jpeg') || 
                          photoURL.startsWith('data:image/png') || 
                          photoURL.startsWith('data:image/webp');
        const isHttpUrl = photoURL.startsWith('http://') || photoURL.startsWith('https://');

        if (!isDataUrl && !isHttpUrl) {
          return NextResponse.json({ success: false, error: 'Formato de imagem inválido. Use JPG, PNG ou WebP.' }, { status: 400 });
        }

        // Limite de segurança de tamanho de avatar (700KB em base64 ~ 500KB binário)
        if (photoURL.length > 700000) {
          return NextResponse.json({ success: false, error: 'A imagem é muito grande. Tamanho máximo permitido: 500KB.' }, { status: 400 });
        }

        dataToUpdate.photoURL = photoURL;
      } else {
        return NextResponse.json({ success: false, error: 'Formato inválido para foto.' }, { status: 400 });
      }
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum campo válido para atualização.' }, { status: 400 });
    }

    // Executa a atualização segura no PostgreSQL
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        position: true,
        company: true,
        companyId: true,
        photoURL: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Perfil atualizado com sucesso!',
      user: updatedUser
    });
  } catch (error: any) {
    console.error('Erro no PUT /api/usuario/perfil:', error);
    return NextResponse.json({ success: false, error: 'Falha ao atualizar perfil do usuário.' }, { status: 500 });
  }
}
