/**
 * Cache Module
 * Handles file-based caching for persistence across processes
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
 *   ✅ Efficient for lookups
 * 
 * Storage:
 *   ✅ File-based (cache/cache-data.json)
 *   ✅ Persistent across process restarts
 *   ✅ Can be cleared by --clear-cache command
 */

const fs = require('fs');
const path = require('path');
const { recordHit, recordMiss } = require('./analytics');

// Cache file path
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'cache-data.json');

// Default cache TTL (Time To Live) in milliseconds
// 5 minutes = 5 * 60 * 1000 = 300000ms
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

// Cache size limits (default values, can be overridden by config)
let MAX_CACHE_ENTRIES = 1000; // Maximum number of cache entries
let MAX_CACHE_SIZE_MB = 100;   // Maximum cache size in MB

// Pattern-based TTL configuration
// Format: { "/pattern/*": ttlInSeconds, ... }
let PATTERN_TTL_CONFIG = {};

/**
 * Configure cache limits
 * @param {Object} options - Configuration options
 * @param {number} options.maxEntries - Maximum number of entries
 * @param {number} options.maxSizeMB - Maximum size in MB
 */
function configureCacheLimits(options = {}) {
  if (options.maxEntries !== undefined) {
    MAX_CACHE_ENTRIES = options.maxEntries;
  }
  if (options.maxSizeMB !== undefined) {
    MAX_CACHE_SIZE_MB = options.maxSizeMB;
  }
}

/**
 * Configure pattern-based TTL
 * @param {Object} patterns - Pattern to TTL mapping
 * @example
 * configurePatternTTL({
 *   "/products/*": 600,      // 10 minutes
 *   "/users/*": 60,          // 1 minute
 *   "/static/*": 3600        // 1 hour
 * })
 */
function configurePatternTTL(patterns = {}) {
  PATTERN_TTL_CONFIG = { ...patterns };
  console.log(`🕒 Configured ${Object.keys(PATTERN_TTL_CONFIG).length} pattern-based TTL rules`);
}

/**
 * Match a URL path against a pattern with wildcards
 * Supports * (matches any characters) and ** (matches any path segments)
 * @param {string} pattern - Pattern with wildcards (e.g., "/products/*", "/api/**")
 * @param {string} urlPath - URL path to match (e.g., "/products/123", "/api/v1/users")
 * @returns {boolean} - True if URL matches the pattern
 * 
 * Examples:
 *   matchPattern("/products/*", "/products/123") => true
 *   matchPattern("/products/*", "/products/123/reviews") => false
 *   matchPattern("/products/**", "/products/123/reviews") => true
 *   matchPattern("/api/v1/*", "/api/v1/users") => true
 *   matchPattern("/static/*", "/products/1") => false
 */
function matchPattern(pattern, urlPath) {
  // Replace ** with a placeholder before escaping
  const doubleStar = '___DOUBLESTAR___';
  const singleStar = '___SINGLESTAR___';
  
  // Replace wildcards with placeholders
  let regexPattern = pattern
    .replace(/\*\*/g, doubleStar)  // Replace ** first
    .replace(/\*/g, singleStar);    // Then replace remaining *
  
  // Escape special regex characters
  regexPattern = regexPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  
  // Replace placeholders with regex patterns
  regexPattern = regexPattern
    .replace(new RegExp(doubleStar, 'g'), '.*')   // ** -> .* (match anything)
    .replace(new RegExp(singleStar, 'g'), '[^/]*'); // * -> [^/]* (match anything except /)
  
  // Anchor the pattern to match the entire path
  regexPattern = `^${regexPattern}$`;
  
  const regex = new RegExp(regexPattern);
  return regex.test(urlPath);
}

/**
 * Extract TTL from Cache-Control header's max-age directive
 * @param {string} cacheControl - Cache-Control header value
 * @returns {number|null} - TTL in milliseconds, or null if max-age not found
 * 
 * Examples:
 *   extractTTLFromCacheControl("max-age=3600") => 3600000 (1 hour)
 *   extractTTLFromCacheControl("public, max-age=600") => 600000 (10 minutes)
 *   extractTTLFromCacheControl("no-cache") => null
 *   extractTTLFromCacheControl("max-age=0") => 0
 *   extractTTLFromCacheControl(null) => null
 */
