'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  position?: string;
  company?: string;
  companyId?: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  updateUserLocal: (updatedData: Partial<AuthUser>) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'dds_admin_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Inicialização síncrona imediata via cache local (Tempo de render inicial: < 5ms)
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(AUTH_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) return parsed;
      }
    } catch {}
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!user);

  // Atualização em memória e no cache local
  const updateUserLocal = useCallback((updatedData: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return null;
      const merged = { ...prev, ...updatedData };
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }, []);

  // Revalidação em segundo plano com o servidor (Stale-While-Revalidate)
  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const startTime = typeof performance !== 'undefined' ? performance.now() : 0;
      const res = await fetch('/api/auth', {
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
          } catch {}
          if (startTime > 0 && typeof performance !== 'undefined') {
            const duration = (performance.now() - startTime).toFixed(1);
            console.debug(`[PERF] Auth revalidated in ${duration}ms`);
          }
          return data.user;
        }
      } else if (res.status === 401) {
        // Sessão expirada no servidor
        setUser(null);
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {}
        return null;
      }
    } catch (err) {
      console.warn('[AUTH] Offline or network error during revalidation, using cached profile.');
    } finally {
      setIsLoading(false);
    }
    return user;
  }, [user]);

  // Executa revalidação silenciosa em background na montagem
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
    } catch {}
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('dds_company_logo');
      localStorage.removeItem('dds_draft_meeting');
    } catch {}
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        refreshUser,
        updateUserLocal,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
