import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './context';
import type { User } from '../types';
import { getToken, setToken } from '../api/client';
import * as authApi from '../api/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // If there's no token there's nothing to resolve, so we're not "loading".
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // On mount, if a token exists, try to resolve the current user.
  useEffect(() => {
    let active = true;
    if (!getToken()) return;
    authApi
      .fetchMe()
      .then((res) => {
        if (active) setUser(res.user);
      })
      .catch(() => {
        // Token is invalid/expired — clear it.
        setToken(null);
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await authApi.register(email, password);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext>
  );
}
