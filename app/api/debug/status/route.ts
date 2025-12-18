import { NextResponse } from 'next/server';
import { getPool } from '@/lib/database';
import { apiScheduler } from '@/lib/api-scheduler';
import type { NewsRegion } from '@/lib/api';

export async function GET() {
  try {
    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/debug/status/route.ts:7',message:'GET /api/debug/status called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
    }
    // #endregion
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
          // Test connection with timeout and retry
          let connectionTested = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const testQuery = pool.query('SELECT NOW()');
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout')), 20000)
              );
              
              await Promise.race([testQuery, timeoutPromise]);
              dbConnected = true;
              connectionTested = true;
              break;
            } catch (testError: any) {
              if (attempt === 4) {
                // Last attempt failed - check if it's AggregateError
                if (testError.message?.includes('AggregateError') || testError.name === 'AggregateError') {
                  dbError = `Connection timeout: ${testError.message || 'AggregateError'}`;
                } else {
                  throw testError;
                }
              } else {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
              }
            }
          }
          
          if (!connectionTested) {
            throw new Error('Connection test failed after retries');
          }
          
          // Count articles in each table
          const tables: NewsRegion[] = ['id', 'cn', 'intl'];
          const tableNames = {
            'id': 'indonesia',
            'cn': 'china',
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
                // Count articles from last 7 days
                const minDate = new Date();
                minDate.setDate(minDate.getDate() - 7);
                const minDateISO = minDate.toISOString();
                const result = await pool.query(
                  `SELECT COUNT(*) as count FROM ${tableName} WHERE published_at >= $1`,
                  [minDateISO]
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
        const errorMsg = error.message || error.toString() || 'Database connection failed';
        console.error('Database connection error:', error);
        // Reset pool to allow reconnection on next request
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || errorMsg.includes('timeout')) {
          dbError = `Connection timeout: ${errorMsg}`;
        } else {
          dbError = errorMsg;
        }
      }
    } else {
      dbError = 'DATABASE_URL not configured';
    }
    
    // Check API scheduler status (from singleton)
    // Force refresh status by calling getStatus() which reads current state
    const schedulerStatus = apiScheduler.getStatus();
    const schedulerRunning = schedulerStatus.isRunning;
    
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
