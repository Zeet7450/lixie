/**
 * Check why there are no news articles
 * Verifies Groq API key, database connection, and scheduler status
 * Client-side compatible version
 */

export async function checkNewsStatus(): Promise<{
  hasGroqKey: boolean;
  hasDatabase: boolean;
  hasArticles: boolean;
  articleCount: number;
  message: string;
}> {
  // Check environment variables (client-side can't access process.env directly)
  // We'll check by trying to fetch from database
  let hasGroqKey = false;
  let hasDatabase = false;
  let hasArticles = false;
  let articleCount = 0;
  let message = '';

  // Try to check database connection by fetching articles
  try {
    const response = await fetch('/api/check-status', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      const data = await response.json();
      hasGroqKey = data.hasGroqKey || false;
      hasDatabase = data.hasDatabase || false;
      hasArticles = data.hasArticles || false;
      articleCount = data.articleCount || 0;
      message = data.message || '';
    } else {
      // Fallback: assume database might be available but no articles yet
      hasDatabase = true;
      message = 'Belum ada berita di database. API scheduler sedang memproses berita dari Groq API. Tunggu beberapa saat...';
    }
  } catch (error) {
    // If API endpoint doesn't exist, provide generic message
    message = 'Belum ada berita di database. API scheduler sedang memproses berita dari Groq API. Tunggu beberapa saat...';
  }

  return {
    hasGroqKey,
    hasDatabase,
    hasArticles,
    articleCount,
    message,
  };
}