function extractTTLFromCacheControl(cacheControl) {
  if (!cacheControl) {
    return null;
  }
  
  // Cache-Control can have multiple directives separated by commas
  // Example: "public, max-age=3600, must-revalidate"
  const directives = cacheControl.toLowerCase().split(',').map(d => d.trim());
  
  // Look for max-age directive
  for (const directive of directives) {
    // Match "max-age=<number>"
    const match = directive.match(/^max-age=(\d+)$/);
    if (match) {
      const seconds = parseInt(match[1], 10);
      // Convert seconds to milliseconds
      return seconds * 1000;
    }
  }
  
  // max-age not found
  return null;
}

/**
 * Get TTL for a given URL based on configured patterns
 * @param {string} url - Full URL (e.g., "https://api.com/products/123?page=1")
 * @returns {number} - TTL in milliseconds
 * 
 * Priority:
 * 1. First matching pattern from PATTERN_TTL_CONFIG
 * 2. DEFAULT_CACHE_TTL if no pattern matches
 * 
 * Examples:
 *   getTTLForURL("https://api.com/products/123") 
 *     => 600000 if "/products/*" is configured for 600 seconds
 *   getTTLForURL("https://api.com/unknown")
 *     => 300000 (DEFAULT_CACHE_TTL)
 */
function getTTLForURL(url) {
  try {
    // Extract path from URL (without query parameters)
    const urlObj = new URL(url);
    const urlPath = urlObj.pathname;
    
    // Check all configured patterns
    for (const [pattern, ttlSeconds] of Object.entries(PATTERN_TTL_CONFIG)) {
      if (matchPattern(pattern, urlPath)) {
        // Convert seconds to milliseconds
        const ttlMs = ttlSeconds * 1000;
        return ttlMs;
      }
    }
    
    // No pattern matched, return default TTL
    return DEFAULT_CACHE_TTL;
  } catch (error) {
    // If URL parsing fails, return default TTL
    return DEFAULT_CACHE_TTL;
  }
}

/**
 * Determine TTL for a cache entry based on priority order
 * Priority: Cache-Control max-age > Custom Pattern Config > Default TTL
 * 
 * @param {string} url - Full URL
 * @param {string} cacheControl - Cache-Control header value from origin
 * @returns {number} - TTL in milliseconds
 * 
 * Priority Order:
 * 1. Cache-Control max-age (if present and valid)
 * 2. Custom pattern-based TTL (if URL matches a pattern)
 * 3. Default TTL (fallback)
 * 
 * Examples:
 *   // Cache-Control has priority
 *   determineTTL("https://api.com/products/1", "max-age=7200")
 *     => 7200000 (2 hours from Cache-Control)
 *   
 *   // Pattern config used when no max-age
 *   determineTTL("https://api.com/products/1", "public")
 *     => 600000 (10 minutes if /products/* configured for 600s)
 *   
 *   // Default used when no max-age and no pattern match
 *   determineTTL("https://api.com/unknown", null)
 *     => 300000 (5 minutes default)
 */
function determineTTL(url, cacheControl) {
  // Priority 1: Check Cache-Control max-age
  const maxAgeTTL = extractTTLFromCacheControl(cacheControl);
  if (maxAgeTTL !== null) {
    return maxAgeTTL;
  }
  
  // Priority 2: Check custom pattern-based TTL
  const patternTTL = getTTLForURL(url);
  return patternTTL;
  
  // Priority 3 is handled inside getTTLForURL() which returns DEFAULT_CACHE_TTL if no pattern matches
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load cache from file
 * @returns {Map} - Cache map
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const obj = JSON.parse(data);
      return new Map(Object.entries(obj));
    }
  } catch (error) {
    console.error('Error loading cache:', error.message);
  }
  return new Map();
}

/**
 * Save cache to file
 * @param {Map} cache - Cache map to save
 */
