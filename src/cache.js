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
 * Check if a status code indicates a successful response that should be cached
 * @param {number} statusCode - HTTP status code
 * @returns {boolean} - True if status code is in the 2xx range (successful)
 */
function shouldCacheResponse(statusCode) {
  // Cache only successful responses (2xx status codes)
  // 200 OK, 201 Created, 202 Accepted, 203 Non-Authoritative, 204 No Content, etc.
  return statusCode >= 200 && statusCode < 300;
}

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
 * Store a response in cache (only if it's a successful response)
 * @param {string} method - HTTP method
 * @param {string} url - Complete URL
 * @param {Object} responseData - Response data to cache
 * @param {number} responseData.statusCode - HTTP status code (e.g., 200, 404)
 * @param {Object} responseData.headers - Response headers object (all headers from origin)
 * @param {string} responseData.body - Response body as string (complete body content)
 * @returns {boolean} - True if response was cached, false if not (due to non-2xx status)
 * 
 * Example responseData structure:
 * {
 *   statusCode: 200,                           // Only 2xx status codes will be cached
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
 * Caching Strategy:
 *   ✅ CACHED: 2xx responses (200, 201, 202, 203, 204, etc.)
 *   ❌ NOT CACHED: 3xx redirects (301, 302, 307, etc.)
 *   ❌ NOT CACHED: 4xx client errors (404, 400, 401, etc.)
 *   ❌ NOT CACHED: 5xx server errors (500, 502, 503, etc.)
 */
function setCachedResponse(method, url, responseData) {
  // Only cache successful responses (2xx status codes)
  if (!shouldCacheResponse(responseData.statusCode)) {
    console.log(`⏭️  NOT cached (status ${responseData.statusCode}): ${method}:${url}`);
    return false;
  }
  
  const key = generateCacheKey(method, url);
  cache.set(key, responseData);
  console.log(`💾 Cached: ${key} (${cache.size} total entries)`);
  return true;
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
  getCacheStats,
  shouldCacheResponse
};

