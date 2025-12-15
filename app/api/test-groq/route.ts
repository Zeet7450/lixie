import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

/**
 * Test endpoint to verify Groq API key is working
 */
export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
  
  if (!apiKey || apiKey.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'API key not found',
      message: 'NEXT_PUBLIC_GROQ_API_KEY is not set in environment variables',
      details: {
        envVarExists: !!process.env.NEXT_PUBLIC_GROQ_API_KEY,
        keyLength: apiKey.length,
        suggestion: 'Add NEXT_PUBLIC_GROQ_API_KEY to .env.local file and restart dev server',
      },
    }, { status: 400 });
  }

  try {
    // Test API key by making a simple request
    const groq = new Groq({ apiKey });
    
    const testResponse = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: 'Say "API key is working" if you can read this.',
        },
      ],
      model: 'llama-3.1-70b-versatile',
      max_tokens: 10,
    });

    const responseText = testResponse.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      message: 'Groq API key is working!',
      details: {
        keyLength: apiKey.length,
        keyPrefix: apiKey.substring(0, 10) + '...',
        testResponse: responseText,
        model: 'llama-3.1-70b-versatile',
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'API key test failed',
      message: error.message || 'Unknown error',
      details: {
        keyLength: apiKey.length,
        keyPrefix: apiKey.substring(0, 10) + '...',
        errorType: error.constructor.name,
      },
    }, { status: 500 });
  }
}
