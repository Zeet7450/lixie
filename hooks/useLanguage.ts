'use client';

import { useCallback } from 'react';
import { useRegionStore } from '@/store/region';
import { getTranslation } from '@/lib/i18n';
import type { Language } from '@/types';

export function useLanguage() {
  const { getDisplayLanguage } = useRegionStore();
  const language = getDisplayLanguage();
  
  const t = useCallback((key: string, params?: Record<string, any>) => {
    return getTranslation(language, key, params);
  }, [language]);

  return {
    language,
    t,
    isIndonesian: language === 'id',
    isEnglish: language === 'en',
  };
}

