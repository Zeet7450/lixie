import { NextResponse } from 'next/server';
import { getPool } from '@/lib/database';

/**
 * Setup database tables if they don't exist
 */
export async function POST() {
  const pool = getPool();
  if (!pool) {
    return NextResponse.json({
      success: false,
      message: 'Database pool not available',
    }, { status: 500 });
  }

  const tables = [
    { name: 'indonesia', region: 'Indonesia' },
    { name: 'china', region: 'China' },
    { name: 'international', region: 'International' },
  ];

  const results: Array<{ table: string; status: string; error?: string }> = [];

  for (const { name, region } of tables) {
    try {
      // Check if table exists
      const existsCheck = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [name]
      );

      if (existsCheck.rows[0]?.exists) {
        results.push({ table: name, status: 'already exists' });
        continue;
      }

      // Create table
      const createTableSQL = `
        CREATE TABLE ${name} (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          summary TEXT,
          content TEXT,
          image_url TEXT,
          preview_image_url TEXT,
          source_url TEXT NOT NULL,
          source_id TEXT NOT NULL,
          category TEXT NOT NULL,
          language TEXT DEFAULT 'en',
          hotness_score INTEGER DEFAULT 0,
          is_breaking BOOLEAN DEFAULT FALSE,
          is_trending BOOLEAN DEFAULT FALSE,
          views INTEGER DEFAULT 0,
          shares INTEGER DEFAULT 0,
          comments INTEGER DEFAULT 0,
          published_at TIMESTAMP WITH TIME ZONE NOT NULL,
          aggregated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_${name}_category ON ${name}(category);
        CREATE INDEX IF NOT EXISTS idx_${name}_published ON ${name}(published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_${name}_hotness ON ${name}(hotness_score DESC);
      `;

      await pool.query(createTableSQL);
      results.push({ table: name, status: 'created successfully' });
    } catch (error: any) {
      results.push({
        table: name,
        status: 'failed',
        error: error.message || error.toString(),
      });
    }
  }

  const successCount = results.filter(r => r.status.includes('success') || r.status.includes('exists')).length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return NextResponse.json({
    success: failedCount === 0,
    message: `Database setup completed: ${successCount} tables ready, ${failedCount} failed`,
    results,
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to setup database tables',
    usage: 'POST /api/setup-database to create tables if they don\'t exist',
  });
}

