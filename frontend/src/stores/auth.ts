import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  setTokens: (accessToken, refreshToken, user) =>
    set({ accessToken, refreshToken, user, isAuthenticated: true }),
  logout: () =>
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
}));
