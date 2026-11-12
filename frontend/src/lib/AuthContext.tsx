"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { authMe } from "@/lib/api";

interface User { id: string; email: string }
interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  login:  (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null, token: null, loading: true,
  login: () => {}, logout: () => {},
});

const TOKEN_KEY = "resuai_token";
const USER_KEY  = "resuai_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null); setUser(null);
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch {}
  }, []);

  const login = useCallback((t: string, u: User) => {
    setToken(t); setUser(u);
    try { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch {}
  }, []);

  // Hydrate from localStorage, then confirm the token is still valid server-side
  // (tokens expire after 72h — without this a stale token would look "logged in").
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let t: string | null = null;
      try {
        t = localStorage.getItem(TOKEN_KEY);
        const u = localStorage.getItem(USER_KEY);
        if (t && u) { setToken(t); setUser(JSON.parse(u)); }
        else t = null;
      } catch { t = null; }

      if (t) {
        try {
          const me = await authMe();
          if (!cancelled) setUser({ id: me.id, email: me.email });
        } catch (e: any) {
          // Only drop the session when the server explicitly rejects it, not when it's merely offline.
          if (!cancelled && e?.status === 401) logout();
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [logout]);

  const value = useMemo(() => ({ user, token, loading, login, logout }), [user, token, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
