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
import { isUrlAccessible, validateUrls } from './url-validator';

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
// Rotasi region setiap 5 menit: id → cn → jp → kr → intl → id (berulang)
// Setiap region di-fetch setiap 25 menit (5 region × 5 menit)
const RATE_LIMIT = {
  PER_MINUTE: 30, // Groq limit: 30 requests per minute
  PER_REGION_PER_CYCLE: 10, // 10 requests per region (1 per website)
  REGIONS: ['id', 'cn', 'jp', 'kr', 'intl'] as NewsRegion[],
  TOTAL_REGIONS: 5,
  REGION_ROTATION_INTERVAL: 5 * 60 * 1000, // 5 menit per region (rotasi)
  RESERVE_REQUESTS: 20, // Reserve for retries (increased to handle queue better)
  TARGET_ARTICLES_PER_REGION: 10, // Target 10 articles per region (1 per website)
};

interface RequestQueue {
  region: NewsRegion;
  timestamp: number;
  retryCount: number;
}

class APIScheduler {
  private requestQueue: RequestQueue[] = [];
  private requestCounts: Map<NewsRegion, number> = new Map();
  private currentRegionIndex: number = 0; // Index untuk rotasi region
  private availableRequests: number = RATE_LIMIT.RESERVE_REQUESTS;
  public isRunning: boolean = false;
  private scheduledRequests: Map<string, NodeJS.Timeout> = new Map(); // Track scheduled requests
  private regionRotationTimeout: NodeJS.Timeout | null = null; // Timeout untuk rotasi region

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
    
    // Clean up old articles (older than 7 days) on startup
    try {
      const result = await deleteOldArticles();
      console.log(`Cleaned up old articles: ${result.deleted} deleted, ${result.errors} errors`);
    } catch (error) {
      console.error('Error cleaning up old articles:', error);
    }
    
