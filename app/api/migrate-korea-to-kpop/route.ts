import { NextResponse } from 'next/server';
import { getPool } from '@/lib/database';

/**
 * API endpoint to migrate table "korea" to "kpop"
 * This will:
 * 1. Check if table "korea" exists
 * 2. Check if table "kpop" exists
 * 3. If "korea" exists and "kpop" doesn't: Rename "korea" to "kpop"
 * 4. If both exist: Copy data from "korea" to "kpop" and drop "korea"
 * 5. Update sequence name if needed
 */
export async function POST() {
  try {
    const dbPool = getPool();
    if (!dbPool) {
      return NextResponse.json({
        success: false,
        error: 'Database pool not available',
      }, { status: 500 });
    }

    console.log('🔄 Starting migration: korea → kpop');

    // Check if tables exist
    const checkKorea = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'korea'
      );
    `);
    const koreaExists = checkKorea.rows[0]?.exists || false;

    const checkKpop = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'kpop'
      );
    `);
    const kpopExists = checkKpop.rows[0]?.exists || false;

    console.log(`   Table "korea" exists: ${koreaExists}`);
    console.log(`   Table "kpop" exists: ${kpopExists}`);

    if (!koreaExists && !kpopExists) {
      return NextResponse.json({
        success: false,
        error: 'Neither "korea" nor "kpop" table exists. Please create the table first.',
      }, { status: 400 });
    }

    if (!koreaExists && kpopExists) {
      return NextResponse.json({
        success: true,
        message: 'Table "kpop" already exists. No migration needed.',
        koreaExists: false,
        kpopExists: true,
      });
    }

    if (koreaExists && !kpopExists) {
      // Case 1: Rename table "korea" to "kpop"
      console.log('   Renaming table "korea" to "kpop"...');
      
      // Rename table
      await dbPool.query(`ALTER TABLE korea RENAME TO kpop`);
      console.log('   ✅ Table renamed: korea → kpop');

      // Rename sequence if exists
      try {
        await dbPool.query(`ALTER SEQUENCE korea_id_seq RENAME TO kpop_id_seq`);
        console.log('   ✅ Sequence renamed: korea_id_seq → kpop_id_seq');
      } catch (seqError: any) {
        console.warn(`   ⚠️ Could not rename sequence: ${seqError?.message || seqError}`);
        // Try to create sequence if it doesn't exist
        try {
          await dbPool.query(`CREATE SEQUENCE IF NOT EXISTS kpop_id_seq OWNED BY kpop.id`);
          await dbPool.query(`ALTER TABLE kpop ALTER COLUMN id SET DEFAULT nextval('kpop_id_seq')`);
          console.log('   ✅ Created new sequence: kpop_id_seq');
        } catch (createSeqError: any) {
          console.warn(`   ⚠️ Could not create sequence: ${createSeqError?.message || createSeqError}`);
        }
      }

      // Rename indexes if they exist
      const indexQueries = [
        `ALTER INDEX IF EXISTS idx_korea_category RENAME TO idx_kpop_category`,
        `ALTER INDEX IF EXISTS idx_korea_published RENAME TO idx_kpop_published`,
        `ALTER INDEX IF EXISTS idx_korea_hotness RENAME TO idx_kpop_hotness`,
      ];

      for (const query of indexQueries) {
        try {
          await dbPool.query(query);
        } catch (idxError: any) {
          console.warn(`   ⚠️ Could not rename index: ${idxError?.message || idxError}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully renamed table "korea" to "kpop"',
        koreaExists: false,
        kpopExists: true,
        action: 'renamed',
      });
    }

    if (koreaExists && kpopExists) {
      // Case 2: Both exist - copy data and drop "korea"
      console.log('   Both tables exist. Copying data from "korea" to "kpop" and dropping "korea"...');
      
      // Count articles in korea
      const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM korea`);
      const articleCount = parseInt(countResult.rows[0]?.count || '0', 10);
      
      let copiedCount = 0;
      
      if (articleCount > 0) {
        // Copy data (skip duplicates based on source_url)
        // Note: kpop table might not have unique constraint on source_url, so we check manually
        const existingUrls = await dbPool.query(`SELECT source_url FROM kpop WHERE source_url IS NOT NULL`);
        const existingUrlSet = new Set(existingUrls.rows.map((r: any) => r.source_url));
        
        const articlesToCopy = await dbPool.query(`SELECT * FROM korea`);
        
        for (const article of articlesToCopy.rows) {
          if (!existingUrlSet.has(article.source_url)) {
            await dbPool.query(`
              INSERT INTO kpop (
                title, description, summary, content,
                image_url, preview_image_url, source_url, source_id,
                category, language, hotness_score, is_breaking, is_trending,
                views, shares, comments, published_at, aggregated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            `, [
              article.title, article.description, article.summary, article.content,
              article.image_url, article.preview_image_url, article.source_url, article.source_id,
              article.category, article.language, article.hotness_score, article.is_breaking, article.is_trending,
              article.views, article.shares, article.comments, article.published_at, article.aggregated_at
            ]);
            copiedCount++;
          }
        }
        
        console.log(`   ✅ Copied ${copiedCount} articles from "korea" to "kpop" (${articleCount - copiedCount} duplicates skipped)`);
      }

      // Drop old table
      await dbPool.query(`DROP TABLE IF EXISTS korea CASCADE`);
      console.log('   ✅ Dropped table "korea"');

      // Drop old sequence if exists
      try {
        await dbPool.query(`DROP SEQUENCE IF EXISTS korea_id_seq CASCADE`);
        console.log('   ✅ Dropped sequence "korea_id_seq"');
      } catch (seqError: any) {
        console.warn(`   ⚠️ Could not drop sequence: ${seqError?.message || seqError}`);
      }

      return NextResponse.json({
        success: true,
        message: `Successfully copied ${copiedCount} articles from "korea" to "kpop" and dropped "korea"`,
        koreaExists: false,
        kpopExists: true,
        articlesCopied: copiedCount,
        articlesSkipped: articleCount - copiedCount,
        action: 'copied_and_dropped',
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unexpected state',
    }, { status: 500 });
  } catch (error: any) {
    console.error('❌ Error migrating table:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to migrate table',
      errorDetails: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const dbPool = getPool();
    if (!dbPool) {
      return NextResponse.json({
        success: false,
        error: 'Database pool not available',
      }, { status: 500 });
    }

    // Check table status
    const checkKorea = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'korea'
      );
    `);
    const koreaExists = checkKorea.rows[0]?.exists || false;

    const checkKpop = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'kpop'
      );
    `);
    const kpopExists = checkKpop.rows[0]?.exists || false;

    let koreaCount = 0;
    let kpopCount = 0;

    if (koreaExists) {
      const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM korea`);
      koreaCount = parseInt(countResult.rows[0]?.count || '0', 10);
    }

    if (kpopExists) {
      const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM kpop`);
      kpopCount = parseInt(countResult.rows[0]?.count || '0', 10);
    }

    return NextResponse.json({
      success: true,
      koreaExists,
      kpopExists,
      koreaArticleCount: koreaCount,
      kpopArticleCount: kpopCount,
      needsMigration: koreaExists && !kpopExists,
    });
  } catch (error: any) {
    console.error('❌ Error checking table status:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to check table status',
    }, { status: 500 });
  }
}

