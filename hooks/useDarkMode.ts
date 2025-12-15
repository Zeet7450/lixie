'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/app';

export function useDarkMode() {
  const { isDarkMode, toggleDarkMode } = useAppStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Apply theme immediately to prevent flash
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [isDarkMode]);

  return {
    isDarkMode,
    toggleDarkMode,
  };
}

