'use client';

import { useEffect } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useDarkMode();

  // Sync theme with store and update body background
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
      root.style.backgroundColor = '#0f172a';
      body.style.backgroundColor = '#0f172a';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
      root.style.backgroundColor = '#FFFDD0';
      body.style.backgroundColor = '#FFFDD0';
    }
    
    // Update theme-color meta tag
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDarkMode ? '#1e293b' : '#FFFDD0');
    }
  }, [isDarkMode]);

  return <>{children}</>;
}

