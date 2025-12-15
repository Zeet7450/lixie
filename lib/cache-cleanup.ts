/**
 * Clean up old cached articles from localStorage
 * Removes articles older than December 14, 2025
 */
export function cleanupOldCachedArticles(): number {
  if (typeof window === 'undefined') return 0;

  let cleanedCount = 0;
  const minDate = new Date('2025-12-14T00:00:00.000Z').getTime();

  try {
    // Get all localStorage keys that start with 'lixie-articles-'
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('lixie-articles-')) {
        keys.push(key);
      }
    }

    // Clean each cache
    keys.forEach((key) => {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const cacheData = JSON.parse(cached);
          if (cacheData.articles && Array.isArray(cacheData.articles)) {
            // Filter out old articles
            const filteredArticles = cacheData.articles.filter((article: any) => {
              try {
                const publishedTime = new Date(article.published_at).getTime();
                return publishedTime >= minDate;
              } catch {
                return false;
              }
            });

            // Update cache with filtered articles
            if (filteredArticles.length !== cacheData.articles.length) {
              const removedCount = cacheData.articles.length - filteredArticles.length;
              cacheData.articles = filteredArticles;
              cacheData.timestamp = Date.now(); // Update timestamp
              localStorage.setItem(key, JSON.stringify(cacheData));
              cleanedCount += removedCount;
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to clean cache for key ${key}:`, e);
      }
    });

    console.log(`Cleaned up ${cleanedCount} old articles from cache`);
    return cleanedCount;
  } catch (error) {
    console.error('Error cleaning up cached articles:', error);
    return cleanedCount;
  }
}

/**
 * Clear all article caches from localStorage
 */
export function clearAllArticleCaches(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('lixie-articles-')) {
        keys.push(key);
      }
    }

    keys.forEach((key) => {
      localStorage.removeItem(key);
    });

    console.log(`Cleared ${keys.length} article cache(s)`);
  } catch (error) {
    console.error('Error clearing article caches:', error);
  }
}

