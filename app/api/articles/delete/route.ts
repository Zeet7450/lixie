import { NextResponse } from 'next/server';
import { deleteArticles } from '@/lib/database';
import type { NewsRegion } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { region, dateRange, deleteAll } = body;

    // Validate input
    if (deleteAll) {
      // Delete all articles from all regions
      const result = await deleteArticles('all', 'all');
      return NextResponse.json({
        success: true,
        message: `Successfully deleted all articles from all regions. ${result.deleted} articles deleted.`,
        deleted: result.deleted,
        errors: result.errors,
      });
    }

    // Delete articles based on region and date range
    const deleteRegion = region || 'all';
    const result = await deleteArticles(deleteRegion as NewsRegion | 'all', dateRange || 'all');

    return NextResponse.json({
      success: true,
      message: `Successfully deleted articles from region ${deleteRegion}${dateRange ? ` (${dateRange})` : ''}. ${result.deleted} articles deleted.`,
      deleted: result.deleted,
      errors: result.errors,
      region: deleteRegion,
      dateRange: dateRange || 'all',
    });
  } catch (error: any) {
    console.error('Error deleting articles:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete articles',
        errorDetails: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

