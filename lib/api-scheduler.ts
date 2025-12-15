import Groq from 'groq-sdk';
import type { NewsRegion } from './api';
import type { Article } from '@/types';
import { insertArticleToDatabase, deleteOldArticles } from './database';
import { 
  getAvailableModel, 
  useQuota, 
  hasQuota, 
  getQuotaSummary,
  type GroqModel 
} from './model-quota';

// Groq API Configuration
// Use a function to get API key to ensure it's read at runtime
// Support both NEXT_PUBLIC_GROQ_API_KEY (for client access) and GROQ_API_KEY (server-only)
function getGroqApiKey(): string {
  // Try multiple ways to get the API key
  // Priority: NEXT_PUBLIC_GROQ_API_KEY > GROQ_API_KEY
  const key = 
    process.env.NEXT_PUBLIC_GROQ_API_KEY || 
    process.env.GROQ_API_KEY || 
    '';
  
  const trimmed = key.trim();
  
  // Log for debugging (server-side only)
  if (typeof window === 'undefined' && trimmed) {
    console.log('✓ Groq API Key found:', trimmed.substring(0, 10) + '...');
  }
  
  return trimmed;
}

const GROQ_API_KEY = getGroqApiKey();
const groqClient = GROQ_API_KEY && GROQ_API_KEY.length > 0 ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// Log API key status (without exposing the actual key) - only on server
if (typeof window === 'undefined') {
  const keyLength = GROQ_API_KEY.length;
  const keyPrefix = GROQ_API_KEY ? GROQ_API_KEY.substring(0, Math.min(10, keyLength)) : '';
  const hasKey = GROQ_API_KEY && keyLength > 0;
  
  console.log('🔍 Groq API Key Check:', {
    hasKey,
    keyLength,
    keyPrefix: hasKey ? `${keyPrefix}...` : 'empty',
    groqClientInitialized: !!groqClient,
    envVar: process.env.NEXT_PUBLIC_GROQ_API_KEY ? 'found' : 'not found',
  });
}

// Rate Limiting Configuration
// Updated: More flexible - 20-30 requests per region per 25 minutes to get 5-10 articles
const RATE_LIMIT = {
  PER_MINUTE: 30, // Groq limit: 30 requests per minute
  PER_REGION_PER_25MIN: 25, // 25 requests per region per 25 minutes (flexible, can go up to 30)
  REGIONS: ['id', 'cn', 'jp', 'kr', 'intl'] as NewsRegion[],
  TOTAL_REGIONS: 5,
  CYCLE_DURATION: 25 * 60 * 1000, // 25 minutes per cycle
  RESERVE_REQUESTS: 20, // Reserve for retries and additional requests
  TARGET_ARTICLES_PER_REGION: 8, // Target 5-10 articles per region per cycle
};

interface RequestQueue {
  region: NewsRegion;
  timestamp: number;
  retryCount: number;
}

class APIScheduler {
  private requestQueue: RequestQueue[] = [];
  private requestCounts: Map<NewsRegion, number> = new Map();
  private cycleStartTime: number = Date.now();
  private availableRequests: number = RATE_LIMIT.RESERVE_REQUESTS;
  public isRunning: boolean = false;
  private scheduledRequests: Map<string, NodeJS.Timeout> = new Map(); // Track scheduled requests

  constructor() {
    // Initialize request counts for each region
    RATE_LIMIT.REGIONS.forEach(region => {
      this.requestCounts.set(region, 0);
    });
  }

