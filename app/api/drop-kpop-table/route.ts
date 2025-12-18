import { NextResponse } from 'next/server';
import { getPool } from '@/lib/database';

/**
 * Drop kpop table from database
 * This endpoint will permanently delete the kpop table and all its data
 */
export async function POST() {
  try {
    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database pool not available',
        },
        { status: 500 }
      );
    }

    console.log('🗑️ Dropping kpop table from database...');

    // Check if table exists first
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'kpop'
      )
    `);

    const tableExists = checkTable.rows[0]?.exists || false;

    if (!tableExists) {
      return NextResponse.json({
        success: true,
        message: 'kpop table does not exist - already removed',
        tableExists: false,
      });
    }

    // Drop the table
    await pool.query('DROP TABLE IF EXISTS kpop CASCADE');
    
    // Also drop sequence if exists
    await pool.query('DROP SEQUENCE IF EXISTS kpop_id_seq CASCADE');

    console.log('✅ Successfully dropped kpop table');

    return NextResponse.json({
      success: true,
      message: 'kpop table successfully dropped from database',
      tableExists: true,
      dropped: true,
    });
  } catch (error: any) {
    console.error('❌ Error dropping kpop table:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to drop kpop table',
        errorDetails: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database pool not available',
        },
        { status: 500 }
      );
    }

    // Check if table exists
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'kpop'
      )
    `);

    const tableExists = checkTable.rows[0]?.exists || false;

    // If exists, get count
    let articleCount = 0;
    if (tableExists) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM kpop');
      articleCount = parseInt(countResult.rows[0]?.count || '0', 10);
    }

    return NextResponse.json({
      success: true,
      data: {
        tableExists,
        articleCount,
        usage: 'POST /api/drop-kpop-table to permanently delete the kpop table',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to check kpop table status',
      },
      { status: 500 }
    );
  }
}
