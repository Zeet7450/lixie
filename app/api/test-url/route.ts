import { NextResponse } from 'next/server';
import { isUrlAccessible } from '@/lib/url-validator';

/**
 * Test URL accessibility
 */
export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { success: false, message: 'URL is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Testing URL accessibility: ${url}`);
    const isAccessible = await isUrlAccessible(url, 15000); // 15 second timeout
    
    return NextResponse.json({
      success: true,
      url,
      accessible: isAccessible,
      message: isAccessible 
        ? 'URL is accessible' 
        : 'URL is not accessible (404, timeout, or error)',
    });
  } catch (error: any) {
    console.error('❌ Error testing URL:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to test URL',
        error: error?.message || error.toString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to test URL accessibility',
    usage: 'POST /api/test-url with { "url": "https://example.com" }',
  });
}