function saveCache(cache) {
  try {
    ensureCacheDir();
    const obj = Object.fromEntries(cache);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving cache:', error.message);
  }
}

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
function getCachedResponse(method, url, startTime = Date.now(), requestId = null) {
  const key = generateCacheKey(method, url);
  const cache = loadCache();
  const cached = cache.get(key);
  
  if (cached) {
    // Check if cache entry has expired
    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      console.log(`⏱️  Cache EXPIRED: ${key}`);
      // Remove expired entry
      cache.delete(key);
      saveCache(cache);
      const responseTime = Date.now() - startTime;
      recordMiss(key, responseTime); // Record as miss since expired
      return null;
    }
    const responseTime = Date.now() - startTime;
    console.log(`✨ Cache HIT: ${key}`);
    
    // Update last access time for LRU tracking
    cached.lastAccessTime = Date.now();
    cache.set(key, cached);
    saveCache(cache);
    
    // Calculate data size from cached body
    const dataSize = cached.body ? Buffer.byteLength(cached.body, 'utf8') : 0;
    recordHit(key, responseTime, dataSize); // Record cache hit with timing and size
    
    // Log cache event with request ID
    const logger = require('./logger');
    logger.logCache({
      status: 'HIT',
      key,
      size: dataSize,
      requestId
    });
    
    return cached;
  } else {
    const responseTime = Date.now() - startTime;
    console.log(`❌ Cache MISS: ${key}`);
    recordMiss(key, responseTime); // Record cache miss with timing
    
    // Log cache event with request ID
    const logger = require('./logger');
    logger.logCache({
      status: 'MISS',
      key,
      requestId
    });
    
    return null;
  }
}

/**
 * Calculate cache size in bytes
 * @param {Map} cache - Cache map
 * @returns {number} - Total size in bytes
 */
function calculateCacheSize(cache) {
  let totalSize = 0;
  for (const [key, entry] of cache.entries()) {
    // Calculate size of the entire entry (key + body + headers + metadata)
    const keySize = Buffer.byteLength(key, 'utf8');
    const bodySize = entry.body ? Buffer.byteLength(entry.body, 'utf8') : 0;
    const headersSize = Buffer.byteLength(JSON.stringify(entry.headers || {}), 'utf8');
    totalSize += keySize + bodySize + headersSize;
  }
  return totalSize;
}

/**
 * Evict least recently used entries to stay within limits
 * @param {Map} cache - Cache map
 * @returns {number} - Number of entries evicted
 */
function evictLRU(cache) {
  let evictedCount = 0;
  
  // Check if we need to evict based on entry count
  const exceedsEntryLimit = cache.size > MAX_CACHE_ENTRIES;
  
  // Check if we need to evict based on size
  const currentSizeBytes = calculateCacheSize(cache);
  const currentSizeMB = currentSizeBytes / (1024 * 1024);
  const exceedsSizeLimit = currentSizeMB > MAX_CACHE_SIZE_MB;
  
  if (!exceedsEntryLimit && !exceedsSizeLimit) {
    return 0; // No eviction needed
  }
  
  // Sort entries by lastAccessTime (oldest first)
  const entries = Array.from(cache.entries());
  entries.sort((a, b) => {
    const timeA = a[1].lastAccessTime || a[1].cachedAt || 0;
    const timeB = b[1].lastAccessTime || b[1].cachedAt || 0;
    return timeA - timeB; // Ascending order (oldest first)
  });
  
  // Evict entries until we're under both limits
  // Keep evicting until we're at 90% of limits to avoid constant eviction
  const targetEntries = Math.floor(MAX_CACHE_ENTRIES * 0.9);
  const targetSizeMB = MAX_CACHE_SIZE_MB * 0.9;
  
  for (const [key, entry] of entries) {
    // Check if we're now under limits
    const currentSize = calculateCacheSize(cache);
    const currentSizeMB = currentSize / (1024 * 1024);
    
    if (cache.size <= targetEntries && currentSizeMB <= targetSizeMB) {
      break; // We're under both limits
    }
    
    // Evict this entry
    cache.delete(key);
    evictedCount++;
    
    // Log eviction
    const logger = require('./logger');
    logger.logCache({
      status: 'EVICTED',
      key,
      reason: 'LRU',
      requestId: null
    });
  }
  
  if (evictedCount > 0) {
    const newSize = calculateCacheSize(cache);
    const newSizeMB = (newSize / (1024 * 1024)).toFixed(2);
    console.log(`🗑️  LRU Eviction: Removed ${evictedCount} entries (Cache: ${cache.size} entries, ${newSizeMB} MB)`);
  }
  
  return evictedCount;
}

