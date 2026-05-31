import { create } from "zustand";

interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; name: string; email?: string } | null;
  setUser: (user: { id: string; name: string; email?: string } | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));