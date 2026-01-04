/**
 * Cache Module
 * Handles in-memory caching using JavaScript Map
 * 
 * Cache Key Strategy:
 * -------------------
 * Format: METHOD:URL
 * 
 * The cache key uniquely identifies each request by combining:
 * 1. HTTP Method (GET, POST, PUT, etc.) - normalized to uppercase
 * 2. Complete URL including query parameters
 * 
 * Example Cache Keys:
 *   GET:https://dummyjson.com/products/1
 *   GET:https://dummyjson.com/products?limit=10&skip=5
 *   POST:https://dummyjson.com/products/add
 * 
 * Why this strategy?
 *   ✅ Simple and readable
 *   ✅ Unique for each request (method + URL + query params)
 *   ✅ Query parameters automatically included in URL
 *   ✅ Different methods cached separately (GET vs POST)
 *   ✅ Efficient for JavaScript Map lookups
 */

// In-memory cache storage
const cache = new Map();

/**
 * Generate a unique cache key based on request details
 * Format: METHOD:URL (including query parameters)
 * 
 * Examples:
 *   GET:https://dummyjson.com/products/1
 *   GET:https://dummyjson.com/products?limit=10&skip=5
 *   POST:https://dummyjson.com/products/add
 * 
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} url - Complete URL including query parameters
 * @returns {string} - Unique cache key
 */
function generateCacheKey(method, url) {
  // Normalize method to uppercase for consistency
  const normalizedMethod = method.toUpperCase();
  
  // Cache key format: METHOD:URL
  // URL already includes query parameters, so they're automatically part of the key
  const cacheKey = `${normalizedMethod}:${url}`;
  
  return cacheKey;
}

/**
 * Get cached response for a given request
 * @param {string} method - HTTP method
 * @param {string} url - Complete URL
 * @returns {Object|null} - Cached response object or null if not found
 * 
 * Returns null if cache miss, otherwise returns:
 * {
 *   statusCode: number,
 *   headers: Object,
 *   body: string
 * }
 */
function getCachedResponse(method, url) {
  const key = generateCacheKey(method, url);
  const cached = cache.get(key);
  
  if (cached) {
    console.log(`✨ Cache HIT: ${key}`);
  } else {
    console.log(`❌ Cache MISS: ${key}`);
  }
  
  return cached || null;
}

/**
 * Store a response in cache
 * @param {string} method - HTTP method
 * @param {string} url - Complete URL
 * @param {Object} responseData - Response data to cache
 * @param {number} responseData.statusCode - HTTP status code (e.g., 200, 404)
 * @param {Object} responseData.headers - Response headers object (all headers from origin)
 * @param {string} responseData.body - Response body as string (complete body content)
 * 
 * Example responseData structure:
 * {
 *   statusCode: 200,                           // Any HTTP status (2xx, 3xx, 4xx, 5xx)
 *   headers: {                                 // ALL headers from origin server
 *     'content-type': 'application/json',
 *     'cache-control': 'max-age=3600',
 *     'etag': 'W/"abc123"',
 *     'server': 'cloudflare',
 *     'x-ratelimit-limit': '100',
 *     // ... all other headers
 *   },
 *   body: '{"id":1,"title":"Product",...}'    // Complete response body
 * }
 * 
 * What gets cached:
 *   ✅ Status Code: Exact HTTP status code from origin
 *   ✅ Headers: ALL response headers (standard, security, CORS, custom)
 *   ✅ Body: Complete response body content (JSON, HTML, text, binary)
 */
function setCachedResponse(method, url, responseData) {
  const key = generateCacheKey(method, url);
  cache.set(key, responseData);
  console.log(`💾 Cached: ${key} (${cache.size} total entries)`);
}

/**
 * Clear all cached responses
 * @returns {number} - Number of entries cleared
 */
function clearCache() {
  const size = cache.size;
  cache.clear();
  return size;
}

/**
 * Get cache statistics
 * @returns {Object} - Cache stats (size, keys)
 */
function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

module.exports = {
  generateCacheKey,
  getCachedResponse,
  setCachedResponse,
  clearCache,
  getCacheStats
};