/**
 * Check if response should be cached based on Cache-Control header
 * @param {string} cacheControl - Cache-Control header value
 * @returns {boolean} - True if cacheable, false otherwise
 */
function isCacheable(cacheControl) {
  if (!cacheControl) return true; // No Cache-Control = cacheable
  
  const lowerCaseControl = cacheControl.toLowerCase();
  
  // Don't cache if any of these directives are present
  const noCacheDirectives = ['no-store', 'no-cache', 'private'];
  for (const directive of noCacheDirectives) {
    if (lowerCaseControl.includes(directive)) {
      return false;
    }
  }
  
  return true; // Cacheable (includes max-age, public, etc.)
}

/**
 * Store a response in cache (only if it's a successful response)
 * @param {string} method - HTTP method
 * @param {string} url - Complete URL
 * @param {Object} responseData - Response data to cache
 * @param {number} responseData.statusCode - HTTP status code (e.g., 200, 404)
 * @param {Object} responseData.headers - Response headers object (all headers from origin)
 * @param {string} responseData.body - Response body as string (complete body content)
 * @param {boolean} hasAuth - Whether request has authentication (Authorization header or cookies)
 * @param {string} cacheControl - Cache-Control header from origin server
 * @returns {boolean} - True if response was cached, false if not
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
 *   ✅ CACHED: GET requests with 2xx responses, no authentication, respects Cache-Control
 *   ❌ NOT CACHED: Non-GET methods (POST, PUT, DELETE, PATCH)
 *   ❌ NOT CACHED: Authenticated requests (Authorization header or cookies)
 *   ❌ NOT CACHED: Cache-Control: no-store, no-cache, or private
 *   ❌ NOT CACHED: 3xx redirects (301, 302, 307, etc.)
 *   ❌ NOT CACHED: 4xx client errors (404, 400, 401, etc.)
 *   ❌ NOT CACHED: 5xx server errors (500, 502, 503, etc.)
 */
function setCachedResponse(method, url, responseData, hasAuth = false, cacheControl = null, requestId = null) {
  // Only cache GET requests (standard HTTP caching practice)
  if (method.toUpperCase() !== 'GET') {
    console.log(`⏭️  NOT cached (method ${method}): ${method}:${url}`);
    return false;
  }
  
  // Don't cache authenticated requests (security best practice)
  if (hasAuth) {
    console.log(`⏭️  NOT cached (authenticated request): ${method}:${url}`);
    return false;
  }
  
  // Respect Cache-Control header from origin server
  if (!isCacheable(cacheControl)) {
    console.log(`⏭️  NOT cached (Cache-Control: ${cacheControl}): ${method}:${url}`);
    return false;
  }
  
  // Only cache successful responses (2xx status codes)
  if (!shouldCacheResponse(responseData.statusCode)) {
    console.log(`⏭️  NOT cached (status ${responseData.statusCode}): ${method}:${url}`);
    return false;
  }
  
  const key = generateCacheKey(method, url);
  const cache = loadCache();
  
  // Determine TTL based on priority: Cache-Control > Custom Config > Default
  const ttl = determineTTL(url, cacheControl);
  
  // Add expiration timestamp and access time to cache entry
  const now = Date.now();
  const cacheEntry = {
    ...responseData,
    cachedAt: now,
    expiresAt: now + ttl,
    lastAccessTime: now // Track for LRU eviction
  };
  
  cache.set(key, cacheEntry);
  
  // Evict LRU entries if cache exceeds limits
  const evictedCount = evictLRU(cache);
  
  // Save cache after eviction
  saveCache(cache);
  
  const ttlSeconds = Math.floor(ttl / 1000);
  const ttlMinutes = Math.floor(ttl / 60000);
  const cacheSize = calculateCacheSize(cache);
  const cacheSizeMB = (cacheSize / (1024 * 1024)).toFixed(2);
  
  // Display TTL in appropriate units
  const ttlDisplay = ttlMinutes > 0 ? `${ttlMinutes}min` : `${ttlSeconds}s`;
  
  if (evictedCount > 0) {
    console.log(`💾 Cached: ${key} (TTL: ${ttlDisplay}, ${cache.size} entries, ${cacheSizeMB} MB) [Evicted ${evictedCount}]`);
  } else {
    console.log(`💾 Cached: ${key} (TTL: ${ttlDisplay}, ${cache.size} entries, ${cacheSizeMB} MB)`);
  }
  
  // Log performance metric
  const logger = require('./logger');
  const dataSize = responseData.body ? Buffer.byteLength(responseData.body, 'utf8') : 0;
  logger.logPerformance({
    operation: 'cache-store',
    duration: 0,
    url,
    meta: { size: dataSize, entries: cache.size, evicted: evictedCount },
    requestId
  });
  
  return true;
}

