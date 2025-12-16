import { NextResponse } from 'next/server';
import { fetchArticlesFromDatabase } from '@/lib/database';
import type { NewsRegion } from '@/lib/api';

export async function GET(request: Request) {
  try {
    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/articles/route.ts:6',message:'GET /api/articles called',data:{url:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
    }
    // #endregion
    
    const { searchParams } = new URL(request.url);
    const region = (searchParams.get('region') || 'id') as NewsRegion;
    const category = searchParams.get('category') || 'all';

    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/articles/route.ts:11',message:'Before fetchArticlesFromDatabase',data:{region,category},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    }
    // #endregion
    const articles = await fetchArticlesFromDatabase(region, category);
    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/articles/route.ts:14',message:'After fetchArticlesFromDatabase',data:{region,category,articlesCount:articles.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    }
    // #endregion

    return NextResponse.json({
      success: true,
      data: articles,
      articles: articles, // Also include for backward compatibility
      count: articles.length,
    });
  } catch (error: any) {
    console.error('Error fetching articles:', error);
    // #region agent log
    if (typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/articles/route.ts:30',message:'Error in GET /api/articles',data:{error:error?.message,errorStack:error?.stack,errorName:error?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
    }
    // #endregion
    return NextResponse.json(
      {
        success: false,
        data: [],
        articles: [],
        count: 0,
        error: error.message || 'Failed to fetch articles',
        errorDetails: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
