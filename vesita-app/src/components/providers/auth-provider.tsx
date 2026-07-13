"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as authApi from "@/lib/api/auth";
import type { Role, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  /** True until the stored session has been read — guards against UI flicker. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginAs: (role: Role) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  register: (input: authApi.RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<User>;
  /** Replaces the in-memory user without a round-trip. */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Restore the session on mount. Reading localStorage must happen after
  // hydration, so the server and first client render always agree.
  useEffect(() => {
    setUserState(authApi.getStoredSession());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const next = await authApi.login(email, password);
    setUserState(next);
    return next;
  }, []);

  const loginAs = useCallback(async (role: Role) => {
    const next = await authApi.loginAs(role);
    setUserState(next);
    return next;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const next = await authApi.loginWithGoogle();
    setUserState(next);
    return next;
  }, []);

  const register = useCallback(async (input: authApi.RegisterInput) => {
    const next = await authApi.register(input);
    setUserState(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUserState(null);
    router.push("/");
  }, [router]);

  const updateProfile = useCallback(
    async (patch: Partial<User>) => {
      if (!user) throw new Error("Not signed in.");
      const next = await authApi.updateProfile(user.id, patch);
      setUserState(next);
      return next;
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      loginAs,
      loginWithGoogle,
      register,
      logout,
      updateProfile,
      setUser: setUserState,
    }),
    [user, isLoading, login, loginAs, loginWithGoogle, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }
  return context;
}
