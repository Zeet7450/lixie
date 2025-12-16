import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function GET() {
  try {
    const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
    
    if (!groqKey || groqKey.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Groq API key not configured',
      }, { status: 400 });
    }
    
    const client = new Groq({ apiKey: groqKey });
    
    // Test with a simple request
    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: 'Say "Groq API is working" in one sentence.',
        },
      ],
      model: 'llama-3.3-70b-versatile', // Updated to active model
      max_tokens: 50,
    });
    
    const response = completion.choices[0]?.message?.content || 'No response';
    
    return NextResponse.json({
      success: true,
      message: 'Groq API test successful',
      response,
      model: 'llama-3.3-70b-versatile',
    });
  } catch (error: any) {
    console.error('Groq API test error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Groq API test failed',
        error: error.toString(),
      },
      { status: 500 }
    );
  }
}
