import idTranslations from './translations/id.json';
import enTranslations from './translations/en.json';
import type { Language } from '@/types';

const translations = {
  id: idTranslations,
  en: enTranslations,
};

export function getTranslation(language: Language, key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: unknown = translations[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }
  
  if (!value || typeof value !== 'string') return key;
  
  if (params) {
    return Object.entries(params).reduce((str, [k, v]) => {
      return str.replace(`{${k}}`, String(v));
    }, value);
  }
  
  return value;
}

export { translations };

