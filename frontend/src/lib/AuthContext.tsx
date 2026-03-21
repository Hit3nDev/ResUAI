"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const t = localStorage.getItem("resuai_token");
      const u = localStorage.getItem("resuai_user");
      if (t && u) { setToken(t); setUser(JSON.parse(u)); }
    } catch {}
    setLoading(false);
  }, []);

  function login(t: string, u: User) {
    setToken(t); setUser(u);
    localStorage.setItem("resuai_token", t);
    localStorage.setItem("resuai_user",  JSON.stringify(u));
  }

  function logout() {
    setToken(null); setUser(null);
    localStorage.removeItem("resuai_token");
    localStorage.removeItem("resuai_user");
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
