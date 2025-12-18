import { Pool } from 'pg';
import type { Article } from '@/types';
import type { NewsRegion } from './api';

// Neon database connection string
const databaseUrl = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_NEON_CONNECTION_STRING || '';

// Create PostgreSQL connection pool
let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (!databaseUrl) {
    console.warn('No Neon database connection string configured. Please set DATABASE_URL or NEXT_PUBLIC_NEON_CONNECTION_STRING');
    return null;
  }

  if (!pool) {
    try {
      // Use connection string as-is (Neon already has optimal settings)
      // Only adjust pool settings, not connection string parameters
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: {
          rejectUnauthorized: false, // Required for Neon
        },
        max: 5, // Reduce max connections to avoid timeout
        min: 0, // Don't keep connections alive (let them close when idle)
        idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
        connectionTimeoutMillis: 20000, // Increase to 20 seconds for Neon
        statement_timeout: 30000, // 30 seconds for queries
        query_timeout: 30000,
        keepAlive: true, // Enable keepalive to maintain connections
        allowExitOnIdle: true, // Allow pool to close when idle
      });
      
      // #region agent log
      if (typeof window === 'undefined') {
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:34',message:'Database pool created',data:{max:5,connectionTimeout:20000},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
      }
      // #endregion

      // Handle pool errors
      pool.on('error', (err: any) => {
        console.error('Unexpected database pool error:', err);
        // #region agent log
        if (typeof window === 'undefined') {
          fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:38',message:'Pool error event',data:{error:err?.message,code:err?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        }
        // #endregion
        // Reset pool on error to allow reconnection
        pool = null;
      });

      // Test connection asynchronously (don't block)
      const testConnection = async () => {
        let retries = 3;
        while (retries > 0) {
          try {
            if (!pool) {
              throw new Error('Pool is null');
            }
            
            // Use Promise.race to add timeout
            const client = await Promise.race([
              pool.connect(),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout')), 25000)
              )
            ]);
            
            await Promise.race([
              client.query('SELECT 1'),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout')), 10000)
              )
            ]);
            
            client.release();
            console.log('✓ Database connection successful');
            // #region agent log
            if (typeof window === 'undefined') {
              fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:54',message:'Database connection test successful',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
            }
            // #endregion
            break;
          } catch (err: any) {
            retries--;
            const isTimeout = err?.code === 'ETIMEDOUT' || 
                             err?.message?.includes('timeout') ||
                             err?.message === 'Connection timeout' ||
                             err?.message === 'Query timeout' ||
                             err?.name === 'AggregateError';
            
            // #region agent log
            if (typeof window === 'undefined') {
              fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:61',message:'Database connection test failed',data:{retries,error:err?.message,code:err?.code,isTimeout},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
            }
            // #endregion
            if (retries > 0) {
              console.warn(`Database connection test failed, retrying... (${retries} attempts left)`, err?.message || err);
              // Reset pool on timeout to force reconnection
              // DON'T call pool.end() - it will destroy the pool while other queries might be using it
              // Just set to null and let getPool() create a new one
              // The old pool will be garbage collected when no longer referenced
              if (isTimeout && pool) {
                pool = null;
              }
              await new Promise(resolve => setTimeout(resolve, 3000)); // Increase delay
            } else {
              console.error('Database connection error after retries:', err?.message || err);
              // Reset pool to allow reconnection on next attempt
              pool = null;
            }
          }
        }
      };
      

      testConnection().catch((err) => {
        console.error('Async database connection test failed:', err?.message || err);
        pool = null; // Reset pool on failure
      });
    } catch (error) {
      console.error('Error creating database pool:', error);
      return null;
    }
  }

  return pool;
}

/**
 * Execute a database query with retry logic and timeout handling
 * Helps prevent ETIMEDOUT errors by retrying failed queries
 */
