import { NextResponse } from 'next/server';
import { fetchArticlesFromDatabase } from '@/lib/database';

export async function GET() {
  // Support both NEXT_PUBLIC_GROQ_API_KEY and GROQ_API_KEY
  const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
  const hasGroqKey = !!groqKey && groqKey.length > 0;
  
  // Check for Neon database connection
  const databaseUrl = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_NEON_CONNECTION_STRING || '';
  const hasDatabase = !!databaseUrl && databaseUrl.length > 0;

  // Log for debugging (server-side only, safe to log)
  console.log('Environment Check:', {
    hasGroqKey,
    groqKeyLength: groqKey.length,
    groqKeyPrefix: groqKey ? `${groqKey.substring(0, 10)}...` : 'empty',
    hasDatabase,
    databaseUrlPrefix: databaseUrl ? `${databaseUrl.substring(0, 30)}...` : 'empty',
  });

  let hasArticles = false;
  let articleCount = 0;
  let message = '';

  // Try to fetch articles from database
  if (hasDatabase) {
    try {
      const articles = await fetchArticlesFromDatabase('id', 'all');
      articleCount = articles.length;
      hasArticles = articles.length > 0;
    } catch (error) {
      console.error('Error checking articles:', error);
    }
  }

  // Generate status message
  if (!hasGroqKey) {
    message = 'Groq API key tidak dikonfigurasi. Silakan set NEXT_PUBLIC_GROQ_API_KEY atau GROQ_API_KEY di file .env.local dan restart dev server.';
  } else if (!hasDatabase) {
    message = 'Database connection tidak dikonfigurasi. Silakan set DATABASE_URL atau NEXT_PUBLIC_NEON_CONNECTION_STRING di file .env.local.';
  } else if (!hasArticles) {
    message = 'Belum ada berita di database. API scheduler sedang memproses berita dari Groq API. Tunggu beberapa saat...';
  } else {
    message = `Berita tersedia! Ditemukan ${articleCount} artikel.`;
  }

  return NextResponse.json({
    hasGroqKey,
    hasDatabase,
    hasArticles,
    articleCount,
    message,
  });
}
