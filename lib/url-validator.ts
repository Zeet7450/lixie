/**
 * URL Validator - Check if URLs are accessible and return valid content
 */

/**
 * Check if a URL is accessible and returns valid content
 * Returns true if URL is accessible (status 200-299), false otherwise
 * More lenient: Accepts redirects and various success status codes
 */
export async function isUrlAccessible(url: string, timeout: number = 15000): Promise<boolean> {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return false;
  }

  // Try multiple methods with different configurations
  // First try GET with full headers (most compatible)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow', // Follow redirects (301, 302, etc.)
    });

    clearTimeout(timeoutId);

    // Accept status codes: 200-299 (success), 300-399 (redirects - already followed)
    // Some sites return 403 (forbidden) but page exists, so we'll be lenient
    const isAccessible = response.status >= 200 && response.status < 400;
    
    if (isAccessible) {
      return true; // URL is accessible
    }
    
    // If status is 403, 429, or 503, the page might exist but be temporarily blocked
    // We'll accept these as "accessible" since the URL structure is likely correct
    if (response.status === 403 || response.status === 429 || response.status === 503) {
      console.warn(`⚠️ URL returned ${response.status} (may be rate-limited or blocked, but URL structure is valid): ${url}`);
      return true; // Accept as accessible (URL is valid, just blocked)
    }
    
    if (response.status === 404) {
      console.warn(`⚠️ URL not accessible: ${url} (status: 404 - page not found)`);
      return false; // 404 means page doesn't exist
    }
    
    console.warn(`⚠️ URL returned unexpected status: ${url} (status: ${response.status})`);
    return false;
  } catch (error: any) {
    // If GET fails, try HEAD as fallback
    if (error.name === 'AbortError') {
      console.warn(`⚠️ URL validation timeout (GET): ${url}`);
    } else {
      console.warn(`⚠️ URL validation error (GET): ${url}`, error?.message || error);
    }
    
    // Try HEAD as fallback
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);
      const isAccessible = response.status >= 200 && response.status < 400;
      
      if (isAccessible || response.status === 403 || response.status === 429 || response.status === 503) {
        return true; // Accept as accessible
      }
      
      return false;
    } catch (retryError: any) {
      console.warn(`❌ URL validation failed with all methods: ${url}`, retryError?.message || retryError);
      return false;
    }
  }
}

/**
 * Validate multiple URLs in parallel (with concurrency limit)
 */
export async function validateUrls(urls: string[], concurrency: number = 3): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const urlQueue = [...urls];
  
  // Process URLs in batches
  while (urlQueue.length > 0) {
    const batch = urlQueue.splice(0, concurrency);
    const batchPromises = batch.map(async (url) => {
      const isValid = await isUrlAccessible(url);
      return { url, isValid };
    });
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ url, isValid }) => {
      results.set(url, isValid);
    });
  }
  
  return results;
}

