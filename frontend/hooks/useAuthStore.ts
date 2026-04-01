'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  currentJobId: string | null;
  currentView: 'dashboard' | 'wizard' | null;
  setAuth: (user: User, token: string) => void;
  setCurrentJob: (jobId: string | null) => void;
  setView: (view: 'dashboard' | 'wizard') => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentJobId: null,
      currentView: null,
      setAuth: (user, token) => set({ user, token }),
      setCurrentJob: (jobId) => set({ currentJobId: jobId }),
      setView: (view) => set({ currentView: view }),
      logout: () => set({ user: null, token: null, currentJobId: null, currentView: null }),
    }),
    {
      name: 'transcribe-ai-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