  /**
   * Start the API scheduler
   * Fetches news from each region on a schedule
   */
  async start() {
    if (this.isRunning) return;
    
    // Re-check API key at runtime (in case env vars loaded after module init)
    const runtimeKey = getGroqApiKey();
    const hasValidKey = runtimeKey && runtimeKey.length > 0;
    
    if (!hasValidKey) {
      console.error('❌ API Scheduler cannot start: Groq API key not configured');
      console.error('Please set NEXT_PUBLIC_GROQ_API_KEY or GROQ_API_KEY in your .env.local file');
      console.error('Current env check:', {
        NEXT_PUBLIC_GROQ_API_KEY: process.env.NEXT_PUBLIC_GROQ_API_KEY ? `exists (${process.env.NEXT_PUBLIC_GROQ_API_KEY.substring(0, 10)}...)` : 'missing',
        GROQ_API_KEY: process.env.GROQ_API_KEY ? `exists (${process.env.GROQ_API_KEY.substring(0, 10)}...)` : 'missing',
        runtimeKeyLength: runtimeKey.length,
      });
      console.error('💡 Make sure:');
      console.error('   1. File .env.local exists in project root (same level as package.json)');
      console.error('   2. Add either NEXT_PUBLIC_GROQ_API_KEY=your_key OR GROQ_API_KEY=your_key (no quotes, no spaces)');
      console.error('   3. Dev server was restarted after adding env variable');
      console.error('   4. Check: cat .env.local | grep GROQ');
      return;
    }
    
    // Re-initialize client with runtime key if needed
    if (!groqClient && hasValidKey) {
      console.log('⚠️ Re-initializing Groq client with runtime API key...');
      // Note: groqClient is const, so we'll use the runtime key in fetchNewsWithGroq
    }
    
    this.isRunning = true;
    
    console.log('✅ API Scheduler started with Groq API key configured');
    console.log(`   API Key length: ${runtimeKey.length} characters`);
    
    // Clean up old articles (before December 14, 2025) on startup
    try {
      const result = await deleteOldArticles();
      console.log(`Cleaned up old articles: ${result.deleted} deleted, ${result.errors} errors`);
    } catch (error) {
      console.error('Error cleaning up old articles:', error);
    }
    
    this.scheduleNextCycle();
  }

