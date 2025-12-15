import { NextResponse } from 'next/server';
import { getPool } from '@/lib/database';
import { apiScheduler } from '@/lib/api-scheduler';
import type { NewsRegion } from '@/lib/api';

export async function GET() {
  try {
    const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
    const hasGroqKey = !!groqKey && groqKey.length > 0;
    
    const databaseUrl = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_NEON_CONNECTION_STRING || '';
    const hasDatabase = !!databaseUrl && databaseUrl.length > 0;
    
    // Check database connection
    let dbConnected = false;
    let dbError: string | null = null;
    let articleCounts: Record<string, number> = {};
    let totalArticles = 0;
    
    if (hasDatabase) {
      try {
        const pool = getPool();
        if (pool) {
          // Test connection with timeout
          const testQuery = pool.query('SELECT NOW()');
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 10000)
          );
          
          await Promise.race([testQuery, timeoutPromise]);
          dbConnected = true;
          
          // Count articles in each table
          const tables: NewsRegion[] = ['id', 'cn', 'jp', 'kr', 'intl'];
          const tableNames = {
            'id': 'indonesia',
            'cn': 'china',
            'jp': 'japan',
            'kr': 'korea',
            'intl': 'international',
          };
          
          for (const region of tables) {
            try {
              const tableName = tableNames[region];
              // Check if table exists first
              const tableExists = await pool.query(
                `SELECT EXISTS (
                  SELECT FROM information_schema.tables 
                  WHERE table_schema = 'public' 
                  AND table_name = $1
                )`,
                [tableName]
              );
              
              if (tableExists.rows[0]?.exists) {
                const result = await pool.query(
                  `SELECT COUNT(*) as count FROM ${tableName} WHERE published_at >= '2025-12-14T00:00:00.000Z'`
                );
                const count = parseInt(result.rows[0]?.count || '0', 10);
                articleCounts[region] = count;
                totalArticles += count;
              } else {
                console.warn(`Table ${tableName} does not exist`);
                articleCounts[region] = 0;
              }
            } catch (err: any) {
              console.error(`Error counting articles in ${region}:`, err);
              articleCounts[region] = 0;
            }
          }
        } else {
          dbError = 'Database pool not initialized';
        }
      } catch (error: any) {
        dbError = error.message || 'Database connection failed';
        console.error('Database connection error:', error);
      }
    } else {
      dbError = 'DATABASE_URL not configured';
    }
    
    // Check API scheduler status (from singleton)
    const schedulerRunning = apiScheduler.isRunning;
    const schedulerStatus = apiScheduler.getStatus();
    
    // Generate message
    let message = '';
    if (!hasGroqKey) {
      message = 'Groq API key tidak dikonfigurasi. Silakan set NEXT_PUBLIC_GROQ_API_KEY atau GROQ_API_KEY di file .env.local.';
    } else if (!hasDatabase) {
      message = 'Database connection tidak dikonfigurasi. Silakan set DATABASE_URL di file .env.local.';
    } else if (!dbConnected) {
      message = `Database tidak terhubung: ${dbError}`;
    } else if (totalArticles === 0) {
      message = 'Belum ada berita di database. API scheduler sedang memproses berita dari Groq API. Tunggu beberapa saat...';
      if (!schedulerRunning) {
        message += ' (Scheduler belum berjalan - coba refresh halaman)';
      }
    } else {
      message = `Ditemukan ${totalArticles} artikel di database.`;
    }
    
    return NextResponse.json({
      success: true,
      message,
      groq: {
        configured: hasGroqKey,
        keyLength: groqKey.length,
      },
      database: {
        configured: hasDatabase,
        connected: dbConnected,
        error: dbError,
        urlPrefix: databaseUrl ? `${databaseUrl.substring(0, 30)}...` : 'not set',
      },
      articles: {
        total: totalArticles,
        byRegion: articleCounts,
      },
      scheduler: {
        running: schedulerRunning,
        status: schedulerStatus,
      },
    });
  } catch (error: any) {
    console.error('Error in debug status:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Error checking status',
        error: error.toString(),
      },
      { status: 500 }
    );
  }
}
