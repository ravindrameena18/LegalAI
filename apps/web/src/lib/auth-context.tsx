"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  type LoginPayload,
  type RegisterPayload,
  type User,
} from "./api-client";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const authSessionRef = useRef<number>(0);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    const currentSession = ++authSessionRef.current;
    try {
      setIsLoading(true);
      const currentUser = await getCurrentUser();
      if (currentSession === authSessionRef.current) {
        setUser(currentUser);
      }
    } catch {
      if (currentSession === authSessionRef.current) {
        setUser(null);
      }
    } finally {
      if (currentSession === authSessionRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const currentSession = authSessionRef.current;
    getCurrentUser()
      .then((currentUser) => {
        if (isMounted && currentSession === authSessionRef.current) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (isMounted && currentSession === authSessionRef.current) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted && currentSession === authSessionRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const currentSession = ++authSessionRef.current;
    setError(null);
    try {
      setIsLoading(true);
      const res = await loginUser(payload);
      if (currentSession === authSessionRef.current) {
        setUser(res.user);
      }
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.detail : "Login failed. Please check your credentials.";
      setError(message);
      throw err;
    } finally {
      if (currentSession === authSessionRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const currentSession = ++authSessionRef.current;
    setError(null);
    try {
      setIsLoading(true);
      const res = await registerUser(payload);
      if (currentSession === authSessionRef.current) {
        setUser(res.user);
      }
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.detail : "Registration failed. Please verify your information.";
      setError(message);
      throw err;
    } finally {
      if (currentSession === authSessionRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    ++authSessionRef.current;
    try {
      setIsLoading(true);
      await logoutUser();
    } catch {
      // Continue clearing client state even if logout request fails
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    register,
    logout,
    refresh,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
      login: async () => {},
      register: async () => {},
      logout: async () => {},
      refresh: async () => {},
      clearError: () => {},
    };
  }
  return context;
}