  /**
   * Schedule the next cycle of API calls
   * Runs every 25 minutes per region to get 5-10 articles
   */
  private scheduleNextCycle() {
    const now = Date.now();
    const timeSinceCycleStart = now - this.cycleStartTime;

    if (timeSinceCycleStart >= RATE_LIMIT.CYCLE_DURATION) {
      // Reset cycle
      this.cycleStartTime = now;
      RATE_LIMIT.REGIONS.forEach(region => {
        this.requestCounts.set(region, 0);
      });
      // Reset available requests (add back reserve)
      this.availableRequests = RATE_LIMIT.RESERVE_REQUESTS;
      // Clear all scheduled requests
      this.scheduledRequests.forEach((timeoutId) => clearTimeout(timeoutId));
      this.scheduledRequests.clear();
      console.log('API Scheduler: Cycle reset, starting new 25-minute cycle');
    }

    // Process requests for each region
    this.processRegions();

    // Schedule next check (check every 5 minutes to reset cycle when needed)
    setTimeout(() => {
      if (this.isRunning) {
        this.scheduleNextCycle();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Process API calls for each region
   * Distributes 25 requests per region over 25 minutes to get 5-10 articles
   * Only schedules requests that haven't been scheduled yet
   */
  private async processRegions() {
    const now = Date.now();
    const timeSinceCycleStart = now - this.cycleStartTime;
    
    for (const region of RATE_LIMIT.REGIONS) {
      const count = this.requestCounts.get(region) || 0;
      
      if (count < RATE_LIMIT.PER_REGION_PER_25MIN) {
        const requestsToMake = RATE_LIMIT.PER_REGION_PER_25MIN - count;
        
        // Only schedule requests that haven't been scheduled yet
        // Calculate how many requests should have been made by now based on elapsed time
        const elapsedMinutes = timeSinceCycleStart / 60000; // Convert to minutes
        const expectedRequests = Math.floor(elapsedMinutes * (RATE_LIMIT.PER_REGION_PER_25MIN / 25)); // 1 request per minute
        
        // Only schedule if we're behind schedule
        if (count < expectedRequests) {
          const requestsNeeded = Math.min(expectedRequests - count, requestsToMake, 3); // Max 3 requests per call to avoid spam
          
          for (let i = 0; i < requestsNeeded; i++) {
            const requestKey = `${region}-${count + i}`;
            
            // Check if already scheduled
            if (this.scheduledRequests.has(requestKey)) {
              continue;
            }
            
            const delay = i * 60000; // 60 seconds between requests
            
            if (i === 0 && count === 0) {
              // First request of cycle starts immediately
              this.fetchNewsForRegion(region);
            } else {
              // Schedule with delay
              const timeoutId = setTimeout(() => {
                this.scheduledRequests.delete(requestKey);
                this.fetchNewsForRegion(region);
              }, delay);
              
              this.scheduledRequests.set(requestKey, timeoutId);
            }
          }
        }
      }
    }
    
    // Process queued requests (only a few at a time)
    this.processQueue();
  }

  /**
   * Fetch news for a specific region using Groq AI
   */
  private async fetchNewsForRegion(region: NewsRegion) {
    try {
      const count = this.requestCounts.get(region) || 0;
      
      // Check if we've exceeded the limit for this region
      // Allow up to 30 requests if needed (flexible limit)
      const maxRequests = Math.min(RATE_LIMIT.PER_REGION_PER_25MIN + 5, 30); // Allow up to 30
      
      if (count >= maxRequests) {
        // Use reserve requests if available
        if (this.availableRequests > 0) {
          this.availableRequests--;
          console.log(`Using reserve request for region ${region}. Remaining: ${this.availableRequests}`);
        } else {
          // Queue for next cycle
          this.requestQueue.push({
            region,
            timestamp: Date.now(),
            retryCount: 0,
          });
          console.log(`Queued request for region ${region} (limit reached, no reserve available)`);
          return;
        }
      }

      // Increment request count
      this.requestCounts.set(region, count + 1);
      console.log(`Fetching news for region ${region} (request ${count + 1}/${maxRequests})`);

      // Use Groq to analyze and fetch news
      const articles = await this.fetchNewsWithGroq(region);

      if (articles.length > 0) {
        // Save to database IMMEDIATELY after processing (upload langsung)
        let savedCount = 0;
        for (const article of articles) {
          try {
            const saved = await insertArticleToDatabase(region, article);
            if (saved) {
              savedCount++;
              console.log(`✓ Uploaded article to web: ${article.title.substring(0, 50)}...`);
            }
          } catch (dbError) {
            console.error(`Error saving article to database:`, dbError);
          }
        }
        console.log(`✓ Fetched ${articles.length} articles, uploaded ${savedCount} to database for region ${region}`);
      } else {
        console.log(`No articles fetched for region ${region}`);
      }
    } catch (error) {
      console.error(`Error fetching news for region ${region}:`, error);
      
      // Retry logic - use reserve requests or queue for next cycle
      const queueItem = this.requestQueue.find(q => q.region === region);
      const retryCount = queueItem?.retryCount || 0;
      
      if (retryCount < 3 && this.availableRequests > 0) {
        this.availableRequests--;
        console.log(`Retrying request for region ${region} (attempt ${retryCount + 1}). Remaining reserve: ${this.availableRequests}`);
        // Retry after a delay
        setTimeout(() => {
          this.fetchNewsForRegion(region);
        }, 15000); // Retry after 15 seconds
      } else {
        // Queue for next cycle
        if (!queueItem) {
          this.requestQueue.push({
            region,
            timestamp: Date.now(),
            retryCount: retryCount + 1,
          });
          console.log(`Queued failed request for region ${region} for next cycle`);
        }
      }
    }
  }

  /**
   * Fetch news using Groq AI to analyze and summarize
   * Uses model combination logic: deepseek-r1-distill-llama-70b (utama) -> llama-3.3-70b-versatile (cadangan)
   */
  private async fetchNewsWithGroq(region: NewsRegion): Promise<Article[]> {
    // Get API key at runtime
    const runtimeKey = getGroqApiKey();
    
    if (!runtimeKey || runtimeKey.length === 0) {
      console.error('❌ Groq API key not configured, skipping API call');
      console.error('Please set NEXT_PUBLIC_GROQ_API_KEY in your .env.local file and restart the dev server');
      return [];
    }
    
    // Create client with runtime key (in case env loaded after module init)
    const client = groqClient || new Groq({ apiKey: runtimeKey });
    
    // Get available model based on quota and priority
    let selectedModel = getAvailableModel();
    
    if (!selectedModel) {
      console.error('❌ No models available (all quotas exhausted)');
      console.log('📊 Quota Status:\n' + getQuotaSummary());
      return [];
    }
    
    // Check quota before using
    if (!useQuota(selectedModel)) {
      console.warn(`⚠️ Quota check failed for ${selectedModel}, trying fallback...`);
      selectedModel = getAvailableModel();
      if (!selectedModel) {
        console.error('❌ No fallback models available');
        return [];
      }
      useQuota(selectedModel);
    }
    
    console.log(`✓ Groq API key configured, using model: ${selectedModel} for region: ${region}`);
    console.log('📊 Quota Status:\n' + getQuotaSummary());

    try {
      // Get news sources based on region
      const sources = this.getNewsSources(region);
      
      const targetLanguage = region === 'id' ? 'Indonesian' : 'English';
      
      // Build sources list with URLs and categories
      const sourcesList = sources.map(s => 
        `- ${s.name} (${s.url}) - Categories: ${s.categories.join(', ')}`
      ).join('\n');
      
      // Calculate date range: only articles from December 14, 2025 onwards
      const minDate = new Date('2025-12-14T00:00:00.000Z');
      const minDateStr = minDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const todayDateStr = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      const prompt = `You are a news aggregator bot. Your task is to fetch and analyze the latest trending and breaking news from ${region} region.

ONLY use these verified news sources:
${sourcesList}

CRITICAL DATE REQUIREMENT:
- ONLY fetch articles published from ${minDateStr} (December 14, 2025) onwards
- DO NOT fetch articles older than December 14, 2025
- Prioritize the most recent articles (published today first, then recent days)
- Ensure articles are fresh and current

INSTRUCTIONS:
1. Visit each source website and find the LATEST articles from their category pages (published from ${minDateStr} onwards)
2. Select articles that are:
   - Published from December 14, 2025 onwards (${minDateStr} to ${todayDateStr})
   - Trending, breaking, or highly relevant
   - From ALL categories to ensure comprehensive coverage
3. Extract information directly from the actual article pages
4. Ensure you get articles from ALL categories: technology, politics, economy, business, entertainment, sports, health, science, education, environment, travel, food, fashion, automotive, real-estate, history

Return a JSON object with an "articles" array containing 5-10 articles (prioritize quality over quantity, ensure articles are from December 14, 2025 onwards). Each article must have:
- title: EXACT title from source website (do NOT translate or modify, preserve original language)
- description: Brief 1-2 sentence description in ${targetLanguage}
- summary: Clear and well-structured 3-5 paragraph summary in ${targetLanguage}. Make it readable and informative, covering the main points of the article
- source_url: EXACT URL of the original article (must be a real, accessible URL)
- source_id: News source name (e.g., "BBC News", "Kompas", "Reuters")
- category: Map to one of these categories: technology, politics, economy, business, entertainment, sports, health, science, education, environment, travel, food, fashion, automotive, real-estate, history. Match the article's category from the source website
- image_url: REAL image URL from the article page. Extract from article's main image, og:image meta tag, or article content. MUST be a direct image URL from the source website
- preview_image_url: Preview image URL (can be same as image_url, but must be from the actual article)
- published_at: ISO 8601 timestamp (MUST be from ${minDateStr} (December 14, 2025) onwards, extract exact publish date from article)
- is_breaking: true if marked as breaking/urgent news, false otherwise
- is_trending: true if trending or highly shared, false otherwise
- hotness_score: Number 0-100 based on engagement, recency, and importance
- language: "${region === 'id' ? 'id' : 'en'}"
- views: Estimated view count (if available)
- shares: Estimated share count (if available)
- comments: Estimated comment count (if available)

CRITICAL REQUIREMENTS:
1. DATE FILTER: ONLY include articles published from ${minDateStr} (December 14, 2025) onwards. Check the publish date carefully and exclude any older articles.
2. Title: MUST be EXACTLY as shown on the source website. Do NOT translate, modify, or paraphrase titles
3. Images: image_url and preview_image_url MUST be real image URLs extracted from the article page. Look for:
   - Main article image
   - Open Graph image (og:image meta tag)
   - Article featured image
   - Do NOT use placeholder images, generic URLs, or stock photos
   - Image URLs should be from the source website's domain
4. Summary: Write a clear, well-structured summary in ${targetLanguage} that:
   - Covers the main points of the article
   - Is 3-5 paragraphs long
   - Is easy to read and understand
   - Includes key facts, figures, and context
5. Source URL: Must be the exact, working URL to the article
6. Categories: Accurately map the article's category from the source website to the LIXIE category system. Ensure you get articles from ALL categories.
7. RECENCY: Prioritize articles published TODAY first, then recent days. Do not include articles older than December 14, 2025.

Ensure all data is accurate, extracted directly from the source websites, and only includes articles from ${minDateStr} (December 14, 2025) onwards.`;

      // Try with selected model, fallback to backup if it fails
      let completion;
      let usedModel = selectedModel;
      
      try {
        completion = await client.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a professional news aggregator bot for LIXIE. Your job is to:
1. ONLY fetch news from the verified sources provided (do not use other sources)
2. ONLY fetch articles published from December 14, 2025 onwards (check publish date carefully)
3. Visit the actual source websites and extract real, current articles
4. Preserve the EXACT title from the source website (do not translate or modify titles)
5. Extract REAL image URLs directly from article pages (check og:image, main image, featured image)
6. Write clear, well-structured summaries in ${targetLanguage} (3-5 paragraphs)
7. Accurately map categories from source websites to LIXIE's category system
8. Ensure coverage across ALL categories (technology, politics, economy, business, entertainment, sports, health, science, education, environment, travel, food, fashion, automotive, real-estate, history)
9. Extract all metadata (publish date, views, shares) when available
10. Return valid JSON with accurate, real data from actual articles
11. Prioritize articles published TODAY first, then recent days

IMPORTANT: 
- Only use the verified sources provided
- Only include articles from December 14, 2025 onwards (${minDateStr} onwards)
- Extract images and content directly from article pages, not from summaries or feeds
- Ensure you get articles from all categories for comprehensive coverage`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: selectedModel,
          temperature: 0.7,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        });
        
        console.log(`✅ Successfully used model: ${selectedModel} for region: ${region}`);
      } catch (modelError: any) {
        // If primary model fails (quota exceeded, model unavailable, etc.), try fallback
        console.warn(`⚠️ Model ${selectedModel} failed:`, modelError.message);
        
        // Get fallback model (next available by priority)
        const fallbackModel = getAvailableModel();
        
        if (!fallbackModel || fallbackModel === selectedModel) {
          console.error(`❌ No fallback model available or same model selected`);
          throw modelError; // Re-throw original error
        }
        
        // Check and use fallback quota
        if (!useQuota(fallbackModel)) {
          console.error(`❌ Fallback model ${fallbackModel} quota also exhausted`);
          throw modelError;
        }
        
        console.log(`🔄 Falling back to model: ${fallbackModel} for region: ${region}`);
        usedModel = fallbackModel;
        
        // Retry with fallback model
        completion = await client.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a professional news aggregator bot for LIXIE. Your job is to:
1. ONLY fetch news from the verified sources provided (do not use other sources)
2. ONLY fetch articles published from December 14, 2025 onwards (check publish date carefully)
3. Visit the actual source websites and extract real, current articles
4. Preserve the EXACT title from the source website (do not translate or modify titles)
5. Extract REAL image URLs directly from article pages (check og:image, main image, featured image)
6. Write clear, well-structured summaries in ${targetLanguage} (3-5 paragraphs)
7. Accurately map categories from source websites to LIXIE's category system
8. Ensure coverage across ALL categories (technology, politics, economy, business, entertainment, sports, health, science, education, environment, travel, food, fashion, automotive, real-estate, history)
9. Extract all metadata (publish date, views, shares) when available
10. Return valid JSON with accurate, real data from actual articles
11. Prioritize articles published TODAY first, then recent days

IMPORTANT: 
- Only use the verified sources provided
- Only include articles from December 14, 2025 onwards (${minDateStr} onwards)
- Extract images and content directly from article pages, not from summaries or feeds
- Ensure you get articles from all categories for comprehensive coverage`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: fallbackModel,
          temperature: 0.7,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        });
        
        console.log(`✅ Successfully used fallback model: ${fallbackModel} for region: ${region}`);
      }

      const content = completion.choices[0]?.message?.content;
      if (!content) return [];

      // Parse JSON response
      try {
        const parsed = JSON.parse(content);
        const articles = Array.isArray(parsed) ? parsed : (parsed.articles || []);
        
        // Filter articles: only from December 14, 2025 onwards
        const minDate = new Date('2025-12-14T00:00:00.000Z');
        const minDateTime = minDate.getTime();

        const recentArticles = articles.filter((article: any) => {
          try {
            const publishedTime = new Date(article.published_at).getTime();
            return publishedTime >= minDateTime;
          } catch {
            return false; // Exclude if date is invalid
          }
        });

        // Validate and add IDs, ensure images are real URLs from source websites
        return recentArticles.map((article: any, index: number) => {
          // Ensure image URLs are valid (not placeholders) and from source websites
          const imageUrl = article.image_url || article.preview_image_url || '';
          const previewImageUrl = article.preview_image_url || article.image_url || '';
          
          // Validate that images are not placeholder URLs and are from legitimate sources
          const isValidImageUrl = (url: string) => {
            if (!url) return false;
            
            // Check for placeholder patterns
            const placeholderPatterns = [
              'placeholder',
              'via.placeholder',
              'dummyimage',
              'placehold.it',
              'loremflickr',
              'unsplash.com/random',
              'picsum.photos',
            ];
            if (placeholderPatterns.some(pattern => url.toLowerCase().includes(pattern))) {
              return false;
            }
            
            // Check if URL is from a legitimate news source domain
            const validDomains = [
              'bbc.com', 'reuters.com', 'apnews.com', 'theguardian.com', 'aljazeera.com',
              'kompas.com', 'detik.com', 'cnnindonesia.com',
              'xinhuanet.com', 'chinadaily.com.cn',
              'nhk.or.jp', 'asahi.com', 'japantimes.co.jp',
              'yna.co.kr', 'kbs.co.kr',
            ];
            
            // Allow images from source domains or common CDN/image hosting
            const urlLower = url.toLowerCase();
            const isFromValidDomain = validDomains.some(domain => urlLower.includes(domain));
            const isFromCDN = urlLower.includes('cdn') || urlLower.includes('img') || urlLower.includes('image');
            
            return isFromValidDomain || (isFromCDN && url.startsWith('http'));
          };

          // Clean and format summary
          const cleanSummary = article.summary 
            ? article.summary
                .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
                .trim()
            : '';

          return {
            ...article,
            id: Date.now() + index, // Generate unique ID
            hotness_score: article.hotness_score || 50,
            views: article.views || 0,
            shares: article.shares || 0,
            comments: article.comments || 0,
            summary: cleanSummary || article.description, // Use summary or fallback to description
            // Only use image URLs if they're valid (not placeholders and from legitimate sources)
            image_url: isValidImageUrl(imageUrl) ? imageUrl : undefined,
            preview_image_url: isValidImageUrl(previewImageUrl) ? previewImageUrl : undefined,
          };
        }) as Article[];
      } catch (parseError) {
        console.error('❌ Error parsing Groq response:', parseError);
        console.error('Response content:', content?.substring(0, 500));
        return [];
      }
    } catch (error: any) {
      console.error('❌ Groq API error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        region,
      });
      throw error;
    }
  }

  /**
   * Get news sources for a region
   * Only use these verified sources with clear category structure
   */
  private getNewsSources(region: NewsRegion): { name: string; url: string; categories: string[] }[] {
    const sources: Record<NewsRegion, { name: string; url: string; categories: string[] }[]> = {
      'id': [
        {
          name: 'Kompas',
          url: 'https://www.kompas.com',
          categories: ['News (Nasional, Global)', 'Ekonomi', 'Tekno', 'Olahraga', 'Entertainment', 'Humaniora', 'Lifestyle']
        },
        {
          name: 'Detik',
          url: 'https://www.detik.com',
          categories: ['detikNews', 'detikFinance', 'detikInet (tech)', 'detikSport', 'detikHot (entertainment)', 'detikHealth']
        },
        {
          name: 'CNN Indonesia',
          url: 'https://www.cnnindonesia.com',
          categories: ['Nasional', 'Internasional', 'Ekonomi', 'Olahraga', 'Teknologi', 'Hiburan', 'Gaya Hidup']
        }
      ],
      'cn': [
        {
          name: 'Xinhua (English)',
          url: 'http://www.xinhuanet.com/english/',
          categories: ['Politics', 'Business', 'World', 'Sci-Tech', 'Culture', 'Sports']
        },
        {
          name: 'China Daily',
          url: 'https://www.chinadaily.com.cn',
          categories: ['China', 'World', 'Business', 'Tech', 'Culture', 'Travel', 'Sports', 'Opinion']
        }
      ],
      'jp': [
        {
          name: 'NHK World',
          url: 'https://www3.nhk.or.jp/nhkworld/',
          categories: ['News (Asia, World, Japan)', 'Business', 'Culture', 'Science']
        },
        {
          name: 'The Asahi Shimbun',
          url: 'https://www.asahi.com',
          categories: ['Politics', 'Economy', 'Society', 'Sports', 'Culture', 'Science & Tech', 'International']
        },
        {
          name: 'The Japan Times',
          url: 'https://www.japantimes.co.jp',
          categories: ['News (National, World, Business)', 'Opinion', 'Community', 'Culture', 'Sports', 'Life']
        }
      ],
      'kr': [
        {
          name: 'Yonhap News Agency',
          url: 'https://en.yna.co.kr',
          categories: ['Politics', 'Economy', 'Society', 'Culture', 'Sports', 'World', 'Sci/Tech']
        },
        {
          name: 'KBS News',
          url: 'https://news.kbs.co.kr',
          categories: ['Politics', 'Economy', 'Society', 'International', 'Culture', 'Sports']
        }
      ],
      'intl': [
        {
          name: 'BBC News',
          url: 'https://www.bbc.com/news',
          categories: ['World', 'Business', 'Tech', 'Science', 'Entertainment & Arts', 'Health', 'Sport']
        },
        {
          name: 'Reuters',
          url: 'https://www.reuters.com',
          categories: ['World', 'Business', 'Markets', 'Tech', 'Environment', 'Sports', 'Lifestyle']
        },
        {
          name: 'AP News',
          url: 'https://apnews.com',
          categories: ['U.S.', 'World', 'Politics', 'Business', 'Entertainment', 'Sports', 'Health', 'Science']
        },
        {
          name: 'The Guardian',
          url: 'https://www.theguardian.com',
          categories: ['News (World/UK/US)', 'Opinion', 'Sport', 'Culture', 'Lifestyle', 'Environment', 'Tech']
        },
        {
          name: 'Al Jazeera English',
          url: 'https://www.aljazeera.com',
          categories: ['News', 'Features', 'Economy', 'Opinion', 'Sports', 'Human Rights', 'Science & Tech']
        }
      ],
    };
    return sources[region] || [];
  }

  /**
   * Process queued requests
   * Only processes a few at a time to avoid overwhelming the system
   */
  private processQueue() {
    if (this.requestQueue.length === 0) return;
    
    const now = Date.now();
    const processed: RequestQueue[] = [];
    const maxProcessPerCall = 5; // Max 5 requests per call to avoid spam

    for (const request of this.requestQueue) {
      if (processed.length >= maxProcessPerCall) break;
      
      // Process requests older than 2 minutes or if we have available requests
      if (now - request.timestamp > 120000 || this.availableRequests > 0) {
        if (this.availableRequests > 0 || request.retryCount < 3) {
          if (this.availableRequests > 0) {
            this.availableRequests--;
          }
          this.fetchNewsForRegion(request.region);
          processed.push(request);
        }
      }
    }

    // Remove processed requests
    this.requestQueue = this.requestQueue.filter(
      req => !processed.includes(req)
    );
    
    if (processed.length > 0) {
      console.log(`Processed ${processed.length} queued requests (${this.requestQueue.length} remaining)`);
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    this.isRunning = false;
    // Clear all scheduled requests
    this.scheduledRequests.forEach((timeoutId) => clearTimeout(timeoutId));
    this.scheduledRequests.clear();
    console.log('API Scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      requestCounts: Object.fromEntries(this.requestCounts),
      queueLength: this.requestQueue.length,
      availableRequests: this.availableRequests,
    };
  }
}

// Singleton instance
export const apiScheduler = new APIScheduler();

/**
 * Initialize and start the API scheduler
 * Should be called from a client component
 */
export function startAPIScheduler() {
  if (typeof window === 'undefined') return;
  
  // Start scheduler after a delay to ensure app is loaded
  setTimeout(() => {
    apiScheduler.start();
    console.log('API Scheduler initialized and started');
  }, 5000);
}

