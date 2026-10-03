'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { fetchAuthSession, logoutSession, type AuthSession } from '@/lib/authApi';

type AuthContextValue = AuthSession & {
  loading: boolean;
  error: string;
  canEdit: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>({ role: 'anonymous', public_mode: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      setSession(await fetchAuthSession());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取登录状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const logout = async () => {
    await logoutSession();
    await refresh();
  };

  return (
    <AuthContext.Provider value={{
      ...session,
      loading,
      error,
      canEdit: !session.public_mode || session.role === 'admin',
      refresh,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
