import type { Article } from '@/types';
import type { AppRegion } from '@/store/region';

/**
 * Translate article content based on region setting
 * - ID region: Keep Indonesian, translate others to Indonesian
 * - Other regions: Translate everything to English
 */
export function translateArticleForRegion(
  article: Article,
  region: AppRegion
): Article {
  // If region is ID, keep Indonesian articles as is, translate others to Indonesian
  // If region is not ID, translate everything to English
  
  if (region === 'id') {
    // For ID region, keep original language if Indonesian, otherwise translate to Indonesian
    if (article.language === 'id') {
      return article; // Already in Indonesian
    }
    // Would need translation service here - for now return as is
    return {
      ...article,
      language: 'id',
    };
  } else {
    // For other regions (EN/CN), translate to English
    // In production, this would use a translation service
    // For now, if already in English, return as is
    if (article.language === 'en') {
      return article;
    }
    // Would translate here - for now return as is with language set to en
    return {
      ...article,
      language: 'en',
    };
  }
}

/**
 * Translate article title and summary based on region
 * This is a placeholder - in production would use translation API
 */
export function translateArticleContent(
  article: Article,
  targetLanguage: 'id' | 'en'
): Article {
  // In production, this would call a translation service
  // For now, return article as is but mark language
  return {
    ...article,
    language: targetLanguage,
  };
}

