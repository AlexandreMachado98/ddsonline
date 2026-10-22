// lib/actionPlanServer.ts
// Utilitários de servidor para o Módulo de Planos de Ação (Prisma / Multitenant)

import prisma from '@/lib/prisma';
import { SessionUser } from '@/lib/auth';

/**
 * Resolve e assegura um companyId válido para o usuário autenticado.
 * 1. Se authUser.companyId já estiver presente, retorna-o.
 * 2. Se for nulo no token de sessão, busca no banco de dados.
 * 3. Se for nulo no banco, localiza ou cria a Company com base no campo company (texto) do usuário.
 * 4. Atualiza o cadastro do usuário no banco com o companyId resolvido.
 */
export async function resolveUserCompanyId(
  authUser: SessionUser | { id: string; role?: string; company?: string | null; companyId?: string | null }
): Promise<string> {
  // 1. Verifica se já está presente no objeto de sessão
  if (authUser.companyId) {
    return authUser.companyId;
  }

  // 2. Busca o registro mais recente do usuário no banco
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { companyId: true, company: true }
  });

  if (dbUser?.companyId) {
    return dbUser.companyId;
  }

  const rawCompanyName = (authUser.company || dbUser?.company || '').trim();

  // 3. Tenta localizar empresa existente com nome aproximado
  if (rawCompanyName.length > 0) {
    const matched = await prisma.company.findFirst({
      where: {
        OR: [
          { name: { equals: rawCompanyName, mode: 'insensitive' } },
          { name: { contains: rawCompanyName, mode: 'insensitive' } },
          { name: { contains: rawCompanyName.split(' ')[0], mode: 'insensitive' } }
        ]
      }
    });

    if (matched) {
      await prisma.user.update({
        where: { id: authUser.id },
        data: { companyId: matched.id }
      }).catch(() => {});
      return matched.id;
    }

    // Se não encontrou nenhuma empresa com o nome, cria a empresa automaticamente
    const created = await prisma.company.create({
      data: {
        name: rawCompanyName,
        status: 'ACTIVE'
      }
    });

    await prisma.user.update({
      where: { id: authUser.id },
      data: { companyId: created.id }
    }).catch(() => {});

    return created.id;
  }

  // 4. Fallback final: primeira empresa ativa do sistema
  let defaultCompany = await prisma.company.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' }
  });

  if (!defaultCompany) {
    defaultCompany = await prisma.company.create({
      data: {
        name: 'DDS-ON Corporativo',
        status: 'ACTIVE'
      }
    });
  }

  await prisma.user.update({
    where: { id: authUser.id },
    data: { companyId: defaultCompany.id }
  }).catch(() => {});

  return defaultCompany.id;
}
