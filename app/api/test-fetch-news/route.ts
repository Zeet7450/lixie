import { NextResponse } from 'next/server';
import { apiScheduler } from '@/lib/api-scheduler';

/**
 * Test endpoint to manually trigger a news fetch for debugging
 */
export async function POST(request?: Request) {
  try {
    // Get region from request body or default to 'id'
    let region: 'id' | 'cn' | 'intl' = 'id';
    
    if (request) {
      try {
        const body = await request.json();
        region = body.region || 'id';
      } catch {
        // No body, use default 'id'
      }
    }
    
    // Ensure scheduler is running
    if (!apiScheduler.isRunning) {
      await apiScheduler.start();
    }
    
    // Access private method via type assertion (for testing only)
    const scheduler = apiScheduler as any;
    
    // Manually trigger fetch for one region
    console.log(`🧪 Testing news fetch for region: ${region}`);
    console.log(`📅 Date filter: Only articles from December 9, 2025 onwards`);
    
    const sources = apiScheduler.getNewsSources(region);
    console.log(`📰 Sources: ${sources.length} news sources for ${region} region`);
    sources.forEach((source, idx) => {
      console.log(`   ${idx + 1}. ${source.name} - ${source.url}`);
    });
    
    // Reset state for this region
    scheduler.webExplorationProgress.set(region, 0);
    scheduler.regionAnalysisPending.set(region, false);
    scheduler.requestCounts.set(region, 0);
    scheduler.collectedArticleUrls.set(region, []);
    
    // Call the private method directly (bypasses exploration phase for faster testing)
    const startTime = Date.now();
    console.log(`\n🚀 Starting direct fetch (bypassing exploration for faster test)...`);
    await scheduler.fetchNewsForRegion(region);
    const duration = Date.now() - startTime;
    
    // Wait a bit for database operations
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check database for new articles
    const { fetchArticlesFromDatabase } = await import('@/lib/database');
    const articles = await fetchArticlesFromDatabase(region);
    
    console.log(`\n✅ Test fetch completed in ${duration}ms`);
    console.log(`📊 Found ${articles.length} articles in database for region ${region}`);
    
    return NextResponse.json({
      success: true,
      message: `Test fetch completed for region ${region}. Check server logs for detailed results.`,
      region,
      duration: `${duration}ms`,
      articlesFound: articles.length,
      sourcesCount: sources.length,
      articles: articles.slice(0, 10).map(a => ({
        id: a.id,
        title: a.title?.substring(0, 60),
        source: a.source_id,
        published_at: a.published_at,
        category: a.category,
        url: a.source_url,
      })),
    });
  } catch (error: any) {
    console.error('❌ Test fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Test fetch failed',
        error: error.toString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger test fetch',
    usage: 'POST /api/test-fetch-news to manually trigger a news fetch for debugging',
  });
}

