import crypto from 'crypto';
// app/api/auth/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { 
  hashPassword, 
  verifyAndMigratePassword, 
  createSessionToken, 
  getSessionCookieHeader, 
  getLogoutCookieHeader,
  getAuthenticatedUser,
  checkAuthRateLimit, 
  recordAuthFailure, 
  resetAuthRateLimit, 
  logSecurityEvent,
  getClientIp
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 1. GET: Retorna o usuário da sessão ativa atual validado pelo servidor
export async function GET(req: Request) {
  try {
    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        company: true,
        companyId: true,
        photoURL: true
      }
    });

    return NextResponse.json({ success: true, user: fullUser });
  } catch (error) {
    console.error('Erro no GET /api/auth:', error);
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}

// 2. POST: Login, Cadastro ou Logout
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, email, password, name, role, company, companyName, secretKey } = body;

    const ip = getClientIp(req);

    // AÇÃO: LOGOUT
    if (action === 'logout') {
      const response = NextResponse.json({ success: true, message: 'Sessão encerrada com sucesso' });
      response.headers.set('Set-Cookie', getLogoutCookieHeader());
      logSecurityEvent('LOGOUT', { ip });
      return response;
    }


    // Validações básicas de entrada
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'E-mail é obrigatório' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = typeof password === 'string' ? password.trim() : '';

    if (!cleanPassword) {
      return NextResponse.json({ success: false, error: 'Senha é obrigatória' }, { status: 400 });
    }

    const rateKey = `${ip}_${cleanEmail}`;

    // --- AÇÃO: CADASTRO DE NOVO ORGANIZADOR ---
    const isRegister = action === 'register';

    if (isRegister) {
      if (cleanPassword.length < 6) {
        return NextResponse.json({ success: false, error: 'A senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
      }

      // 1. Verifica se o e-mail já existe
      const existingUser = await prisma.user.findUnique({
        where: { email: cleanEmail }
      });

      if (existingUser) {
        return NextResponse.json({ 
          success: false, 
          error: 'Este e-mail já possui cadastro no DDS ON. Por favor, utilize a opção de Login.' 
        }, { status: 409 });
      }

      // 2. Empresa e aprovação. O controle de acesso fica no DDS Master:
      // - empresa existente + palavra-chave correta → conta ativa na hora;
      // - qualquer outro caso (sem chave, chave errada, empresa que ainda não existe)
      //   → conta aguardando aprovação na fila do DDS Master, sem acesso a nada.
      // Antes, qualquer pessoa entrava direto em qualquer empresa só digitando o nome,
      // e um nome novo criava a empresa automaticamente.
      const resolvedCompany = (company?.trim() || companyName?.trim() || '').slice(0, 150);
      if (!resolvedCompany) {
        return NextResponse.json({ success: false, error: 'Informe o nome da empresa.' }, { status: 400 });
      }
      const companyRecord = await prisma.company.findFirst({
        where: { name: { equals: resolvedCompany, mode: 'insensitive' } }
      });
      const hashedPassword = await hashPassword(cleanPassword);
      const userData = {
        name: name?.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: hashedPassword,
        position: role?.trim() || 'Técnico em Segurança do Trabalho',
        role: 'ORGANIZER' as const
      };

      const providedKey = typeof secretKey === 'string' ? secretKey.trim().toUpperCase() : '';
      const companyKey = (companyRecord?.secretKey || '').trim().toUpperCase();
      const keyMatches = Boolean(companyKey && providedKey) && providedKey.length === companyKey.length &&
        crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(companyKey));
      const approved = Boolean(companyRecord && keyMatches && companyRecord.autoApproveWithKey && companyRecord.status === 'ACTIVE');

      if (!approved || !companyRecord) {
        const pendingUser = await prisma.user.create({
          data: {
            ...userData,
            status: 'PENDING_APPROVAL',
            // Empresa existente: já fica vinculada (o Master só aprova). Empresa nova:
            // fica sem vínculo e o Master cria a empresa ou vincula na aprovação.
            company: companyRecord?.name || resolvedCompany,
            companyId: companyRecord?.id || null
          }
        });
        logSecurityEvent('ADMIN_ACTION', { userId: pendingUser.id, reason: `REGISTRATION_PENDING_APPROVAL (${companyRecord ? 'company ' + companyRecord.id : 'new company name'})`, ip });
        return NextResponse.json({
          success: true,
          autoApproved: false,
          pendingApproval: true,
          message: 'Cadastro recebido. Seu acesso será liberado após a aprovação.'
        });
      }

      // 3. Conta ativa (empresa existente + palavra-chave correta).
      const newUser = await prisma.user.create({
        data: { ...userData, status: 'ACTIVE', company: companyRecord.name, companyId: companyRecord.id }
      });

      // 4. Emissão de Sessão Segura
      const sessionToken = createSessionToken({
        id: newUser.id,
        email: newUser.email,
        role: String(newUser.role)
      });

      logSecurityEvent('LOGIN_SUCCESS', { userId: newUser.id, email: newUser.email, ip });

      const safeUser = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        position: newUser.position,
        company: newUser.company,
        companyId: newUser.companyId,
        photoURL: newUser.photoURL || null
      };

      const response = NextResponse.json({
        success: true,
        user: safeUser,
        token: sessionToken,
        autoApproved: true
      });

      response.headers.set('Set-Cookie', getSessionCookieHeader(sessionToken));
      return response;
    }

    // --- AÇÃO: LOGIN COM VALIDAÇÃO REAL DE SENHA ---
    // Proteção contra ataques de força bruta
    const rateCheck = checkAuthRateLimit(rateKey);
    if (!rateCheck.allowed) {
      logSecurityEvent('LOGIN_FAILED', { email: cleanEmail, ip, reason: 'RATE_LIMIT_EXCEEDED' });
      return NextResponse.json({
        success: false,
        error: `Muitas tentativas incorretas. Aguarde ${rateCheck.waitSeconds} segundos antes de tentar novamente.`
      }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { companyRel: true }
    });

    // Proteção contra Enumeração de Usuários: Resposta idêntica para usuário inexistente
    if (!user) {
      recordAuthFailure(rateKey);
      logSecurityEvent('LOGIN_FAILED', { email: cleanEmail, ip, reason: 'USER_NOT_FOUND' });
      return NextResponse.json({
        success: false,
        error: 'E-mail ou senha inválidos.'
      }, { status: 401 });
    }

    // Cadastro aguardando aprovação do administrador da empresa
    if (user.status === 'PENDING_APPROVAL') {
      const pendingPasswordOk = await verifyAndMigratePassword(cleanPassword, user.password, user.id);
      if (!pendingPasswordOk) {
        recordAuthFailure(rateKey);
        return NextResponse.json({ success: false, error: 'E-mail ou senha inválidos.' }, { status: 401 });
      }
      logSecurityEvent('LOGIN_FAILED', { userId: user.id, email: cleanEmail, ip, reason: 'PENDING_APPROVAL' });
      return NextResponse.json({
        success: false,
        error: 'Seu cadastro está aguardando aprovação. Fale com o responsável pelo DDS ON na sua empresa para liberar o acesso.'
      }, { status: 403 });
    }

    // Verifica se a conta está bloqueada ou suspensa
    if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      logSecurityEvent('LOGIN_FAILED', { userId: user.id, email: cleanEmail, ip, reason: 'ACCOUNT_BLOCKED' });
      return NextResponse.json({
        success: false,
        error: 'Sua conta está suspensa ou bloqueada. Contate o administrador.'
      }, { status: 403 });
    }

    // VALIDAÇÃO CRIPTOGRÁFICA DE SENHA (com migração progressiva se a senha for legada)
    const isPasswordValid = await verifyAndMigratePassword(cleanPassword, user.password, user.id);

    if (!isPasswordValid) {
      recordAuthFailure(rateKey);
      logSecurityEvent('LOGIN_FAILED', { userId: user.id, email: cleanEmail, ip, reason: 'INVALID_PASSWORD' });
      return NextResponse.json({
        success: false,
        error: 'E-mail ou senha inválidos.'
      }, { status: 401 });
    }

    // Sucesso: Reseta contador de tentativas
    resetAuthRateLimit(rateKey);

    // Emissão de Sessão Segura
    const sessionToken = createSessionToken({
      id: user.id,
      email: user.email,
      role: String(user.role)
    });

    logSecurityEvent('LOGIN_SUCCESS', { userId: user.id, email: user.email, ip });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      position: user.position,
      company: user.company || user.companyRel?.name || '',
      companyId: user.companyId,
      photoURL: user.photoURL || null
    };

    const response = NextResponse.json({
      success: true,
      user: safeUser,
      token: sessionToken
    });

    // Define cookie HTTP-Only seguro
    response.headers.set('Set-Cookie', getSessionCookieHeader(sessionToken));
    return response;

  } catch (error) {
    // Sanitização de Logs: Registramos a stack/motivo no servidor para debug (Vercel Logs)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Erro interno na rota /api/auth:', errorMessage);
    return NextResponse.json({ success: false, error: `Falha interna: ${errorMessage}` }, { status: 500 });
  }
}
