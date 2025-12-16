import { NextResponse } from 'next/server';
import { insertArticleToDatabase } from '@/lib/database';
import type { Article } from '@/types';

/**
 * Test endpoint to manually insert an article to database
 */
export async function POST() {
  try {
    // Create a test article
    const testArticle: Omit<Article, 'id' | 'created_at' | 'updated_at'> = {
      title: 'Test Article - Pemerintah Siapkan Kemiringan 5,5% untuk Tol Cibitung-Cikopo',
      description: 'Proyek tol Cibitung-Cikopo yang menghubungkan Jawa Barat dan Jawa Tengah',
      summary: 'Pemerintah berharap proyek tol Cibitung-Cikopo dapat selesai dalam waktu 3 tahun dan dapat beroperasi penuh pada tahun 2028.',
      content: 'Test content',
      source_url: 'https://www.cnnindonesia.com/ekonomi/20251216113454-92-975372/pemerintah-siapkan-kemiringan-55-persen-untuk-tol-cibitung-cikopo',
      source_id: 'CNN Indonesia',
      category: 'economy', // Use English category
      language: 'id',
      hotness_score: 65,
      is_breaking: false,
      is_trending: false,
      views: 2500,
      shares: 80,
      comments: 50,
      published_at: new Date().toISOString(), // Today
      aggregated_at: new Date().toISOString(),
      image_url: 'https://akcdn.detik.net.id/community/media/2023/11/20/c4c1b6a4-9c9d-46b5-b8b5-2e3eaf2d7a7d.png?w=700&q=90',
      preview_image_url: 'https://akcdn.detik.net.id/community/media/2023/11/20/c4c1b6a4-9c9d-46b5-b8b5-2e3eaf2d7a7d.png?w=700&q=90',
    };

    console.log('🧪 Testing article insert to database...');
    
    // Check database connection first
    const { getPool } = await import('@/lib/database');
    const pool = getPool();
    
    if (!pool) {
      return NextResponse.json({
        success: false,
        message: 'Database pool not available',
      }, { status: 500 });
    }
    
    // Check if table exists
    try {
      const tableCheck = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'indonesia'
        )`
      );
      
      if (!tableCheck.rows[0]?.exists) {
        return NextResponse.json({
          success: false,
          message: 'Table "indonesia" does not exist in database',
          suggestion: 'Please run database migrations to create tables',
        }, { status: 500 });
      }
    } catch (checkError: any) {
      return NextResponse.json({
        success: false,
        message: 'Error checking table existence',
        error: checkError.message,
      }, { status: 500 });
    }
    
    const saved = await insertArticleToDatabase('id', testArticle);

    if (saved) {
      return NextResponse.json({
        success: true,
        message: 'Test article inserted successfully!',
        article: {
          id: saved.id,
          title: saved.title,
          category: saved.category,
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to insert test article (returned null) - check server logs for details',
        note: 'This usually means there was an error during insert, but it was caught and returned null',
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Test insert error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Test insert failed',
        error: error.toString(),
        details: {
          code: error.code,
          constraint: error.constraint,
          detail: error.detail,
        },
      },
      { status: 500 }
    );
  }
}

