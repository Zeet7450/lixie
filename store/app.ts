import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Language } from '@/types';
import { generateFingerprint } from '@/lib/fingerprint';

interface AppStore {
  language: Language;
  isDarkMode: boolean;
  userFingerprint: string;
  setLanguage: (lang: Language) => void;
  toggleDarkMode: () => void;
  setUserFingerprint: (fingerprint: string) => void;
}

const getStorage = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return localStorage;
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      language: 'id',
      isDarkMode: false,
      userFingerprint: typeof window !== 'undefined' ? generateFingerprint() : 'default',
      setLanguage: (lang) => set({ language: lang }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setUserFingerprint: (fingerprint) => set({ userFingerprint: fingerprint }),
    }),
    {
      name: 'lixie-app-storage',
      storage: createJSONStorage(() => getStorage() as any),
    }
  )
);

