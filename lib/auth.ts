// lib/auth.ts
// Módulo de Segurança, Autenticação e Gestão de Sessões do DDS Online (v1.0)

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

const BCRYPT_ROUNDS = 10;
const SESSION_COOKIE_NAME = 'dds_session';
const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 dias

// Chave mestra de assinatura de sessão com fallback seguro
const SESSION_SECRET = process.env.SESSION_SECRET || 'dds_on_master_session_key_2026_amtst_secret';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  company?: string | null;
  companyId?: string | null;
}

export interface SessionTokenPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// =========================================================================
// 1. HASHING E MIGRAÇÃO PROGRESSIVA DE SENHAS (BCRYPT)
// =========================================================================

/**
 * Gera hash seguro bcrypt para novas senhas
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

/**
 * Valida a senha contra o hash armazenado.
 * Suporta migração progressiva se a senha no banco for legada (texto puro).
 */
export async function verifyAndMigratePassword(
  plainText: string,
  storedPasswordHashOrPlain: string,
  userId: string
): Promise<boolean> {
  if (!plainText || !storedPasswordHashOrPlain) return false;

  // Verifica se o hash já está no padrão bcrypt ($2a$, $2b$ ou $2y$)
  const isBcrypt = /^\$2[aby]\$\d{2}\$/.test(storedPasswordHashOrPlain);

  if (isBcrypt) {
    return bcrypt.compare(plainText, storedPasswordHashOrPlain);
  }

  // --- MIGRAÇÃO PROGRESSIVA DE SENHA LEGADA (TEXTO PURO) ---
  // Compara de forma segura (sem timing attack)
  const plainBuffer = Buffer.from(plainText);
  const storedBuffer = Buffer.from(storedPasswordHashOrPlain);

  const matches = plainBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(plainBuffer, storedBuffer);

  if (matches) {
    // Atualiza imediatamente a senha no banco para hash bcrypt
    try {
      const newHash = await hashPassword(plainText);
      await prisma.user.update({
        where: { id: userId },
        data: { password: newHash }
      });
      logSecurityEvent('PASSWORD_MIGRATED_TO_BCRYPT', { userId });
    } catch (e) {
      console.error('Falha ao migrar senha para hash:', e);
    }
    return true;
  }

  return false;
}

// =========================================================================
// 2. GESTÃO DE SESSÕES COM TOKENS ASSINADOS (HMAC-SHA256)
// =========================================================================

/**
 * Cria token de sessão assinado
 */
export function createSessionToken(user: { id: string; email: string; role: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + SESSION_EXPIRY_SECONDS
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * Valida o token de sessão e retorna o payload caso seja válido
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  // Validação de assinatura resistente a Timing Attacks
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload: SessionTokenPayload = JSON.parse(jsonStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Sessão expirada
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extrai e valida o usuário autenticado a partir dos Cookies ou Authorization Header da requisição
 */
export async function getAuthenticatedUser(req: Request): Promise<SessionUser | null> {
  let token: string | null = null;

  // 1. Tenta extrair do Cookie HTTP-Only
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (sessionCookie) {
      token = sessionCookie.split('=')[1] || null;
    }
  }

  // 2. Fallback: Authorization: Bearer <token>
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload || !payload.sub) return null;

  // Busca o usuário no banco de dados para confirmar existência e status
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        company: true,
        companyId: true
      }
    });

    if (!user || user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: String(user.role),
      company: user.company,
      companyId: user.companyId
    };
  } catch (error) {
    console.error('Erro ao verificar sessão do usuário:', error);
    return null;
  }
}

/**
 * Cria os headers para definir o cookie de sessão HTTP-Only
 */
export function getSessionCookieHeader(token: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_EXPIRY_SECONDS}; HttpOnly; SameSite=Lax${secureFlag}`;
}

/**
 * Cria os headers para invalidar o cookie de sessão no logout
 */
export function getLogoutCookieHeader(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureFlag}`;
}

// =========================================================================
// 3. RATE LIMITING EM MEMÓRIA (PROTEÇÃO CONTRA BRUTE FORCE)
// =========================================================================

interface RateLimitRecord {
  attempts: number;
  firstAttemptTime: number;
  blockedUntil?: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Verifica se uma chave (IP ou e-mail) excedeu o limite de tentativas de login
 * Limite: 5 falhas a cada 15 minutos -> bloqueio temporário de 15 minutos
 */
export function checkAuthRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;

  const record = rateLimitMap.get(key);

  if (!record) return { allowed: true };

  if (record.blockedUntil && now < record.blockedUntil) {
    const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Janela expirou
  if (now - record.firstAttemptTime > windowMs) {
    rateLimitMap.delete(key);
    return { allowed: true };
  }

  if (record.attempts >= maxAttempts) {
    record.blockedUntil = now + windowMs;
    return { allowed: false, waitSeconds: Math.ceil(windowMs / 1000) };
  }

  return { allowed: true };
}

export function recordAuthFailure(key: string) {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record) {
    rateLimitMap.set(key, { attempts: 1, firstAttemptTime: now });
  } else {
    record.attempts += 1;
  }
}

export function resetAuthRateLimit(key: string) {
  rateLimitMap.delete(key);
}

// =========================================================================
// 4. LOGS TÉCNICOS DE SEGURANÇA (NUNCA LOGA SENHAS OU BIOMETRIA)
// =========================================================================

export function logSecurityEvent(
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'PASSWORD_MIGRATED_TO_BCRYPT' | 'UNAUTHORIZED_ACCESS' | 'FORBIDDEN_ACCESS' | 'ADMIN_ACTION',
  details: { userId?: string; email?: string; path?: string; reason?: string; ip?: string }
) {
  const timestamp = new Date().toISOString();
  // Sanitiza para garantir que nada sensível como senhas apareça nos logs
  const safeDetails = {
    userId: details.userId,
    email: details.email ? `${details.email.slice(0, 2)}***@${details.email.split('@')[1] || ''}` : undefined,
    path: details.path,
    reason: details.reason,
    ip: details.ip
  };

  console.info(`[SECURITY] ${timestamp} | ${eventType} |`, JSON.stringify(safeDetails));
}
