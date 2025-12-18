import { NextResponse } from 'next/server';
import { getPool } from '@/lib/database';
import type { NewsRegion } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = (searchParams.get('timeRange') || 'all') as '1d' | '7d' | '1m' | '1y' | 'all';
    
    const dbPool = getPool();
    if (!dbPool) {
      return NextResponse.json({
        success: false,
        error: 'Database not available',
        data: {
          totalArticles: 0,
          articlesByRegion: {},
          articlesByCategory: {},
          recentArticles: [],
        },
      });
    }

    // Calculate date range
    let startDate: Date | null = null;
    if (timeRange !== 'all') {
      startDate = new Date();
      switch (timeRange) {
        case '1d':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '1m':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }
    }

    const startDateISO = startDate ? startDate.toISOString() : null;
    const tables: { region: NewsRegion; table: string }[] = [
      { region: 'id', table: 'indonesia' },
      { region: 'cn', table: 'china' },
      { region: 'kr', table: 'kpop' },
      { region: 'intl', table: 'international' },
    ];

    let totalArticles = 0;
    const articlesByRegion: Record<string, number> = {};
    const articlesByCategory: Record<string, number> = {};

    // Count articles by region
    for (const { region, table } of tables) {
      try {
        const query = startDateISO
          ? `SELECT COUNT(*) as count FROM ${table} WHERE published_at >= $1`
          : `SELECT COUNT(*) as count FROM ${table}`;
        const params = startDateISO ? [startDateISO] : [];
        
        const result = await dbPool.query(query, params);
        const count = parseInt(result.rows[0]?.count || '0', 10);
        articlesByRegion[region] = count;
        totalArticles += count;
      } catch (error: any) {
        console.error(`Error counting articles in ${table}:`, error);
        articlesByRegion[region] = 0;
      }
    }

    // Count articles by category
    for (const { table } of tables) {
      try {
        const query = startDateISO
          ? `SELECT category, COUNT(*) as count FROM ${table} WHERE published_at >= $1 GROUP BY category`
          : `SELECT category, COUNT(*) as count FROM ${table} GROUP BY category`;
        const params = startDateISO ? [startDateISO] : [];
        
        const result = await dbPool.query(query, params);
        result.rows.forEach((row: any) => {
          const category = row.category || 'other';
          articlesByCategory[category] = (articlesByCategory[category] || 0) + parseInt(row.count || '0', 10);
        });
      } catch (error: any) {
        console.error(`Error counting categories in ${table}:`, error);
      }
    }

    // Get recent articles (last 10)
    const recentArticles: any[] = [];
    for (const { table } of tables) {
      try {
        const query = startDateISO
          ? `SELECT id, title, category, published_at, source_id FROM ${table} WHERE published_at >= $1 ORDER BY published_at DESC LIMIT 10`
          : `SELECT id, title, category, published_at, source_id FROM ${table} ORDER BY published_at DESC LIMIT 10`;
        const params = startDateISO ? [startDateISO] : [];
        
        const result = await dbPool.query(query, params);
        recentArticles.push(...result.rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          published_at: row.published_at,
          source_id: row.source_id,
        })));
      } catch (error: any) {
        console.error(`Error fetching recent articles from ${table}:`, error);
      }
    }

    // Sort recent articles by published_at
    recentArticles.sort((a, b) => {
      const dateA = new Date(a.published_at).getTime();
      const dateB = new Date(b.published_at).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalArticles,
        articlesByRegion,
        articlesByCategory,
        recentArticles: recentArticles.slice(0, 10),
        timeRange,
      },
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch analytics',
        data: {
          totalArticles: 0,
          articlesByRegion: {},
          articlesByCategory: {},
          recentArticles: [],
        },
      },
      { status: 500 }
    );
  }
}

