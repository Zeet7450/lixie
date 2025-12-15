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
        max: 10, // Reduce max connections to avoid timeout
        min: 2, // Keep minimum connections alive
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000, // Increase to 15 seconds for Neon
        statement_timeout: 30000, // 30 seconds for queries
        query_timeout: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 0, // Start keepalive immediately
      });

      // Handle pool errors
      pool.on('error', (err) => {
        console.error('Unexpected database pool error:', err);
        // Reset pool on error to allow reconnection
        pool = null;
      });

      // Test connection with retry
      let retries = 3;
      const testConnection = async (): Promise<void> => {
        try {
          await pool!.query('SELECT NOW()');
          console.log('✓ Neon database connected successfully');
        } catch (err: any) {
          retries--;
          if (retries > 0) {
            console.warn(`Database connection test failed, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return testConnection();
          } else {
            console.error('Database connection error after retries:', err);
            // Don't reset pool here, let it retry on next query
          }
        }
      };
      
      // Test connection asynchronously (don't block)
      testConnection().catch(console.error);
    } catch (error) {
      console.error('Error creating database pool:', error);
      return null;
    }
  }

  return pool;
}

export type NewsRegionTable = 'indonesia' | 'china' | 'japan' | 'korea' | 'international';

/**
 * Map NewsRegion to table name
 */
export function getTableName(region: NewsRegion): NewsRegionTable {
  const mapping: Record<NewsRegion, NewsRegionTable> = {
    'id': 'indonesia',
    'cn': 'china',
    'jp': 'japan',
    'kr': 'korea',
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
  const dbPool = getPool();
  if (!dbPool) {
    console.warn('Database pool not available for fetchArticlesFromDatabase');
    return [];
  }

  try {
    const tableName = getTableName(region);
    
    // Only fetch articles from December 14, 2025 onwards
    const minDate = new Date('2025-12-14T00:00:00.000Z');
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
      query += ` AND is_breaking = true`;
    }

    query += ` ORDER BY published_at DESC, hotness_score DESC LIMIT 200`;

    const result = await dbPool.query(query, params);

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
    console.error('Error fetching articles from database:', error);
    // If connection error, reset pool to allow reconnection
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.message?.includes('timeout')) {
      console.warn('Database connection timeout, pool will be reset on next request');
      pool = null;
    }
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
  const dbPool = getPool();
  if (!dbPool) {
    console.warn('Database pool not available for insertArticleToDatabase');
    return null;
  }

  try {
    const tableName = getTableName(region);

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
      article.published_at,
      article.aggregated_at || new Date().toISOString(),
    ];

    const result = await dbPool.query(query, values);

    if (result.rows && result.rows.length > 0) {
      return result.rows[0] as Article;
    }

    return null;
  } catch (error: any) {
    console.error('Error inserting article to database:', error);
    // If connection error, reset pool to allow reconnection
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.message?.includes('timeout')) {
      console.warn('Database connection timeout during insert, pool will be reset on next request');
      pool = null;
    }
    return null;
  }
}

/**
 * Delete old articles (before December 14, 2025) from all region tables
 */
export async function deleteOldArticles(): Promise<{ deleted: number; errors: number }> {
  const dbPool = getPool();
  if (!dbPool) {
    return { deleted: 0, errors: 1 };
  }

  const minDate = new Date('2025-12-14T00:00:00.000Z');
  const minDateISO = minDate.toISOString();
  
  let totalDeleted = 0;
  let totalErrors = 0;

  try {
    const tables: NewsRegionTable[] = ['indonesia', 'china', 'japan', 'korea', 'international'];

    for (const table of tables) {
      try {
        // First, count articles to be deleted
        const countResult = await dbPool.query(
          `SELECT COUNT(*) as count FROM ${table} WHERE published_at < $1`,
          [minDateISO]
        );
        const countToDelete = parseInt(countResult.rows[0]?.count || '0', 10);

        // Delete articles older than December 14, 2025
        const deleteResult = await dbPool.query(
          `DELETE FROM ${table} WHERE published_at < $1`,
          [minDateISO]
        );

        console.log(`Deleted ${countToDelete} old articles from ${table}`);
        totalDeleted += countToDelete;
      } catch (error) {
        console.error(`Error processing ${table}:`, error);
        totalErrors++;
      }
    }

    return { deleted: totalDeleted, errors: totalErrors };
  } catch (error) {
    console.error('Error deleting old articles:', error);
    return { deleted: totalDeleted, errors: totalErrors + 1 };
  }
}
