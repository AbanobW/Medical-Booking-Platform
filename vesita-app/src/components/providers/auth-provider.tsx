"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as session from "@/lib/api/session";
import { onUnauthorized } from "@/lib/api/tokens";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  /** True until the stored session has been read — guards against UI flicker. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: session.RegisterInput) => Promise<User>;
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

  // Restore the session on mount. Reading storage must happen after hydration so
  // the server and first client render always agree. In live mode this is a real
  // round-trip (we hold a token, not a user), so it can resolve after unmount —
  // hence the `cancelled` guard.
  useEffect(() => {
    let cancelled = false;

    void session.restoreSession().then((restored) => {
      if (cancelled) return;
      setUserState(restored);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // The server rejected our token mid-session (expired, revoked, or — until the
  // refresh endpoint is fixed — simply 24h old). Tear the session down here too,
  // or the app keeps rendering a dashboard whose every request 401s.
  //
  // Guarded on `userRef`: a 401 while nobody is signed in (a stale token found at
  // boot) must not bounce a browsing visitor to the sign-in page.
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  useEffect(() => {
    return onUnauthorized(() => {
      if (!userRef.current) return;
      setUserState(null);
      router.replace("/login");
    });
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const next = await session.login(email, password);
    setUserState(next);
    return next;
  }, []);

  const register = useCallback(async (input: session.RegisterInput) => {
    const next = await session.register(input);
    setUserState(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await session.logout();
    setUserState(null);
    router.push("/");
  }, [router]);

  const updateProfile = useCallback(
    async (patch: Partial<User>) => {
      if (!user) throw new Error("Not signed in.");
      const next = await session.updateProfile(user.id, patch);
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
      register,
      logout,
      updateProfile,
      setUser: setUserState,
    }),
    [user, isLoading, login, register, logout, updateProfile],
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
