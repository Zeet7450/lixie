import { NextResponse } from 'next/server';
import { fetchArticlesFromDatabase } from '@/lib/database';
import type { NewsRegion } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = (searchParams.get('region') || 'id') as NewsRegion;
    const category = searchParams.get('category') || 'all';

    const articles = await fetchArticlesFromDatabase(region, category);

    return NextResponse.json({
      success: true,
      data: articles,
      articles: articles, // Also include for backward compatibility
      count: articles.length,
    });
  } catch (error: any) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: error.message || 'Failed to fetch articles',
      },
      { status: 500 }
    );
  }
}
