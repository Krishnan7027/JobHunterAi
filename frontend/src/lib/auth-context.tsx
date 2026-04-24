"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getToken, getUser, setAuth as storeAuth, clearAuth as removeAuth, type AuthUser } from "./auth";

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  login: (data: { access_token: string; user_id: number; username: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = getUser();
    if (stored && getToken()) {
      setUser(stored);
    }
  }, []);

  const login = useCallback((data: { access_token: string; user_id: number; username: string }) => {
    storeAuth(data);
    setUser({ ...data });
  }, []);

  const logout = useCallback(() => {
    removeAuth();
    setUser(null);
    window.location.href = "/login";
  }, []);

  // Prevent hydration mismatch — render nothing auth-dependent until mounted
  if (!mounted) {
    return <AuthContext.Provider value={{ user: null, isLoggedIn: false, login, logout }}>{children}</AuthContext.Provider>;
  }

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
