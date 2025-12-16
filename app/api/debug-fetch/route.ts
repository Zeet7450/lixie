import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

/**
 * Debug endpoint to test Groq API fetch directly
 */
export async function GET() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not found',
      }, { status: 400 });
    }

    const client = new Groq({ apiKey });
    
    // Test with a simple news fetch prompt
    const testPrompt = `You are a news aggregator. Fetch 1 recent news article from CNN Indonesia (https://www.cnnindonesia.com) published in the last 7 days. Return a JSON object with this structure:
{
  "articles": [
    {
      "title": "Article title",
      "description": "Brief description",
      "summary": "3-5 paragraph summary",
      "source_url": "https://www.cnnindonesia.com/...",
      "source_id": "CNN Indonesia",
      "category": "politics",
      "image_url": "https://...",
      "preview_image_url": "https://...",
      "published_at": "2025-12-16T10:00:00Z",
      "is_breaking": false,
      "is_trending": false,
      "hotness_score": 50,
      "language": "id",
      "views": 1000,
      "shares": 50,
      "comments": 20
    }
  ]
}`;

    console.log('🧪 Testing Groq API with simple prompt...');
    
    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a news aggregator bot. Return only valid JSON.',
        },
        {
          role: 'user',
          content: testPrompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'No content in response',
        details: {
          choices: completion.choices,
        },
      }, { status: 500 });
    }

    // Try to parse JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError: any) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse JSON response',
        rawContent: content.substring(0, 1000),
        parseError: parseError.message,
      }, { status: 500 });
    }

    const articles = Array.isArray(parsed) ? parsed : (parsed.articles || []);
    
    return NextResponse.json({
      success: true,
      message: `Groq API test successful. Found ${articles.length} article(s).`,
      articlesCount: articles.length,
      articles: articles.slice(0, 2), // Return first 2 for inspection
      rawResponse: content.substring(0, 500), // First 500 chars
    });
  } catch (error: any) {
    console.error('Debug fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        errorType: error.constructor.name,
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