/**
 * Clear all cached responses
 * @returns {number} - Number of entries cleared
 */
function clearCache() {
  const cache = loadCache();
  const size = cache.size;
  
  // Delete the cache file
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  } catch (error) {
    console.error('Error deleting cache file:', error.message);
  }
  
  return size;
}

/**
 * Clear cache entries matching a pattern
 * @param {string} pattern - Pattern with wildcards (e.g., "/products/*", "/api/**")
 * @returns {Object} - { cleared: number, keys: Array<string> }
 */
function clearCacheByPattern(pattern) {
  const cache = loadCache();
  const keysToRemove = [];
  
  // Iterate through cache entries
  for (const [key, value] of cache.entries()) {
    // Key format is "METHOD:URL"
    // Extract URL from the key
    const colonIndex = key.indexOf(':');
    if (colonIndex === -1) continue;
    
    const url = key.substring(colonIndex + 1);
    
    try {
      // Extract path from URL
      const urlObj = new URL(url);
      const urlPath = urlObj.pathname;
      
      // Check if URL matches the pattern
      if (matchPattern(pattern, urlPath)) {
        keysToRemove.push(key);
      }
    } catch (error) {
      // Skip entries with invalid URLs
      continue;
    }
  }
  
  // Remove matched entries
  keysToRemove.forEach(key => cache.delete(key));
  
  // Save cache
  if (keysToRemove.length > 0) {
    saveCache(cache);
  }
  
  return {
    cleared: keysToRemove.length,
    keys: keysToRemove
  };
}

/**
 * Clear cache entry for a specific URL
 * @param {string} url - Exact URL to clear (e.g., "https://api.com/products/123")
 * @param {string} method - HTTP method (default: "GET")
 * @returns {Object} - { cleared: boolean, key: string|null }
 */
function clearCacheByURL(url, method = 'GET') {
  const cache = loadCache();
  const key = generateCacheKey(method, url);
  
  // Check if the key exists
  if (cache.has(key)) {
    cache.delete(key);
    saveCache(cache);
    
    return {
      cleared: true,
      key: key
    };
  }
  
  return {
    cleared: false,
    key: null
  };
}

/**
 * Get cache statistics (and clean up expired entries)
 * @returns {Object} - Cache stats (size, keys, expired count)
 */
function getCacheStats() {
  const cache = loadCache();
  let expiredCount = 0;
  const now = Date.now();
  
  // Remove expired entries
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt && now > value.expiresAt) {
      cache.delete(key);
      expiredCount++;
    }
  }
  
  // Save cache if we removed any expired entries
  if (expiredCount > 0) {
    saveCache(cache);
  }
  
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    expiredRemoved: expiredCount
  };
}

module.exports = {
  generateCacheKey,
  getCachedResponse,
  setCachedResponse,
  clearCache,
  clearCacheByPattern,
  clearCacheByURL,
  getCacheStats,
  shouldCacheResponse,
  configureCacheLimits,
  configurePatternTTL,
  matchPattern,
  getTTLForURL,
  extractTTLFromCacheControl,
  determineTTL,
  calculateCacheSize
};

