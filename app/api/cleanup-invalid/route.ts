import { NextResponse } from 'next/server';
import { cleanupInvalidArticles } from '@/lib/database';

/**
 * Clean up invalid articles from database
 * Removes articles that:
 * 1. Published before December 9, 2025
 * 2. Have invalid or inaccessible source_url
 * 3. Missing required fields (title, source_url)
 */
export async function POST() {
  try {
    console.log('🧹 Starting validation cleanup...');
    const result = await cleanupInvalidArticles();

    return NextResponse.json({
      success: result.errors === 0,
      message: `Validation cleanup completed: ${result.deleted} invalid articles deleted, ${result.errors} errors.`,
      deleted: result.deleted,
      errors: result.errors,
      details: result.details,
    });
  } catch (error: any) {
    console.error('❌ Error cleaning up invalid articles:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to clean up invalid articles',
        error: error?.message || error.toString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to clean up invalid articles',
    description: 'Removes articles that are:',
    criteria: [
      'Published before December 9, 2025',
      'Have invalid or inaccessible source_url',
      'Missing required fields (title, source_url)',
    ],
    usage: 'POST /api/cleanup-invalid',
  });
}

