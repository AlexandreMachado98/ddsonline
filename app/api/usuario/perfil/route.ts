// app/api/usuario/perfil/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser, logSecurityEvent } from '@/lib/auth';

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

// 1. GET: Retorna dados do perfil do usuário autenticado no servidor
export async function GET(req: Request) {
  try {
    await ensureUserColumns();

    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId') || sessionUser.id;

    // Proteção IDOR: Apenas o próprio usuário ou Super Admin pode ver o perfil completo
    if (requestedUserId !== sessionUser.id && sessionUser.role !== 'SUPER_ADMIN') {
      logSecurityEvent('FORBIDDEN_ACCESS', {
        userId: sessionUser.id,
        path: `GET /api/usuario/perfil (${requestedUserId})`,
        reason: 'IDOR_ON_USER_PROFILE'
      });
      return NextResponse.json({ success: false, error: 'Acesso não autorizado ao perfil solicitado.' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: requestedUserId },
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

// 2. PUT: Atualização SEGURA do perfil (somente name e photoURL do usuário autenticado)
export async function PUT(req: Request) {
  try {
    await ensureUserColumns();

    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', { path: 'PUT /api/usuario/perfil', reason: 'NO_SESSION' });
      return NextResponse.json({ success: false, error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId, name, photoURL, role, status, companyId, email } = body;

    // REGRA DE SEGURANÇA: Bloqueio de Mass Assignment de privilégios
    if (role !== undefined || status !== undefined || companyId !== undefined || email !== undefined) {
      logSecurityEvent('FORBIDDEN_ACCESS', {
        userId: sessionUser.id,
        path: 'PUT /api/usuario/perfil',
        reason: 'MASS_ASSIGNMENT_ROLE_ATTEMPT'
      });
      return NextResponse.json({
        success: false,
        error: 'Ação não permitida: Permissões, e-mail e status não podem ser alterados pelo cliente.'
      }, { status: 403 });
    }

    const targetUserId = userId || sessionUser.id;

    // Proteção IDOR: Não permite alterar perfil de outro usuário
    if (targetUserId !== sessionUser.id && sessionUser.role !== 'SUPER_ADMIN') {
      logSecurityEvent('FORBIDDEN_ACCESS', {
        userId: sessionUser.id,
        path: `PUT /api/usuario/perfil (${targetUserId})`,
        reason: 'IDOR_ATTEMPT_ON_PROFILE_UPDATE'
      });
      return NextResponse.json({ success: false, error: 'Você não tem permissão para alterar este perfil.' }, { status: 403 });
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
        dataToUpdate.photoURL = null;
      } else if (typeof photoURL === 'string') {
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

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
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

    logSecurityEvent('ADMIN_ACTION', {
      userId: sessionUser.id,
      reason: `PROFILE_UPDATED: ${targetUserId}`
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
