import { NextResponse } from 'next/server';
import { deleteAllArticles } from '@/lib/database';

/**
 * Clean up database - delete ALL articles from all tables
 * WARNING: This will delete all articles in the database
 */
export async function POST() {
  try {
    console.log('🧹 Starting COMPLETE database cleanup (deleting ALL articles)...');
    const result = await deleteAllArticles();
    
    // Verify final state
    const pool = await import('@/lib/database').then(m => m.getPool());
    let finalCount = 0;
    if (pool) {
      const tables = ['indonesia', 'china', 'japan', 'korea', 'international'];
      for (const table of tables) {
        try {
          const count = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          finalCount += parseInt(count.rows[0]?.count || '0', 10);
        } catch (e) {
          // Ignore
        }
      }
    }
    
    return NextResponse.json({
      success: result.errors === 0 && finalCount === 0,
      message: `Database cleanup completed: ${result.deleted} articles deleted, ${result.errors} errors. Final count: ${finalCount} articles remaining.`,
      deleted: result.deleted,
      errors: result.errors,
      remaining: finalCount,
      verified: finalCount === 0,
    });
  } catch (error: any) {
    console.error('❌ Error cleaning up database:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to clean up database',
        error: error?.message || error.toString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to clean up database (delete all articles)',
    warning: 'This will delete ALL articles from all tables',
    usage: 'POST /api/cleanup-database',
  });
}
