import { NextResponse } from 'next/server';
import { deleteAllArticles } from '@/lib/database';

/**
 * Reset database: Delete all articles and reset ID sequences to start from 1
 */
export async function POST() {
  try {
    console.log('🧹 Starting database reset...');
    const result = await deleteAllArticles();

    return NextResponse.json({
      success: result.errors === 0,
      message: `Database reset completed: ${result.deleted} articles deleted, all ID sequences reset to 1. ${result.errors} errors.`,
      deleted: result.deleted,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('❌ Error resetting database:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to reset database',
        error: error?.message || error.toString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to reset database (delete all articles and reset ID sequences)',
    description: 'This will:',
    actions: [
      'Delete all articles from all tables',
      'Reset all ID sequences to start from 1',
      'Next inserted article will have ID = 1',
    ],
    usage: 'POST /api/reset-database',
    warning: 'This action cannot be undone!',
  });
}