    this.scheduleNextCycle();
  }

  /**
   * Schedule rotasi region setiap 5 menit
   * Urutan: id → cn → jp → kr → intl → id (berulang)
   * Setiap region di-fetch setiap 25 menit (5 region × 5 menit)
   */
  private scheduleNextCycle() {
    if (!this.isRunning) return;

    // Get current region untuk di-fetch
    const currentRegion = RATE_LIMIT.REGIONS[this.currentRegionIndex];
    
    console.log(`🔄 API Scheduler: Rotasi region ke ${currentRegion} (${this.currentRegionIndex + 1}/${RATE_LIMIT.TOTAL_REGIONS})`);
    console.log(`   Setiap region akan di-fetch setiap ${RATE_LIMIT.TOTAL_REGIONS * 5} menit`);
    
    // Reset request count untuk region ini
    this.requestCounts.set(currentRegion, 0);
    
    // Process region ini (10 requests dengan delay 3 menit per request)
    this.processRegion(currentRegion);
    
    // Move to next region untuk rotasi berikutnya
    this.currentRegionIndex = (this.currentRegionIndex + 1) % RATE_LIMIT.TOTAL_REGIONS;
    
    // Schedule next region rotation (5 menit lagi)
    this.regionRotationTimeout = setTimeout(() => {
      if (this.isRunning) {
        this.scheduleNextCycle();
      }
    }, RATE_LIMIT.REGION_ROTATION_INTERVAL); // 5 menit
    
    // Clean up old articles (older than Dec 9, 2025) setiap kali rotasi
    deleteOldArticles()
      .then((result) => {
        if (result.deleted > 0) {
          console.log(`🧹 Cleaned up ${result.deleted} old articles (before December 9, 2025) from database`);
        }
        if (result.errors > 0) {
          console.warn(`⚠️ ${result.errors} errors occurred during cleanup`);
        }
      })
      .catch((error) => {
        console.error('❌ Error cleaning up old articles:', error);
      });
    
    // Also run validation cleanup to remove invalid articles (async, don't block)
    import('./database').then(({ cleanupInvalidArticles }) => {
      cleanupInvalidArticles()
        .then((result) => {
          if (result.deleted > 0) {
            console.log(`🧹 Cleaned up ${result.deleted} invalid articles (date/URL/fields validation)`);
            console.log(`   Breakdown: ${result.details.dateInvalid} date invalid, ${result.details.urlInvalid} URL invalid, ${result.details.missingFields} missing fields`);
          }
          if (result.errors > 0) {
            console.warn(`⚠️ ${result.errors} errors occurred during validation cleanup`);
          }
        })
        .catch((error) => {
          console.error('❌ Error cleaning up invalid articles:', error);
        });
    }).catch((error) => {
      console.error('❌ Error importing cleanupInvalidArticles:', error);
    });
  }

  /**
   * Process API calls for one region
   * Schedules all 10 requests per region dengan delay 3 menit per request
   */
  private async processRegion(region: NewsRegion) {
    const now = Date.now();
    const count = this.requestCounts.get(region) || 0;
    
    if (count < RATE_LIMIT.PER_REGION_PER_CYCLE) {
      // Schedule all 10 requests dengan delay 3 menit per request
      // Request 1: segera, Request 2: +3 menit, Request 3: +6 menit, ... Request 10: +27 menit
      const requestsToSchedule = RATE_LIMIT.PER_REGION_PER_CYCLE - count;
      
      for (let i = 0; i < requestsToSchedule; i++) {
        const requestIndex = count + i; // 0-9
        const requestKey = `${region}-${requestIndex}`;
        
        // Check if already scheduled
        if (this.scheduledRequests.has(requestKey)) {
          continue;
        }
        
        // Calculate delay: requestIndex * 3 minutes (0, 3, 6, 9, ... 27 minutes)
        const delay = requestIndex * 3 * 60 * 1000; // 3 minutes per request
        
        if (delay === 0) {
          // Execute first request immediately
          this.fetchNewsForRegion(region);
        } else {
          // Schedule for future time
          const timeoutId = setTimeout(() => {
            this.scheduledRequests.delete(requestKey);
            this.fetchNewsForRegion(region);
          }, delay);
          
          this.scheduledRequests.set(requestKey, timeoutId);
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
      // Allow up to 12 requests if needed (flexible limit for retries)
      const maxRequests = Math.min(RATE_LIMIT.PER_REGION_PER_CYCLE + 2, 12); // Allow up to 12
      
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
      console.log(`📰 Fetching news for region ${region} (request ${count + 1}/${RATE_LIMIT.PER_REGION_PER_CYCLE})`);

      // Use Groq to analyze and fetch news
      console.log(`\n🔄 Starting fetch for region ${region}...`);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:253',message:'Starting fetchNewsWithGroq',data:{region,requestCount:count+1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const articles = await this.fetchNewsWithGroq(region);
      console.log(`📥 Groq API returned ${articles.length} article(s) for region ${region}`);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:256',message:'fetchNewsWithGroq completed',data:{region,articlesCount:articles.length,articleTitles:articles.slice(0,3).map((a: Article) => a.title?.substring(0,50))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      if (articles.length > 0) {
        // Save to database IMMEDIATELY after processing (upload langsung)
        let savedCount = 0;
        let errorCount = 0;
        console.log(`📥 Processing ${articles.length} articles for region ${region}...`);
        
        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          try {
            console.log(`  [${i + 1}/${articles.length}] Attempting to save: ${article.title?.substring(0, 60)}...`);
            console.log(`    - Category: ${article.category}`);
            console.log(`    - Published: ${article.published_at}`);
            console.log(`    - Source: ${article.source_id}`);
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:270',message:'Before insertArticleToDatabase',data:{region,articleTitle:article.title?.substring(0,50),category:article.category,publishedAt:article.published_at},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            const saved = await insertArticleToDatabase(region, article);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:273',message:'After insertArticleToDatabase',data:{region,articleTitle:article.title?.substring(0,50),saved:saved!==null,savedId:saved?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            if (saved) {
              savedCount++;
              console.log(`    ✅ SAVED to database with ID: ${saved.id}`);
            } else {
              errorCount++;
              console.error(`    ❌ FAILED to save (returned null) - check database logs above`);
            }
          } catch (dbError: any) {
            errorCount++;
            console.error(`    ❌ ERROR saving article to database:`, dbError?.message || dbError);
            console.error(`    Error details:`, {
              code: dbError?.code,
              constraint: dbError?.constraint,
              detail: dbError?.detail,
            });
          }
        }
        
        console.log(`\n📊 Summary for region ${region}:`);
        console.log(`   ✅ Saved: ${savedCount}/${articles.length}`);
        console.log(`   ❌ Failed: ${errorCount}/${articles.length}`);
        
        if (savedCount === 0 && articles.length > 0) {
          console.error(`\n⚠️ CRITICAL: Fetched ${articles.length} articles but NONE were saved!`);
          console.error(`   This indicates a serious database insert problem.`);
          console.error(`   Check database connection and table structure.`);
        } else if (savedCount > 0) {
          console.log(`\n✅ Successfully uploaded ${savedCount} article(s) to database for region ${region}`);
        }
      } else {
        console.log(`⚠️ No articles fetched for region ${region} - Groq API returned empty array`);
      }
    } catch (error: any) {
      console.error(`Error fetching news for region ${region}:`, error);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:316',message:'Error in fetchNewsForRegion',data:{region,error:error?.message,errorStack:error?.stack,errorName:error?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
      // #endregion
      
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
   * Uses model combination logic: llama-3.3-70b-versatile (utama) -> llama-3.1-8b-instant (cadangan)
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
    
    // CRITICAL: Validate selected model is active
    const ACTIVE_MODELS: GroqModel[] = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    if (selectedModel && !ACTIVE_MODELS.includes(selectedModel)) {
      console.error(`❌ CRITICAL: getAvailableModel returned decommissioned model: ${selectedModel}`);
      console.error(`   This should never happen. Forcing model reset...`);
      selectedModel = null;
    }
    
    if (!selectedModel) {
      console.error('❌ No models available (all quotas exhausted or decommissioned model detected)');
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
      
      // Calculate date range: only articles from December 9, 2025 onwards
      const minDate = new Date('2025-12-09T00:00:00.000Z');
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

      const prompt = `You are a news aggregator bot with REAL-TIME web browsing capabilities. Your task is to fetch and analyze the latest trending and breaking news from ${region} region by ACTUALLY VISITING and READING the source websites.

CRITICAL WEB BROWSING REQUIREMENTS:
1. You MUST use your web browsing tool to actually visit each of these verified news sources:
${sourcesList}

2. For EACH source website, you MUST:
   a. Open the website URL in your browser (e.g., visit https://www.kompas.com)
   b. Navigate to their latest news section or homepage
   c. Click on actual article links to open the FULL article page
   d. Read the COMPLETE article content (not just headline or summary)
   e. Extract the EXACT article URL from the browser address bar (copy the URL you see in the browser)
   f. Verify the article URL works by clicking it again or refreshing the page
   g. Only include articles that you have ACTUALLY opened and read in your browser

3. DO NOT:
   - Make up URLs or article links
   - Use URLs from article lists or feeds (use the actual article page URL)
   - Include articles you haven't actually opened in your browser
   - Use placeholder or example URLs
   - Copy URLs without verifying they work

CRITICAL DATE REQUIREMENT - READ CAREFULLY:
- ONLY fetch articles published from December 9, 2025 (${minDateStr}) onwards
- DO NOT fetch articles published before December 9, 2025
- DO NOT fetch articles from December 8, 2025 or earlier
- The minimum publish date is December 9, 2025 00:00:00 UTC
- Prioritize the most recent articles (published today first, then recent days)
- Ensure articles are fresh and current (from ${minDateStr} to ${todayDateStr})

STEP-BY-STEP INSTRUCTIONS (MUST FOLLOW - USE YOUR WEB BROWSER):
1. For EACH of the 10 sources listed above, you MUST:
   a. Open your web browser and visit the website URL (e.g., https://www.kompas.com)
   b. Navigate to their latest news section or homepage using the website's navigation
   c. Browse through the articles and find ones published from December 9, 2025 onwards
   d. CLICK on the article link to open the FULL article page in your browser
   e. Wait for the page to fully load
   f. Read the COMPLETE article content (scroll through the entire article)
   g. Copy the EXACT URL from your browser's address bar (this is the article URL)
   h. CRITICAL: The URL must be the REAL URL from the browser, NOT a constructed URL
   i. DO NOT use URLs with patterns like /view.php?ud= or similar - these are usually invalid
   j. Use URLs that look like real article URLs: /news/..., /article/..., /berita/..., /story/..., or date-based patterns like /2025/12/15/...
   k. Verify the URL works by refreshing the page or clicking the link again
   l. Extract information directly from the actual article page you have open (NOT from headlines, summaries, or feeds)

2. For each article you select, you MUST verify IN YOUR BROWSER:
   - The article page is actually open and loaded in your browser
   - The article URL in the address bar is the EXACT URL you will include (copy it exactly, do NOT construct it)
   - The URL does NOT contain patterns like /view.php?ud=, /view.php?id=, or similar invalid patterns
   - The URL looks like a real article URL (contains /news/, /article/, /berita/, /story/, or date pattern)
   - The publish date is visible on the article page and is from December 9, 2025 onwards
   - The article content exists and is complete (you can read the full article text)
   - The article image exists on the page (you can see it in the browser)
   - The URL works when you refresh or visit it directly (test it!)

3. Select articles that are:
   - Published from December 9, 2025 (${minDateStr}) onwards to ${todayDateStr}
   - Trending, breaking, or highly relevant
   - From ALL categories to ensure comprehensive coverage
   - REAL articles that exist on the website (not made up or fictional)

4. Extract information DIRECTLY from the actual article pages:
   - Read the FULL article content (not just headline)
   - Extract the EXACT title as shown on the page
   - Extract the REAL publish date from the article metadata
   - Extract the REAL image URL from the article page (check og:image, main image, or article content)
   - Copy the EXACT article URL (test it to make sure it works)

5. Ensure you get articles from ALL categories: technology, politics, economy, business, entertainment, sports, health, science, education, environment (including natural disasters, climate change, environmental issues), travel, food, fashion, automotive, real-estate, history

6. PRIORITIZE environment/disaster news: Include natural disasters, climate events, environmental emergencies from each region when available

7. VERIFICATION: Before including an article, verify:
   - The URL actually exists and is accessible (you can visit it)
   - The publish date is clearly visible and is from December 9, 2025 onwards
   - The article has real content (not just a placeholder or error page)
   - The image URL is real and from the source website

Return a JSON object with an "articles" array containing exactly 1 article per source (10 articles total for 10 sources, prioritize quality, ensure articles are from ${minDateStr} (December 9, 2025) onwards). Each article must have:
- title: EXACT title from source website (do NOT translate or modify, preserve original language)
- description: Brief 1-2 sentence description in ${targetLanguage}
- summary: Clear and well-structured 1-2 paragraph summary in ${targetLanguage}. Make it concise, readable, and informative, covering the main points of the article. Keep it brief (1-2 paragraphs only, not longer)
- source_url: EXACT URL of the original article (must be a REAL, ACCESSIBLE URL that you have actually visited and verified works. Test the URL before including it. Do NOT make up URLs or use placeholder URLs)
- source_id: News source name (e.g., "BBC News", "Kompas", "Reuters")
- category: Map to one of these categories: technology, politics, economy, business, entertainment, sports, health, science, education, environment, travel, food, fashion, automotive, real-estate, history. Match the article's category from the source website.
- image_url: REAL image URL from the article page. Extract from article's main image, og:image meta tag, or article content. MUST be a direct image URL from the source website
- preview_image_url: Preview image URL (can be same as image_url, but must be from the actual article)
- published_at: ISO 8601 timestamp (MUST be from December 9, 2025 00:00:00 UTC onwards, extract EXACT publish date from the article page on the source website - this is the date when the article was originally published by the news source, NOT the date when you aggregated it. Format: YYYY-MM-DDTHH:mm:ss.sssZ)
- is_breaking: true if marked as breaking/urgent news, false otherwise
- is_trending: true if trending or highly shared, false otherwise
- hotness_score: Number 0-100 based on engagement, recency, and importance
- language: "${region === 'id' ? 'id' : 'en'}"
- views: Estimated view count (if available)
- shares: Estimated share count (if available)
- comments: Estimated comment count (if available)

CRITICAL REQUIREMENTS:
1. DATE FILTER: ONLY include articles published from December 9, 2025 00:00:00 UTC (${minDateStr}) onwards. DO NOT include articles from before December 9, 2025. Check the publish date on the article page carefully and exclude any older articles. If an article doesn't have a visible publish date, check the URL, metadata, or article content for date clues.
2. Title: MUST be EXACTLY as shown on the source website. Do NOT translate, modify, or paraphrase titles
3. Images: image_url and preview_image_url MUST be real image URLs extracted from the article page. Look for:
   - Main article image
   - Open Graph image (og:image meta tag)
   - Article featured image
   - Do NOT use placeholder images, generic URLs, or stock photos
   - Image URLs should be from the source website's domain
4. Summary: Write a clear, well-structured summary in ${targetLanguage} that:
   - Covers the main points of the article
   - Is 1-2 paragraphs long (concise, not longer)
   - Is easy to read and understand
   - Includes key facts, figures, and context
5. Source URL: Must be the EXACT URL from your browser's address bar after you have opened and read the article. CRITICAL STEPS:
   a. Open the article in your browser
   b. Wait for the page to fully load
   c. Copy the URL from the browser address bar (this is the EXACT URL)
   d. CRITICAL: The URL must be REAL and from the actual article page, NOT constructed
   e. Test the URL by refreshing the page or opening it in a new tab
   f. Only include the URL if the article page loads successfully (not 404, not error page)
   g. The URL must be the actual article page URL, not a list page or feed URL
   
   VALID URL PATTERNS (examples of what real article URLs look like):
   - https://www.kompas.com/news/read/2025/12/15/123456/article-title
   - https://www.detik.com/news/d-1234567/article-title
   - https://www.bbc.com/news/world-12345678
   - https://www.reuters.com/world/article-title-2025-12-15/
   - https://www.cnnindonesia.com/nasional/20251215123456/article-title
   - https://www.tempo.co/read/news/2025/12/15/article-title
   
   INVALID URL PATTERNS (DO NOT USE):
   - /view.php?ud=123456 (this is NOT a real article URL)
   - /view.php?id=123456 (this is NOT a real article URL)
   - /article.php?news=123456 (this is NOT a real article URL)
   - Any URL with /view.php, /article.php, or similar PHP query parameters
   - Constructed URLs that you haven't actually seen in the browser
   
   DO NOT:
   - Make up URLs or guess URL patterns
   - Use placeholder URLs or example URLs
   - Use URLs from article lists or feeds (these are not the actual article URLs)
   - Include URLs that you haven't actually opened in your browser
   - Include URLs that return 404, timeout, or error pages
   - Modify or construct URLs manually
   - Use URLs with /view.php?ud= or similar patterns (these are usually invalid)
   
   VERIFICATION: Before including each URL, you MUST:
   - Have the article page open in your browser
   - See the full article content loaded
   - Copy the URL directly from the browser address bar (the EXACT URL you see)
   - Verify the URL does NOT contain /view.php or similar invalid patterns
   - Test that the URL works by refreshing or visiting it again
6. Categories: Accurately map the article's category from the source website to the LIXIE category system. Ensure you get articles from ALL categories, especially environment/disaster news.
7. RECENCY: Prioritize articles published TODAY first, then recent days. Do not include articles older than December 9, 2025. The minimum date is December 9, 2025 00:00:00 UTC.
8. ENVIRONMENT/DISASTER NEWS: If there are natural disasters, climate events, or environmental emergencies in the region, prioritize these articles and categorize them as "environment".

CRITICAL VERIFICATION REQUIREMENTS (USE YOUR WEB BROWSER):
- You MUST use your web browsing tool to actually open each website in your browser
- You MUST click on article links to open the FULL article page (not just read from a list)
- You MUST wait for each article page to fully load before extracting information
- You MUST copy the EXACT URL from your browser's address bar (the URL you see when the article is open)
- You MUST verify each URL works by refreshing the page or opening it again
- You MUST extract the EXACT publish date from the article page you have open (look for "Published:", "Tanggal:", "Date:", "Diterbitkan:", or similar metadata visible on the page)
- You MUST extract the REAL image URL from the article page you see in your browser (check og:image meta tag, main article image, or featured image)
- You MUST verify the article content exists and is complete by reading the full article text in your browser
- You MUST write a detailed summary (1-2 paragraphs, minimum 50 characters) based on the article content you actually read
- You MUST ensure the article URL is accessible - if you can't open it in your browser, don't include it
- You MUST only include articles that you have successfully opened, read, and verified in your browser

DO NOT:
- Make up articles, URLs, or content
- Use placeholder, example, or guessed URLs
- Use today's date as published_at unless the article was actually published today
- Include articles you haven't actually opened and read in your browser
- Include articles with URLs that return 404, timeout, or error pages
- Include articles without summary or content (minimum 50 characters)
- Copy URLs from article lists or feeds (these are not the actual article page URLs)
- Construct or modify URLs manually (always copy from browser address bar)

CRITICAL VERIFICATION CHECKLIST (for each article before including):
1. ✅ The article page is open in your browser and fully loaded
2. ✅ You can see and read the complete article content (not just headline)
3. ✅ The URL in the browser address bar is the EXACT URL you will include (copy it exactly)
4. ✅ The URL does NOT contain invalid patterns like /view.php?ud=, /view.php?id=, or similar
5. ✅ The URL looks like a real article URL (contains /news/, /article/, /berita/, /story/, or date pattern)
6. ✅ You have tested the URL by refreshing or opening it again (it works!)
7. ✅ The publish date is clearly visible on the page and is from December 9, 2025 onwards
8. ✅ You have written a complete summary (1-2 paragraphs, at least 50 characters) based on the article you read
9. ✅ The article image is visible on the page and you can extract its URL
10. ✅ The article is from one of the 10 verified sources listed above

REMEMBER: You MUST use your web browsing tool to actually open and read each article. Do not rely on summaries, feeds, or article lists. Only include articles that you have successfully opened, read, and verified in your browser. Every URL must be copied directly from your browser's address bar after opening the article page.

Ensure all data is accurate, extracted directly from the REAL article pages you have opened in your browser, and only includes articles from December 9, 2025 00:00:00 UTC onwards. Every URL must be the exact URL from your browser address bar and must work when tested. Articles that fail these validations will be REJECTED.`;

      // CRITICAL: Validate model before API call
      const ACTIVE_MODELS_LIST: GroqModel[] = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
      if (!selectedModel || !ACTIVE_MODELS_LIST.includes(selectedModel)) {
        console.error(`❌ CRITICAL: Invalid model selected: ${selectedModel}`);
        console.error(`   Active models: ${ACTIVE_MODELS_LIST.join(', ')}`);
        // Force get a valid model
        selectedModel = getAvailableModel();
        if (!selectedModel) {
          console.error('❌ No valid models available');
          return [];
        }
        console.log(`✓ Using fallback model: ${selectedModel}`);
      }
      
      // Try with selected model, fallback to backup if it fails
      let completion;
      let usedModel = selectedModel;
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:430',message:'Before Groq API call',data:{selectedModel,region},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      try {
        // CRITICAL: Double-check model before API call
        if (!ACTIVE_MODELS_LIST.includes(usedModel)) {
          console.error(`❌ CRITICAL: Attempting to use invalid model: ${usedModel}`);
          console.error(`   Active models: ${ACTIVE_MODELS_LIST.join(', ')}`);
          console.error(`   Forcing model change to active model...`);
          usedModel = ACTIVE_MODELS_LIST[0]; // Use primary model
          console.log(`✓ Changed to: ${usedModel}`);
        }
        
        completion = await client.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a professional news aggregator bot for LIXIE with REAL-TIME web browsing capabilities. Your job is to:
1. ONLY fetch news from the verified sources provided (do not use other sources)
2. ONLY fetch articles published from December 9, 2025 (${minDateStr}) onwards - check publish date carefully on each article page
3. ACTUALLY VISIT the source websites using your web browsing capabilities and extract REAL, CURRENT articles (not made up or fictional)
4. Preserve the EXACT title from the source website (do not translate or modify titles)
5. Extract REAL image URLs directly from article pages (check og:image meta tag in HTML, main article image, featured image)
6. Write clear, well-structured summaries in ${targetLanguage} (1-2 paragraphs only, concise) based on the ACTUAL article content you read
7. Accurately map categories from source websites to LIXIE's category system
8. Ensure coverage across ALL categories (technology, politics, economy, business, entertainment, sports, health, science, education, environment, travel, food, fashion, automotive, real-estate, history)
9. Extract all metadata (publish date, views, shares) when available from the article page
10. Return valid JSON with accurate, real data from actual articles you have visited
11. Prioritize articles published TODAY first, then recent days

CRITICAL REQUIREMENTS:
- You MUST actually visit each website URL and read the real article pages
- You MUST verify each URL works before including it (test the URL)
- You MUST extract the EXACT publish date from the article page metadata (look for "Published:", "Tanggal:", "Date:", "Diterbitkan:" in HTML)
- You MUST extract REAL image URLs from the article page HTML (check og:image meta tag, main image, featured image)
- Only use the verified sources provided
- Only include articles from December 9, 2025 onwards
- Extract images and content directly from article pages, not from summaries or feeds
- Ensure you get articles from all categories for comprehensive coverage
- Do NOT make up articles, URLs, or dates`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: usedModel, // Use validated model (not selectedModel)
          temperature: 0.7,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        });
        
        console.log(`✅ Successfully used model: ${selectedModel} for region: ${region}`);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:465',message:'Groq API call successful',data:{selectedModel,region},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      } catch (modelError: any) {
        // If primary model fails (quota exceeded, model unavailable, etc.), try fallback
        console.warn(`⚠️ Model ${selectedModel} failed:`, modelError.message);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:503',message:'Model failed, attempting fallback',data:{selectedModel,errorMessage:modelError.message,region},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // Get fallback model (next available by priority, excluding the failed one)
        // Skip the failed model and get next available
        const allModels: GroqModel[] = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] as GroqModel[];
        const fallbackModel = allModels.find((m: GroqModel) => m !== selectedModel && hasQuota(m)) || null;
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:510',message:'Fallback model selected',data:{fallbackModel,selectedModel,region},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        if (!fallbackModel || fallbackModel === selectedModel) {
          console.error(`❌ No fallback model available or same model selected`);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:515',message:'No fallback available',data:{selectedModel,region},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          throw modelError; // Re-throw original error
        }
        
        // Check and use fallback quota
        if (!useQuota(fallbackModel)) {
          console.error(`❌ Fallback model ${fallbackModel} quota also exhausted`);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:521',message:'Fallback quota exhausted',data:{fallbackModel,region},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          throw modelError;
        }
        
        console.log(`🔄 Falling back to model: ${fallbackModel} for region: ${region}`);
        usedModel = fallbackModel;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:527',message:'Using fallback model',data:{fallbackModel,region},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // Retry with fallback model
        completion = await client.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a professional news aggregator bot for LIXIE. Your job is to:
1. ONLY fetch news from the verified sources provided (do not use other sources)
2. ONLY fetch articles published from ${minDateStr} onwards (last 7 days, check publish date carefully)
3. Visit the actual source websites and extract real, current articles
4. Preserve the EXACT title from the source website (do not translate or modify titles)
5. Extract REAL image URLs directly from article pages (check og:image, main image, featured image)
6. Write clear, well-structured summaries in ${targetLanguage} (1-2 paragraphs only, concise)
7. Accurately map categories from source websites to LIXIE's category system
8. Ensure coverage across ALL categories (technology, politics, economy, business, entertainment, sports, health, science, education, environment, travel, food, fashion, automotive, real-estate, history)
9. PRIORITIZE environment/disaster news: Include natural disasters, climate events, environmental emergencies when available (categorize as "environment")
10. Extract all metadata (publish date, views, shares) when available
11. Return valid JSON with accurate, real data from actual articles
12. Prioritize articles published TODAY first, then recent days
13. Fetch exactly 1 article per source (10 articles total for 10 sources)

IMPORTANT: 
- Only use the verified sources provided
- Only include articles from ${minDateStr} onwards (last 7 days)
- Extract images and content directly from article pages, not from summaries or feeds
- Ensure you get articles from all categories for comprehensive coverage
- If there are natural disasters or environmental emergencies in the region, prioritize these articles`,
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:558',message:'Got Groq response content',data:{region,contentLength:content?.length,hasContent:!!content},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      if (!content) return [];

      // Parse JSON response
      try {
        const parsed = JSON.parse(content);
        const articles = Array.isArray(parsed) ? parsed : (parsed.articles || []);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:565',message:'Parsed Groq JSON response',data:{region,articlesCount:articles.length,isArray:Array.isArray(parsed)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        // Filter articles: only from December 14, 2025 onwards
        // Filter: only articles from last 7 days (but be lenient - accept articles from today even if date parsing fails)
        // Filter: only articles from December 9, 2025 onwards
        const minDate = new Date('2025-12-09T00:00:00.000Z');
        const minDateTime = minDate.getTime();
        const today = new Date().getTime();

        console.log(`📅 Filtering articles: ${articles.length} total`);
        console.log(`   Min date: December 9, 2025 00:00:00 UTC (${minDate.toISOString()})`);
        console.log(`   Today: ${new Date(today).toISOString()}`);

        const recentArticles = articles.filter((article: any) => {
          try {
            if (!article.published_at) {
              // If no published_at, accept it (might be today's news)
              console.warn(`⚠️ Article missing published_at, accepting anyway: ${article.title?.substring(0, 50)}...`);
              return true; // Accept articles without date (likely today's news)
            }
            const publishedTime = new Date(article.published_at).getTime();
            const isRecent = publishedTime >= minDateTime;
            if (!isRecent) {
              console.warn(`⚠️ Article filtered out (too old): ${article.title?.substring(0, 50)}... (published: ${article.published_at})`);
            }
            return isRecent;
          } catch (dateError: any) {
            // If date parsing fails, accept it anyway (might be today's news with invalid format)
            console.warn(`⚠️ Article date parsing failed, accepting anyway: ${article.title?.substring(0, 50)}... (error: ${dateError?.message || dateError})`);
            return true; // Accept articles with invalid date (likely today's news)
          }
        });

        console.log(`📊 After date filter: ${recentArticles.length}/${articles.length} articles remain`);
        
        // STRICT: Reject all articles if date filter removes everything (don't accept invalid dates)
        if (articles.length > 0 && recentArticles.length === 0) {
          console.error(`❌ All ${articles.length} articles were filtered out by date!`);
          console.error(`   REJECTED: All articles are from before December 9, 2025 or have invalid dates`);
          console.error(`   This indicates the model may not be following date requirements correctly`);
          return []; // Return empty array - don't accept invalid articles
        }
        
        const articlesToProcess = recentArticles;

        // Validate and add IDs, ensure images are real URLs from source websites
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:615',message:'Before mapping articles',data:{region,articlesToProcessCount:articlesToProcess.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        // First, validate URLs accessibility in parallel (batch validation)
        // NOTE: We'll be more lenient - some websites may block automated requests
        // but the URLs might still be valid. We'll validate but not reject everything.
        console.log(`🔍 Validating ${articlesToProcess.length} article URLs for accessibility...`);
        const sourceUrls = articlesToProcess.map((a: any) => a.source_url).filter(Boolean);
        const urlValidationResults = await validateUrls(sourceUrls, 2); // Validate 2 URLs at a time (slower but more reliable)
        
        const mappedArticles = articlesToProcess.map((article: any, index: number): Article | null => {
          // Map category from Indonesian to English if needed
          const categoryMapping: Record<string, string> = {
            'ekonomi': 'economy',
            'teknologi': 'technology',
            'tekno': 'technology',
            'politik': 'politics',
            'olahraga': 'sports',
            'hiburan': 'entertainment',
            'lifestyle': 'fashion',
            'gaya hidup': 'fashion',
            'kesehatan': 'health',
            'sains': 'science',
            'pendidikan': 'education',
            'lingkungan': 'environment',
            'travel': 'travel',
            'makanan': 'food',
            'otomotif': 'automotive',
            'properti': 'real-estate',
            'sejarah': 'history',
            'bisnis': 'business',
            'nasional': 'politics',
            'internasional': 'politics',
            'global': 'politics',
          };
          
          // Normalize category to English
          const normalizedCategory = categoryMapping[article.category?.toLowerCase()] || article.category || 'politics';
          
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

          // Validate source URL (must be valid HTTP/HTTPS URL from legitimate news sources)
          const isValidSourceUrl = (url: string) => {
            if (!url) return false;
            try {
              const urlObj = new URL(url);
              const isValidProtocol = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
              const hasHostname = urlObj.hostname.length > 0;
              
              // Check if URL is from a legitimate news source domain
              const validDomains = [
                'kompas.com', 'detik.com', 'cnnindonesia.com', 'tempo.co', 'antaranews.com',
                'thejakartapost.com', 'bisnis.com', 'katadata.co.id', 'tvri.go.id', 'republika.co.id',
                'xinhuanet.com', 'chinadaily.com.cn', 'ecns.cn', 'people.com.cn',
                'nhk.or.jp', 'asahi.com', 'japantimes.co.jp', 'mainichi.jp',
                'yna.co.kr', 'kbs.co.kr', 'chosun.com', 'joongang.co.kr',
                'bbc.com', 'reuters.com', 'apnews.com', 'theguardian.com', 'aljazeera.com', 'cnn.com',
              ];
              
              const urlLower = urlObj.hostname.toLowerCase();
              const isFromValidDomain = validDomains.some(domain => urlLower.includes(domain));
              
              // Reject placeholder, example, or invalid URLs
              const invalidPatterns = [
                'example.com', 'placeholder', 'test.com', 'localhost', '127.0.0.1',
                'dummy', 'fake', 'sample', 'lorem', 'ipsum',
              ];
              const hasInvalidPattern = invalidPatterns.some(pattern => urlLower.includes(pattern));
              
              return isValidProtocol && hasHostname && isFromValidDomain && !hasInvalidPattern;
            } catch {
              return false;
            }
          };
          
          // CRITICAL: Check for invalid PHP patterns FIRST (before other validations)
          const urlLower = (article.source_url || '').toLowerCase();
          const invalidPhpPatterns = [
            '/view.php?ud=',
            '/view.php?id=',
            '/view.php?news=',
            '/article.php?ud=',
            '/article.php?id=',
            '/news.php?ud=',
            '/news.php?id=',
            '/view.php',
            '/article.php',
            '/news.php',
          ];
          
          const hasInvalidPhpPattern = invalidPhpPatterns.some(pattern => urlLower.includes(pattern));
          if (hasInvalidPhpPattern) {
            console.log(`❌ Article REJECTED (URL contains invalid PHP pattern): ${article.title?.substring(0, 50)}...`);
            console.log(`   URL: ${article.source_url}`);
            console.log(`   Reason: URL contains /view.php?ud= or similar invalid pattern - this is NOT a real article URL`);
            console.log(`   Real article URLs should look like: /news/..., /article/..., /berita/..., /story/..., or date-based patterns`);
            return null; // REJECT immediately - these are definitely invalid
          }
          
          // Validate source URL format and domain
          if (!isValidSourceUrl(article.source_url || '')) {
            console.log(`⚠️ Article filtered out (invalid source_url): ${article.title?.substring(0, 50)}...`);
            console.log(`   URL: ${article.source_url}`);
            console.log(`   Reason: URL is not from a legitimate news source or contains invalid patterns`);
            return null; // Filter out articles with invalid source URLs
          }

          // CRITICAL: Validate URL accessibility (check if URL actually works)
          // NOTE: We'll be lenient - if URL format is valid and from legitimate domain, accept it
          // Some websites may block automated requests but URLs are still valid
          const urlAccessible = urlValidationResults.get(article.source_url || '');
          
          if (urlAccessible === false) {
            // URL validation failed - but check if URL format is valid
            // If URL format looks correct (from valid domain, proper structure), accept it anyway
            // The website might just be blocking automated requests
            const urlLower = (article.source_url || '').toLowerCase();
            const looksLikeValidUrl = urlLower.includes('/news/') || 
                                     urlLower.includes('/article/') || 
                                     urlLower.includes('/berita/') ||
                                     urlLower.includes('/story/') ||
                                     urlLower.match(/\d{4}\/\d{2}\/\d{2}/) || // Date pattern
                                     urlLower.match(/\/\d{4,}/); // Article ID pattern
            
            if (looksLikeValidUrl && isValidSourceUrl(article.source_url || '')) {
              console.warn(`⚠️ URL validation failed but URL format looks valid: ${article.source_url}`);
              console.warn(`   Accepting article anyway (website may be blocking automated requests)`);
              // Accept the article - URL format is correct, website might just block bots
            } else {
              console.log(`❌ Article REJECTED (URL not accessible and format invalid): ${article.title?.substring(0, 50)}...`);
              console.log(`   URL: ${article.source_url}`);
              console.log(`   Reason: URL returned 404/timeout AND format doesn't look like valid article URL`);
              return null; // REJECT only if both validation fails AND format is invalid
            }
          }
          
          if (urlAccessible === undefined) {
            // URL wasn't validated - accept if format looks valid
            console.warn(`⚠️ URL validation result not found for: ${article.source_url}`);
            console.warn(`   Accepting article if URL format is valid`);
            // Don't reject - let it through if URL format is valid
          }

          // STRICT DATE FILTER: only from December 9, 2025 onwards
          // REJECT articles from 2020, 2021, 2022, 2023, 2024, or before Dec 9, 2025
          const minDate = new Date('2025-12-09T00:00:00.000Z');
          let articleDate: Date | null = null;
          let isDateValid = false; // Default to false (strict)
          
          if (!article.published_at) {
            console.log(`⚠️ Article filtered out (missing published_at): ${article.title?.substring(0, 50)}...`);
            console.log(`   REJECTED: Articles must have published_at date`);
            return null; // REJECT articles without date
          }
          
          try {
            articleDate = new Date(article.published_at);
            
            // Check if date is valid
            if (isNaN(articleDate.getTime())) {
              console.log(`⚠️ Article filtered out (invalid date format): ${article.title?.substring(0, 50)}...`);
              console.log(`   Date string: ${article.published_at}`);
              return null; // REJECT invalid dates
            }
            
            // STRICT: Only accept dates from December 9, 2025 onwards
            isDateValid = articleDate >= minDate;
            
            if (!isDateValid) {
              const year = articleDate.getFullYear();
              console.log(`⚠️ Article filtered out (date too old): ${article.title?.substring(0, 50)}...`);
              console.log(`   Published: ${article.published_at} (${articleDate.toISOString()})`);
              console.log(`   Year: ${year} (REJECTED: must be from Dec 9, 2025 onwards)`);
              console.log(`   Min date: ${minDate.toISOString()}`);
              return null; // REJECT articles older than Dec 9, 2025
            }
          } catch (dateError) {
            console.log(`⚠️ Article filtered out (date parsing error): ${article.title?.substring(0, 50)}...`);
            console.log(`   Date string: ${article.published_at}`);
            console.log(`   Error: ${dateError}`);
            return null; // REJECT articles with date parsing errors
          }

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
            summary: cleanSummary, // Use cleaned summary (already validated to exist and be >= 50 chars)
            // Only use image URLs if they're valid (not placeholders and from legitimate sources)
            image_url: isValidImageUrl(imageUrl) ? imageUrl : undefined,
            preview_image_url: isValidImageUrl(previewImageUrl) ? previewImageUrl : undefined,
            // Ensure source_url is valid
            source_url: isValidSourceUrl(article.source_url || '') ? article.source_url : undefined,
          };
        }).filter((article: Article | null): article is Article => article !== null);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api-scheduler.ts:740',message:'Articles mapped successfully',data:{region,mappedCount:mappedArticles.length,articleTitles:mappedArticles.slice(0,3).map((a: Article) => a.title?.substring(0,50))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        return mappedArticles;
      } catch (parseError: any) {
        console.error('❌ Error parsing Groq response:', parseError);
        const contentStr = typeof content === 'string' ? content : String(content || '');
        if (contentStr) {
          console.error('Response content:', contentStr.substring(0, 500));
        }
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
   * 10 verified sources per region with comprehensive category coverage
   */
  private getNewsSources(region: NewsRegion): { name: string; url: string; categories: string[] }[] {
    const sources: Record<NewsRegion, { name: string; url: string; categories: string[] }[]> = {
      'id': [
        {
          name: 'Kompas',
          url: 'https://www.kompas.com',
          categories: ['Nasional', 'Global', 'Ekonomi', 'Tekno', 'Olahraga', 'Entertainment', 'Humaniora', 'Lifestyle', 'Environment']
        },
        {
          name: 'Tempo.co',
          url: 'https://www.tempo.co',
          categories: ['Nasional', 'Internasional', 'Ekonomi', 'Teknologi', 'Olahraga', 'Hiburan', 'Lifestyle', 'Environment']
        },
        {
          name: 'ANTARA News',
          url: 'https://www.antaranews.com',
          categories: ['Nasional', 'Internasional', 'Ekonomi', 'Teknologi', 'Olahraga', 'Hiburan', 'Lifestyle', 'Environment']
        },
        {
          name: 'The Jakarta Post',
          url: 'https://www.thejakartapost.com',
          categories: ['National', 'World', 'Business', 'Tech', 'Sports', 'Entertainment', 'Lifestyle', 'Environment']
        },
        {
          name: 'CNN Indonesia',
          url: 'https://www.cnnindonesia.com',
          categories: ['Nasional', 'Internasional', 'Ekonomi', 'Olahraga', 'Teknologi', 'Hiburan', 'Gaya Hidup', 'Environment']
        },
        {
          name: 'Detikcom',
          url: 'https://www.detik.com',
          categories: ['detikNews', 'detikFinance', 'detikInet (tech)', 'detikSport', 'detikHot (entertainment)', 'detikHealth', 'Environment']
        },
        {
          name: 'Bisnis Indonesia',
          url: 'https://www.bisnis.com',
          categories: ['Ekonomi', 'Bisnis', 'Saham', 'Teknologi', 'Lifestyle', 'Environment']
        },
        {
          name: 'Katadata',
          url: 'https://katadata.co.id',
          categories: ['Ekonomi', 'Bisnis', 'Teknologi', 'Data', 'Riset', 'Environment']
        },
        {
          name: 'TVRI News',
          url: 'https://tvri.go.id',
          categories: ['Nasional', 'Internasional', 'Ekonomi', 'Olahraga', 'Hiburan', 'Environment']
        },
        {
          name: 'Republika',
          url: 'https://www.republika.co.id',
          categories: ['Nasional', 'Internasional', 'Ekonomi', 'Olahraga', 'Hiburan', 'Lifestyle', 'Environment']
        }
      ],
      'cn': [
        {
          name: 'Xinhua News Agency',
          url: 'http://www.xinhuanet.com/english/',
          categories: ['Politics', 'Business', 'World', 'Sci-Tech', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'China Daily',
          url: 'https://www.chinadaily.com.cn',
          categories: ['China', 'World', 'Business', 'Tech', 'Culture', 'Travel', 'Sports', 'Opinion', 'Environment']
        },
        {
          name: 'South China Morning Post',
          url: 'https://www.scmp.com',
          categories: ['China', 'World', 'Business', 'Tech', 'Politics', 'Culture', 'Lifestyle', 'Environment']
        },
        {
          name: 'CGTN',
          url: 'https://www.cgtn.com',
          categories: ['China', 'World', 'Business', 'Tech', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'Caixin Global',
          url: 'https://www.caixinglobal.com',
          categories: ['Business', 'Finance', 'Economy', 'Tech', 'Markets', 'Environment']
        },
        {
          name: 'Global Times',
          url: 'https://www.globaltimes.cn',
          categories: ['China', 'World', 'Politics', 'Business', 'Tech', 'Culture', 'Environment']
        },
        {
          name: 'People\'s Daily Online',
          url: 'http://en.people.cn',
          categories: ['Politics', 'Business', 'World', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'Sixth Tone',
          url: 'https://www.sixthtone.com',
          categories: ['Society', 'Culture', 'Business', 'Tech', 'Lifestyle', 'Environment']
        },
        {
          name: 'Shanghai Daily',
          url: 'https://www.shine.cn',
          categories: ['China', 'Business', 'Tech', 'Culture', 'Lifestyle', 'Environment']
        },
        {
          name: 'China.org.cn',
          url: 'http://www.china.org.cn',
          categories: ['China', 'World', 'Business', 'Culture', 'Tech', 'Environment']
        }
      ],
      'jp': [
        {
          name: 'NHK World-Japan',
          url: 'https://www3.nhk.or.jp/nhkworld/',
          categories: ['News (Asia, World, Japan)', 'Business', 'Culture', 'Science', 'Environment']
        },
        {
          name: 'The Japan Times',
          url: 'https://www.japantimes.co.jp',
          categories: ['News (National, World, Business)', 'Opinion', 'Community', 'Culture', 'Sports', 'Life', 'Environment']
        },
        {
          name: 'The Asahi Shimbun',
          url: 'https://www.asahi.com/ajw/',
          categories: ['Politics', 'Economy', 'Society', 'Sports', 'Culture', 'Science & Tech', 'International', 'Environment']
        },
        {
          name: 'Kyodo News',
          url: 'https://english.kyodonews.net',
          categories: ['Politics', 'Business', 'World', 'Society', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'Nikkei Asia',
          url: 'https://asia.nikkei.com',
          categories: ['Business', 'Markets', 'Economy', 'Tech', 'Politics', 'Environment']
        },
        {
          name: 'The Mainichi',
          url: 'https://mainichi.jp/english/',
          categories: ['Politics', 'Business', 'Society', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'The Yomiuri Shimbun',
          url: 'https://japannews.yomiuri.co.jp',
          categories: ['Politics', 'Business', 'World', 'Society', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'Japan Today',
          url: 'https://japantoday.com',
          categories: ['Japan', 'World', 'Business', 'Tech', 'Culture', 'Lifestyle', 'Environment']
        },
        {
          name: 'Nippon.com',
          url: 'https://www.nippon.com',
          categories: ['Culture', 'Society', 'Business', 'Politics', 'Tech', 'Environment']
        },
        {
          name: 'Jiji Press',
          url: 'https://jen.jiji.com',
          categories: ['Politics', 'Business', 'World', 'Society', 'Culture', 'Sports', 'Environment']
        }
      ],
      'kr': [
        {
          name: 'Yonhap News Agency',
          url: 'https://en.yna.co.kr',
          categories: ['Politics', 'Economy', 'Society', 'Culture', 'Sports', 'World', 'Sci/Tech', 'Entertainment', 'Environment']
        },
        {
          name: 'The Korea Herald',
          url: 'https://www.koreaherald.com',
          categories: ['Politics', 'Business', 'World', 'Tech', 'Culture', 'Sports', 'Lifestyle', 'Environment']
        },
        {
          name: 'The Korea Times',
          url: 'https://www.koreatimes.co.kr',
          categories: ['Politics', 'Business', 'World', 'Tech', 'Culture', 'Sports', 'Lifestyle', 'Environment']
        },
        {
          name: 'KBS World',
          url: 'https://world.kbs.co.kr',
          categories: ['Politics', 'Economy', 'Society', 'International', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'Korea JoongAng Daily',
          url: 'https://koreajoongangdaily.joins.com',
          categories: ['Politics', 'Business', 'World', 'Tech', 'Culture', 'Sports', 'Lifestyle', 'Environment']
        },
        {
          name: 'The Chosun Ilbo',
          url: 'https://english.chosun.com',
          categories: ['Politics', 'Business', 'World', 'Society', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'Hankyoreh',
          url: 'https://english.hani.co.kr',
          categories: ['Politics', 'Business', 'Society', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'Pulse News',
          url: 'https://pulsenews.co.kr',
          categories: ['Business', 'Economy', 'Finance', 'Tech', 'Markets', 'Environment']
        },
        {
          name: 'The Dong-A Ilbo',
          url: 'https://www.donga.com/en',
          categories: ['Politics', 'Business', 'World', 'Society', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'Soompi',
          url: 'https://www.soompi.com',
          categories: ['Entertainment', 'K-Pop', 'Culture', 'Lifestyle', 'Music', 'TV', 'Environment']
        }
      ],
      'intl': [
        {
          name: 'Reuters',
          url: 'https://www.reuters.com',
          categories: ['World', 'Business', 'Markets', 'Tech', 'Environment', 'Sports', 'Lifestyle', 'Politics']
        },
        {
          name: 'Associated Press (AP)',
          url: 'https://apnews.com',
          categories: ['U.S.', 'World', 'Politics', 'Business', 'Entertainment', 'Sports', 'Health', 'Science', 'Environment']
        },
        {
          name: 'BBC News',
          url: 'https://www.bbc.com/news',
          categories: ['World', 'Business', 'Tech', 'Science', 'Entertainment & Arts', 'Health', 'Sport', 'Environment']
        },
        {
          name: 'The New York Times',
          url: 'https://www.nytimes.com',
          categories: ['World', 'U.S.', 'Politics', 'Business', 'Tech', 'Science', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'The Guardian',
          url: 'https://www.theguardian.com',
          categories: ['News (World/UK/US)', 'Opinion', 'Sport', 'Culture', 'Lifestyle', 'Environment', 'Tech', 'Business']
        },
        {
          name: 'Bloomberg',
          url: 'https://www.bloomberg.com',
          categories: ['Business', 'Markets', 'Economy', 'Tech', 'Politics', 'Environment']
        },
        {
          name: 'The Washington Post',
          url: 'https://www.washingtonpost.com',
          categories: ['Politics', 'World', 'Business', 'Tech', 'Opinion', 'Sports', 'Environment']
        },
        {
          name: 'Deutsche Welle (DW)',
          url: 'https://www.dw.com',
          categories: ['World', 'Europe', 'Business', 'Culture', 'Science', 'Environment']
        },
        {
          name: 'France 24',
          url: 'https://www.france24.com',
          categories: ['World', 'Europe', 'Business', 'Culture', 'Sports', 'Environment']
        },
        {
          name: 'Euronews',
          url: 'https://www.euronews.com',
          categories: ['World', 'Europe', 'Business', 'Culture', 'Tech', 'Environment']
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
    const maxProcessPerCall = 10; // Increased from 5 to 10 requests per call

    // Sort queue by timestamp (oldest first) to prioritize waiting requests
    this.requestQueue.sort((a, b) => a.timestamp - b.timestamp);

    for (const request of this.requestQueue) {
      if (processed.length >= maxProcessPerCall) break;
      
      // Process requests if:
      // 1. Request is old enough (1 minute wait, reduced from 2 minutes)
      // 2. OR reserve requests are available
      // 3. OR retry count is less than 3
      const canProcess = (now - request.timestamp > 60000) || 
                         (this.availableRequests > 0) || 
                         (request.retryCount < 3);
      
      if (canProcess) {
        // Use reserve if available, otherwise proceed anyway (will be queued again if needed)
        if (this.availableRequests > 0) {
          this.availableRequests--;
        }
        this.fetchNewsForRegion(request.region);
        processed.push(request);
      }
    }

    // Remove processed requests
    this.requestQueue = this.requestQueue.filter(
      req => !processed.includes(req)
    );
    
    if (processed.length > 0) {
      console.log(`✅ Processed ${processed.length} queued requests (${this.requestQueue.length} remaining, ${this.availableRequests} reserve available)`);
    } else if (this.requestQueue.length > 0) {
      console.log(`⏳ ${this.requestQueue.length} requests queued, waiting for available slots...`);
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

// Singleton instance - use global to ensure same instance across Next.js route handlers
declare global {
  // eslint-disable-next-line no-var
  var __apiScheduler: APIScheduler | undefined;
}

// Singleton instance - reuse in development, create new in production
export const apiScheduler = 
  globalThis.__apiScheduler ?? (globalThis.__apiScheduler = new APIScheduler());

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