async function executeQueryWithRetry<T = any>(
  queryFn: () => Promise<{ rows: T[] }>,
  retries: number = 3,
  delay: number = 2000
): Promise<{ rows: T[] } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Ensure we have a valid pool before executing query
      const currentPool = getPool();
      if (!currentPool) {
        console.warn(`⚠️ No database pool available (attempt ${attempt}/${retries})`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return null;
      }
      
      const result = await Promise.race([
        queryFn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 25000) // 25 second timeout
        )
      ]);
      return result;
    } catch (error: any) {
      // Check for timeout errors (including AggregateError with nested errors)
      const isTimeout = error?.code === 'ETIMEDOUT' || 
                       error?.message?.includes('timeout') ||
                       error?.message === 'Query timeout' ||
                       error?.name === 'AggregateError' ||
                       (error?.errors && Array.isArray(error.errors) && error.errors.some((e: any) => 
                         e?.code === 'ETIMEDOUT' || e?.message?.includes('timeout')
                       ));
      
      if (isTimeout && attempt < retries) {
        console.warn(`⚠️ Database query timeout (attempt ${attempt}/${retries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Reset pool on timeout to force reconnection
        // DON'T call pool.end() - it will destroy the pool while other queries might be using it
        // Just set to null and let getPool() create a new one
        // The old pool will be garbage collected when no longer referenced
        pool = null;
        
        // Recreate pool for next attempt
        getPool();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for pool to initialize
        continue;
      }
      
      // If not timeout or last attempt, throw error
      if (!isTimeout || attempt === retries) {
        throw error;
      }
    }
  }
  
  return null;
}

export type NewsRegionTable = 'indonesia' | 'china' | 'international';

/**
 * Map NewsRegion to table name
 */
export function getTableName(region: NewsRegion): NewsRegionTable {
  const mapping: Record<NewsRegion, NewsRegionTable> = {
    'id': 'indonesia',
    'cn': 'china',
    'intl': 'international',
  };
  return mapping[region] || 'international';
}

/**
 * Fetch articles from Neon database by region and category
 */
export async function fetchArticlesFromDatabase(
  region: NewsRegion,
  category?: string
): Promise<Article[]> {
  // #region agent log
  if (typeof window === 'undefined') {
    fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:129',message:'fetchArticlesFromDatabase called',data:{region,category},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
  }
  // #endregion
  
  try {
    const dbPool = getPool();
    if (!dbPool) {
      console.warn('Database pool not available for fetchArticlesFromDatabase');
      // #region agent log
      if (typeof window === 'undefined') {
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:138',message:'Database pool not available',data:{region,category},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
      }
      // #endregion
      return [];
    }
    
    const tableName = getTableName(region);
    
    // Only fetch articles from last 7 days (rolling window - always current)
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 7); // Last 7 days
    minDate.setHours(0, 0, 0, 0); // Start of day
    const minDateISO = minDate.toISOString();

    let query = `
      SELECT * FROM ${tableName}
      WHERE published_at >= $1
    `;
    const params: any[] = [minDateISO];

    // Add category filter
    if (category && category !== 'all' && category !== 'hot') {
      query += ` AND category = $${params.length + 1}`;
      params.push(category);
    } else if (category === 'hot') {
      // HOT filter: hotness_score >= 80 (equivalent to 8 on 0-10 scale) AND is_breaking OR is_trending
      // Published within last 2 hours for freshness
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      query += ` AND (
        (hotness_score >= 80 AND (is_breaking = true OR is_trending = true))
        OR (is_breaking = true AND published_at >= $${params.length + 1})
      )`;
      params.push(twoHoursAgo);
    }

    query += ` ORDER BY published_at DESC, hotness_score DESC LIMIT 200`;

    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:134',message:'Before fetch query',data:{tableName,region,category,minDateISO},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    }
    // #endregion
    
    // Use executeQueryWithRetry to handle timeouts
    const result = await executeQueryWithRetry(
      () => dbPool.query(query, params)
    );
    
    if (!result) {
      console.warn(`⚠️ Failed to fetch articles from ${tableName} after retries`);
      return [];
    }
    
    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:137',message:'After fetch query',data:{tableName,region,category,rowsReturned:result.rows?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    }
    // #endregion
    
    console.log(`📊 Fetched ${result.rows?.length || 0} articles from ${tableName} (region: ${region}, category: ${category || 'all'})`);

    // Transform database rows to Article format
    const articles: Article[] = (result.rows || []).map((row: any) => ({
      id: row.id,
      title: row.title, // Title from web, exactly as is
      description: row.description || '',
      summary: row.summary,
      content: row.content,
      image_url: row.image_url,
      preview_image_url: row.preview_image_url,
      source_url: row.source_url,
      source_id: row.source_id,
      category: row.category,
      language: row.language,
      hotness_score: row.hotness_score || 0,
      is_breaking: row.is_breaking || false,
      is_trending: row.is_trending || false,
      views: row.views || 0,
      shares: row.shares || 0,
      comments: row.comments || 0,
      published_at: row.published_at,
      aggregated_at: row.aggregated_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return articles;
  } catch (error: any) {
    // This catch block handles errors from the try block above (dbPool.query and transformation)
    console.error('Error fetching articles from database:', error);
    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:175',message:'Error fetching articles',data:{region,category,errorCode:error?.code,errorMessage:error?.message,errorStack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
    }
    // #endregion
    // If connection error, reset pool to allow reconnection
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.message?.includes('timeout') || error.message?.includes('AggregateError')) {
      console.warn('Database connection timeout, pool will be reset on next request');
      pool = null;
      // #region agent log
      if (typeof window === 'undefined') {
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:180',message:'Pool reset due to timeout',data:{region},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
      }
      // #endregion
    }
    // Don't throw error, return empty array instead to prevent Internal Server Error
    return [];
  }
}

/**
 * Insert article into appropriate region table
 */
export async function insertArticleToDatabase(
  region: NewsRegion,
  article: Omit<Article, 'id' | 'created_at' | 'updated_at'>
): Promise<Article | null> {
  // #region agent log
  if (typeof window === 'undefined') {
    fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:192',message:'insertArticleToDatabase called',data:{region,articleTitle:article.title?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  }
  // #endregion
  const dbPool = getPool();
  if (!dbPool) {
    console.warn('Database pool not available for insertArticleToDatabase');
    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:196',message:'Database pool not available for insert',data:{region,articleTitle:article.title?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
    }
    // #endregion
    return null;
  }

  const tableName = getTableName(region);
  
  // Check for duplicate article before inserting (by source_url or similar title)
  try {
    // First, check if article with same source_url already exists
    if (article.source_url) {
      const duplicateCheck = await dbPool.query(
        `SELECT id FROM ${tableName} WHERE source_url = $1 LIMIT 1`,
        [article.source_url]
      );
      
      if (duplicateCheck.rows.length > 0) {
        console.log(`⚠️ Duplicate article skipped (same source_url): ${article.title?.substring(0, 50)}...`);
        return null; // Article already exists
      }
    }
    
    // Also check for similar title (fuzzy match - same title within last 7 days)
    if (article.title) {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - 7);
      const minDateISO = minDate.toISOString();
      
      const titleCheck = await dbPool.query(
        `SELECT id, title FROM ${tableName} 
         WHERE LOWER(title) = LOWER($1) 
         AND published_at >= $2 
         LIMIT 1`,
        [article.title, minDateISO]
      );
      
      if (titleCheck.rows.length > 0) {
        console.log(`⚠️ Duplicate article skipped (same title): ${article.title?.substring(0, 50)}...`);
        return null; // Article with same title already exists
      }
    }
  } catch (checkError: any) {
    // If duplicate check fails, log but continue with insert
    console.warn('⚠️ Error checking for duplicates, proceeding with insert:', checkError?.message || checkError);
  }
  
  try {
    const query = `
      INSERT INTO ${tableName} (
        title, description, summary, content,
        image_url, preview_image_url, source_url, source_id,
        category, language, hotness_score, is_breaking, is_trending,
        views, shares, comments, published_at, aggregated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *
    `;

    const values = [
      article.title, // Store title exactly as from web
      article.description,
      article.summary,
      article.content,
      article.image_url,
      article.preview_image_url,
      article.source_url,
      article.source_id,
      article.category,
      article.language,
      article.hotness_score,
      article.is_breaking,
      article.is_trending,
      article.views,
      article.shares,
      article.comments,
      article.published_at || new Date().toISOString(), // Use published_at from website source, fallback to now if missing
      new Date().toISOString(), // aggregated_at is always current time (when we aggregated it)
    ];

    const result = await dbPool.query(query, values);
    const insertedArticle = result.rows[0];
    
    console.log(`✅ Article inserted successfully: ${article.title?.substring(0, 60)}...`);
    console.log(`   ID: ${insertedArticle.id}, Category: ${article.category}, Source: ${article.source_id}`);
    
    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:273',message:'Article inserted successfully',data:{region,articleId:insertedArticle.id,articleTitle:article.title?.substring(0,50),category:article.category},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    }
    // #endregion

    return {
      id: insertedArticle.id,
      title: insertedArticle.title,
      description: insertedArticle.description || '',
      summary: insertedArticle.summary,
      content: insertedArticle.content,
      image_url: insertedArticle.image_url,
      preview_image_url: insertedArticle.preview_image_url,
      source_url: insertedArticle.source_url,
      source_id: insertedArticle.source_id,
      category: insertedArticle.category,
      language: insertedArticle.language,
      hotness_score: insertedArticle.hotness_score || 0,
      is_breaking: insertedArticle.is_breaking || false,
      is_trending: insertedArticle.is_trending || false,
      views: insertedArticle.views || 0,
      shares: insertedArticle.shares || 0,
      comments: insertedArticle.comments || 0,
      published_at: insertedArticle.published_at,
      aggregated_at: insertedArticle.aggregated_at,
      created_at: insertedArticle.created_at,
      updated_at: insertedArticle.updated_at,
    };
  } catch (error: any) {
    console.error(`❌ Error inserting article into ${tableName}:`, error);
    console.error(`   Article title: ${article.title?.substring(0, 60)}...`);
    console.error(`   Error code: ${error.code}`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error detail: ${error.detail}`);
    console.error(`   Error constraint: ${error.constraint}`);
    
    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/database.ts:320',message:'Error inserting article',data:{region,tableName,articleTitle:article.title?.substring(0,50),errorCode:error?.code,errorMessage:error?.message,errorDetail:error?.detail,errorConstraint:error?.constraint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    }
    // #endregion
    
    return null;
  }
}

/**
 * Delete all articles from all tables and reset ID sequences to start from 1
 */
export async function deleteAllArticles(): Promise<{ deleted: number; errors: number }> {
  const dbPool = getPool();
  if (!dbPool) {
    console.error('❌ Database pool not available for deleteAllArticles');
    return { deleted: 0, errors: 1 };
  }

  let totalDeleted = 0;
  let totalErrors = 0;

  console.log('🧹 Starting full database cleanup: Deleting ALL articles and resetting ID sequences...');

  try {
    const tables: NewsRegionTable[] = ['indonesia', 'china', 'international'];

    for (const table of tables) {
      try {
        // First, count articles to be deleted
        const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const countToDelete = parseInt(countResult.rows[0]?.count || '0', 10);

        if (countToDelete > 0) {
          // Delete all articles (with retry)
          const deleteResult = await executeQueryWithRetry(
            () => dbPool.query(`DELETE FROM ${table}`)
          );
          
          if (deleteResult) {
            console.log(`✅ Deleted ${countToDelete} articles from ${table}`);
            totalDeleted += countToDelete;
          } else {
            console.error(`❌ Failed to delete articles from ${table} after retries`);
            totalErrors++;
          }
        } else {
          console.log(`✓ No articles to delete from ${table}`);
        }

        // Reset sequence to start from 1 (with retry)
        // PostgreSQL sequence name format: {table_name}_id_seq
        try {
          const alterSeqResult = await executeQueryWithRetry(
            () => dbPool.query(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1`)
          );
          
          if (alterSeqResult) {
            console.log(`✅ Reset ID sequence for ${table} to start from 1`);
          } else {
            console.warn(`⚠️ Could not reset sequence for ${table} after retries, trying alternative method...`);
            // Try alternative method if sequence doesn't exist
            try {
              const maxIdResult = await executeQueryWithRetry(
                () => dbPool.query(`SELECT MAX(id) as max_id FROM ${table}`)
              );
              
              if (maxIdResult) {
                const maxId = maxIdResult.rows[0]?.max_id || 0;
                if (maxId > 0) {
                  const setvalResult = await executeQueryWithRetry(
                    () => dbPool.query(`SELECT setval('${table}_id_seq', 1, false)`)
                  );
                  
                  if (setvalResult) {
                    console.log(`✅ Reset ID sequence for ${table} using setval`);
                  } else {
                    console.warn(`⚠️ Could not reset sequence using setval for ${table} after retries`);
                  }
                } else {
                  // No rows, sequence should already be at 1
                  console.log(`✓ Sequence for ${table} already at start (no rows)`);
                }
              } else {
                console.warn(`⚠️ Could not get MAX(id) for ${table} after retries`);
              }
            } catch (setvalError: any) {
              const isTimeout = setvalError?.code === 'ETIMEDOUT' || 
                               setvalError?.message?.includes('timeout') ||
                               setvalError?.name === 'AggregateError';
              
              if (isTimeout) {
                console.warn(`⚠️ Timeout resetting sequence for ${table}, will retry on next cycle`);
              } else {
                console.warn(`⚠️ Could not reset sequence using setval for ${table}:`, setvalError?.message || setvalError);
              }
            }
          }
        } catch (seqError: any) {
          const isTimeout = seqError?.code === 'ETIMEDOUT' || 
                           seqError?.message?.includes('timeout') ||
                           seqError?.name === 'AggregateError';
          
          if (isTimeout) {
            console.warn(`⚠️ Timeout resetting sequence for ${table}, will retry on next cycle`);
          } else {
            console.warn(`⚠️ Could not reset sequence for ${table}:`, seqError?.message || seqError);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing ${table}:`, error?.message || error);
        totalErrors++;
      }
    }

    if (totalDeleted > 0) {
      console.log(`🧹 Full cleanup complete: Deleted ${totalDeleted} articles total, all ID sequences reset to 1 (${totalErrors} errors)`);
    } else {
      console.log(`✓ Full cleanup complete: No articles found, all ID sequences reset to 1 (${totalErrors} errors)`);
    }

    return { deleted: totalDeleted, errors: totalErrors };
  } catch (error: any) {
    console.error('❌ Error deleting all articles:', error?.message || error);
    return { deleted: totalDeleted, errors: totalErrors + 1 };
  }
}

/**
 * Delete articles older than last 7 days (rolling window - always current)
 * This ensures only articles from Dec 9, 2025 onwards are kept
 */
/**
 * Delete articles based on region and date range
 * @param region - NewsRegion or 'all' for all regions
 * @param dateRange - '1d' (1 day), '7d' (7 days), '1m' (1 month), '1y' (1 year), or 'all' (all articles)
 */
export async function deleteArticles(
  region: NewsRegion | 'all',
  dateRange: '1d' | '7d' | '1m' | '1y' | 'all' = 'all'
): Promise<{ deleted: number; errors: number }> {
  const dbPool = getPool();
  if (!dbPool) {
    console.error('❌ Database pool not available for deleteArticles');
    return { deleted: 0, errors: 1 };
  }

  let totalDeleted = 0;
  let totalErrors = 0;

  // Calculate cutoff date based on dateRange
  // Logic: Delete articles OLDER than X days/months/years (not within X period)
  // Example: "7d" = delete articles older than 7 days ago (keep articles within last 7 days)
  let cutoffDate: Date | null = null;
  if (dateRange !== 'all') {
    const now = new Date();
    cutoffDate = new Date(now);
    
    switch (dateRange) {
      case '1d':
        // Delete articles older than 1 day ago (keep articles from today and yesterday)
        cutoffDate.setDate(cutoffDate.getDate() - 1);
        cutoffDate.setHours(0, 0, 0, 0); // Start of day
        break;
      case '7d':
        // Delete articles older than 7 days ago (keep articles from last 7 days)
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        cutoffDate.setHours(0, 0, 0, 0); // Start of day
        break;
      case '1m':
        // Delete articles older than 1 month ago (keep articles from last month)
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        cutoffDate.setHours(0, 0, 0, 0); // Start of day
        break;
      case '1y':
        // Delete articles older than 1 year ago (keep articles from last year)
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
        cutoffDate.setHours(0, 0, 0, 0); // Start of day
        break;
    }
  }

  const cutoffDateISO = cutoffDate ? cutoffDate.toISOString() : null;
  
  // Log for debugging
  if (cutoffDate) {
    console.log(`📅 Delete cutoff date: ${cutoffDate.toISOString()}`);
    console.log(`   Will delete articles with published_at < ${cutoffDateISO}`);
    console.log(`   Articles with published_at >= ${cutoffDateISO} will be KEPT`);
  }
  const regions: NewsRegion[] = region === 'all' 
    ? ['id', 'cn', 'intl']
    : [region];

  console.log(`🧹 Starting delete articles: region=${region}, dateRange=${dateRange}`);

  try {
    for (const reg of regions) {
      const table = getTableName(reg);
      
      try {
        let query: string;
        let params: any[];

        // First, count articles to be deleted
        // Query: published_at < cutoffDate means "older than cutoff date"
        // This will DELETE articles OLDER than X days/months/years
        // and KEEP articles WITHIN the last X days/months/years
        const countQuery = cutoffDateISO 
          ? `SELECT COUNT(*) as count FROM ${table} WHERE published_at < $1`
          : `SELECT COUNT(*) as count FROM ${table}`;
        const countParams = cutoffDateISO ? [cutoffDateISO] : [];
        
        const countResult = await executeQueryWithRetry(
          () => dbPool.query(countQuery, countParams)
        );
        
        if (!countResult) {
          console.error(`❌ Failed to count articles in ${table} after retries`);
          totalErrors++;
          continue;
        }
        
        const countToDelete = parseInt(countResult.rows[0]?.count || '0', 10);
        
        if (countToDelete > 0) {
          // Build delete query
          let deleteQuery: string;
          let deleteParams: any[];
          
          if (cutoffDateISO) {
            // Delete articles OLDER than cutoff date (published_at < cutoffDate)
            // This means: delete articles that are MORE than X days/months/years old
            // Articles WITHIN the last X days/months/years will be KEPT
            deleteQuery = `DELETE FROM ${table} WHERE published_at < $1`;
            deleteParams = [cutoffDateISO];
            console.log(`   Query: DELETE articles with published_at < ${cutoffDateISO}`);
            console.log(`   This will DELETE articles OLDER than ${dateRange} and KEEP articles WITHIN last ${dateRange}`);
          } else {
            // Delete all articles
            deleteQuery = `DELETE FROM ${table}`;
            deleteParams = [];
          }
          
          // Delete articles
          const deleteResult = await executeQueryWithRetry(
            () => dbPool.query(deleteQuery, deleteParams)
          );
          
          if (deleteResult) {
            totalDeleted += countToDelete;
            console.log(`✅ Deleted ${countToDelete} articles from ${table} (region: ${reg}, dateRange: ${dateRange})`);
          } else {
            console.error(`❌ Failed to delete articles from ${table} after retries`);
            totalErrors++;
          }
        } else {
          console.log(`✓ No articles to delete from ${table} (region: ${reg}, dateRange: ${dateRange})`);
        }
      } catch (error: any) {
        const isTimeout = error?.code === 'ETIMEDOUT' || 
                         error?.message?.includes('timeout') ||
                         error?.name === 'AggregateError';
        
        if (isTimeout) {
          console.warn(`⚠️ Timeout deleting articles from ${table}, will retry on next cycle`);
        } else {
          console.error(`❌ Error deleting articles from ${table}:`, error?.message || error);
        }
        totalErrors++;
      }
    }

    console.log(`🧹 Delete complete: ${totalDeleted} articles deleted, ${totalErrors} errors`);
    return { deleted: totalDeleted, errors: totalErrors };
  } catch (error: any) {
    console.error('❌ Error in deleteArticles:', error?.message || error);
    return { deleted: totalDeleted, errors: totalErrors + 1 };
  }
}

export async function deleteOldArticles(): Promise<{ deleted: number; errors: number }> {
  const dbPool = getPool();
  if (!dbPool) {
    return { deleted: 0, errors: 1 };
  }

  // Delete articles older than last 7 days (rolling window - always current)
  // This ensures only articles from last 7 days are kept
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7); // Last 7 days
  cutoffDate.setHours(0, 0, 0, 0); // Start of day
  const cutoffDateISO = cutoffDate.toISOString();
  
  let totalDeleted = 0;
  let totalErrors = 0;

    console.log(`🧹 Starting cleanup: Deleting articles older than ${cutoffDateISO} (older than last 7 days)`);
  console.log(`   This will delete articles from 2020, 2021, 2022, 2023, 2024, and before Dec 9, 2025`);

  try {
    const tables: NewsRegionTable[] = ['indonesia', 'china', 'international'];

    for (const table of tables) {
      try {
        // First, count articles to be deleted (with retry)
        const countResult = await executeQueryWithRetry(
          () => dbPool.query(
            `SELECT COUNT(*) as count FROM ${table} WHERE published_at < $1`,
            [cutoffDateISO]
          )
        );
        
        if (!countResult) {
          console.error(`❌ Failed to count articles in ${table} after retries`);
          totalErrors++;
          continue;
        }
        
        const countToDelete = parseInt(countResult.rows[0]?.count || '0', 10);

        if (countToDelete > 0) {
          // Delete articles older than last 7 days (with retry)
          const deleteResult = await executeQueryWithRetry(
            () => dbPool.query(
              `DELETE FROM ${table} WHERE published_at < $1`,
              [cutoffDateISO]
            )
          );
          
          if (deleteResult) {
            console.log(`✅ Deleted ${countToDelete} old articles from ${table} (older than last 7 days)`);
            totalDeleted += countToDelete;
          } else {
            console.error(`❌ Failed to delete articles from ${table} after retries`);
            totalErrors++;
          }
        } else {
          console.log(`✓ No old articles to delete from ${table}`);
        }
      } catch (error: any) {
        const isTimeout = error?.code === 'ETIMEDOUT' || 
                         error?.message?.includes('timeout') ||
                         error?.name === 'AggregateError';
        
        if (isTimeout) {
          console.warn(`⚠️ Timeout processing ${table}, will retry on next cycle:`, error?.message || error);
        } else {
          console.error(`❌ Error processing ${table}:`, error?.message || error);
        }
        totalErrors++;
      }
    }

    if (totalDeleted > 0) {
      console.log(`🧹 Cleanup complete: Deleted ${totalDeleted} old articles total (${totalErrors} errors)`);
    } else {
      console.log(`✓ Cleanup complete: No old articles found (${totalErrors} errors)`);
    }

    return { deleted: totalDeleted, errors: totalErrors };
  } catch (error: any) {
    console.error('❌ Error deleting old articles:', error?.message || error);
    return { deleted: totalDeleted, errors: totalErrors + 1 };
  }
}

/**
 * Validate and cleanup invalid articles from database
 * Removes articles that:
 * 1. Published before last 7 days (rolling window)
 * 2. Have invalid or inaccessible source_url
 * 3. Missing required fields (title, source_url)
 * 4. URLs that are not accessible (404, timeout, etc.)
 */
export async function cleanupInvalidArticles(): Promise<{ deleted: number; errors: number; details: { dateInvalid: number; urlInvalid: number; missingFields: number; urlNotAccessible: number } }> {
  const dbPool = getPool();
  if (!dbPool) {
    return { deleted: 0, errors: 1, details: { dateInvalid: 0, urlInvalid: 0, missingFields: 0, urlNotAccessible: 0 } };
  }

  // Use rolling window: last 7 days (always current)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 7); // Last 7 days
  minDate.setHours(0, 0, 0, 0); // Start of day
  const minDateISO = minDate.toISOString();
  
  let totalDeleted = 0;
  let totalErrors = 0;
  const details = { dateInvalid: 0, urlInvalid: 0, missingFields: 0, urlNotAccessible: 0 };
  
  // Import URL validator
  const { isUrlAccessible } = await import('./url-validator');

  console.log(`🧹 Starting validation cleanup: Checking all articles for validity...`);
  console.log(`   Criteria:`);
    console.log(`   1. Published date must be >= last 7 days (rolling window)`);
  console.log(`   2. source_url must be valid and accessible (will test URL accessibility)`);
  console.log(`   3. Must have title and source_url`);
  console.log(`   4. source_url must return 200 OK (not 404, timeout, or error)`);

  try {
    const tables: NewsRegionTable[] = ['indonesia', 'china', 'international'];

    for (const table of tables) {
      try {
        // Get all articles from this table (with retry)
        const allArticlesResult = await executeQueryWithRetry(
          () => dbPool.query(`SELECT id, title, source_url, published_at FROM ${table}`)
        );
        
        if (!allArticlesResult) {
          console.error(`❌ Failed to fetch articles from ${table} after retries`);
          totalErrors++;
          continue;
        }
        
        const allArticles = allArticlesResult.rows;
        console.log(`📊 Processing ${allArticles.length} articles from ${table}...`);
        
        for (const article of allArticles) {
          let shouldDelete = false;
          let deleteReason = '';

          // Check 1: Published date must be >= last 7 days (rolling window)
          if (!article.published_at) {
            shouldDelete = true;
            deleteReason = 'missing published_at';
            details.missingFields++;
          } else {
            try {
              const publishedDate = new Date(article.published_at);
              if (isNaN(publishedDate.getTime()) || publishedDate < minDate) {
                shouldDelete = true;
                deleteReason = `published_at before Dec 9, 2025 (${article.published_at})`;
                details.dateInvalid++;
              }
            } catch (dateError) {
              shouldDelete = true;
              deleteReason = `invalid published_at format (${article.published_at})`;
              details.dateInvalid++;
            }
          }

          // Check 2: Must have title and source_url
          if (!article.title || !article.source_url) {
            shouldDelete = true;
            deleteReason = 'missing title or source_url';
            details.missingFields++;
          }

          // Check 3: source_url must be valid HTTP/HTTPS URL from legitimate sources
          if (article.source_url) {
            try {
              const urlObj = new URL(article.source_url);
              const isValidProtocol = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
              const hasHostname = urlObj.hostname.length > 0;
              
              // Check if URL is from a legitimate news source domain
              const validDomains = [
                'kompas.com', 'detik.com', 'cnnindonesia.com', 'tempo.co', 'antaranews.com',
                'thejakartapost.com', 'bisnis.com', 'katadata.co.id', 'tvri.go.id', 'republika.co.id',
                'xinhuanet.com', 'chinadaily.com.cn', 'ecns.cn', 'people.com.cn',
                'bbc.com', 'reuters.com', 'apnews.com', 'theguardian.com', 'aljazeera.com', 'cnn.com',
              ];
              
              const urlLower = urlObj.hostname.toLowerCase();
              const isFromValidDomain = validDomains.some(domain => urlLower.includes(domain));
              
              // Reject placeholder, example, or invalid URLs
              const invalidPatterns = [
                'example.com', 'placeholder', 'test.com', 'localhost', '127.0.0.1',
                'dummy', 'fake', 'sample', 'lorem', 'ipsum',
              ];
              const hasInvalidPattern = invalidPatterns.some(pattern => urlLower.includes(pattern));
              
              if (!isValidProtocol || !hasHostname || !isFromValidDomain || hasInvalidPattern) {
                shouldDelete = true;
                deleteReason = `invalid source_url (${article.source_url})`;
                details.urlInvalid++;
              } else {
                // Check URL accessibility (only if URL format is valid)
                try {
                  const accessible = await isUrlAccessible(article.source_url, 10000); // 10 second timeout
                  if (!accessible) {
                    shouldDelete = true;
                    deleteReason = `source_url not accessible (404/timeout/error) (${article.source_url})`;
                    details.urlNotAccessible++;
                  }
                } catch (accessError) {
                  // If accessibility check fails, mark as not accessible
                  shouldDelete = true;
                  deleteReason = `source_url accessibility check failed (${article.source_url})`;
                  details.urlNotAccessible++;
                }
              }
            } catch (urlError) {
              shouldDelete = true;
              deleteReason = `invalid source_url format (${article.source_url})`;
              details.urlInvalid++;
            }
          }

          // Delete if invalid
          if (shouldDelete) {
            try {
              const deleteResult = await executeQueryWithRetry(
                () => dbPool.query(`DELETE FROM ${table} WHERE id = $1`, [article.id])
              );
              
              if (deleteResult) {
                totalDeleted++;
                console.log(`   ❌ Deleted invalid article: ${article.title?.substring(0, 50)}... (${deleteReason})`);
              } else {
                console.error(`   ❌ Failed to delete article ${article.id} after retries`);
                totalErrors++;
              }
            } catch (deleteError: any) {
              console.error(`   ❌ Error deleting article ${article.id}:`, deleteError?.message);
              totalErrors++;
            }
          }
        }
      } catch (error: any) {
        const isTimeout = error?.code === 'ETIMEDOUT' || 
                         error?.message?.includes('timeout') ||
                         error?.name === 'AggregateError' ||
                         (error?.errors && Array.isArray(error.errors) && error.errors.some((e: any) => 
                           e?.code === 'ETIMEDOUT' || e?.message?.includes('timeout')
                         ));
        
        if (isTimeout) {
          console.warn(`⚠️ Timeout processing ${table} in cleanupInvalidArticles, will retry on next cycle:`, error?.message || error);
        } else {
          console.error(`❌ Error processing ${table}:`, error?.message || error);
        }
        totalErrors++;
      }
    }

    console.log(`🧹 Validation cleanup complete:`);
    console.log(`   ✅ Deleted: ${totalDeleted} invalid articles`);
    console.log(`   📊 Breakdown:`);
    console.log(`      - Date invalid: ${details.dateInvalid}`);
    console.log(`      - URL invalid: ${details.urlInvalid}`);
    console.log(`      - URL not accessible: ${details.urlNotAccessible}`);
    console.log(`      - Missing fields: ${details.missingFields}`);
    console.log(`   ❌ Errors: ${totalErrors}`);

    return { deleted: totalDeleted, errors: totalErrors, details };
  } catch (error: any) {
    console.error('❌ Error cleaning up invalid articles:', error?.message || error);
    return { deleted: totalDeleted, errors: totalErrors + 1, details };
  }
}
