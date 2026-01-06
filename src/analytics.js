/**
 * Analytics Module
 * Tracks cache performance metrics and statistics
 */

const fs = require('fs');
const path = require('path');

// Analytics file path
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const ANALYTICS_FILE = path.join(CACHE_DIR, 'analytics.json');

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load analytics from file
 * @returns {Object} - Analytics data
 */
function loadAnalytics() {
  try {
    ensureCacheDir();
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = fs.readFileSync(ANALYTICS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading analytics:', error.message);
  }
  
  // Return default analytics structure
  return {
    totalHits: 0,
    totalMisses: 0,
    urlStats: {}, // { url: { hits: 0, misses: 0, lastAccess: timestamp } }
    performance: {
      hitResponseTimes: [],    // Array of response times for cache hits (in ms)
      missResponseTimes: [],   // Array of response times for cache misses (in ms)
      totalHitTime: 0,         // Sum of all hit response times
      totalMissTime: 0,        // Sum of all miss response times
      bandwidthSaved: 0        // Bytes saved from cache hits
    },
    compression: {
      totalOriginalBytes: 0,   // Total original size before compression
      totalCompressedBytes: 0, // Total size after compression
      entriesCompressed: 0,    // Number of entries compressed
      gzipCount: 0,           // Number of entries using gzip
      brotliCount: 0,         // Number of entries using brotli
      noneCount: 0            // Number of entries with no compression
    },
    startTime: Date.now()
  };
}

/**
 * Save analytics to file
 * @param {Object} analytics - Analytics data to save
 */
function saveAnalytics(analytics) {
  try {
    ensureCacheDir();
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving analytics:', error.message);
  }
}

/**
 * Record a cache hit
 * @param {string} url - The URL that was hit
 * @param {number} responseTime - Response time in milliseconds
 * @param {number} dataSize - Size of response data in bytes
 */
function recordHit(url, responseTime = 0, dataSize = 0) {
  const analytics = loadAnalytics();
  analytics.totalHits++;
  
  if (!analytics.urlStats[url]) {
    analytics.urlStats[url] = { hits: 0, misses: 0, lastAccess: Date.now() };
  }
  
  analytics.urlStats[url].hits++;
  analytics.urlStats[url].lastAccess = Date.now();
  
  // Initialize performance object if it doesn't exist
  if (!analytics.performance) {
    analytics.performance = {
      hitResponseTimes: [],
      missResponseTimes: [],
      totalHitTime: 0,
      totalMissTime: 0,
      bandwidthSaved: 0
    };
  }
  
  // Record performance metrics
  if (responseTime > 0) {
    analytics.performance.hitResponseTimes.push(responseTime);
    analytics.performance.totalHitTime += responseTime;
  }
  
  if (dataSize > 0) {
    analytics.performance.bandwidthSaved += dataSize;
  }
  
  saveAnalytics(analytics);
}

/**
 * Record a cache miss
 * @param {string} url - The URL that was missed
 * @param {number} responseTime - Response time in milliseconds
 */
function recordMiss(url, responseTime = 0) {
  const analytics = loadAnalytics();
  analytics.totalMisses++;
  
  if (!analytics.urlStats[url]) {
    analytics.urlStats[url] = { hits: 0, misses: 0, lastAccess: Date.now() };
  }
  
  analytics.urlStats[url].misses++;
  analytics.urlStats[url].lastAccess = Date.now();
  
  // Initialize performance object if it doesn't exist
  if (!analytics.performance) {
    analytics.performance = {
      hitResponseTimes: [],
      missResponseTimes: [],
      totalHitTime: 0,
      totalMissTime: 0,
      bandwidthSaved: 0
    };
  }
  
  // Record performance metrics
  if (responseTime > 0) {
    analytics.performance.missResponseTimes.push(responseTime);
    analytics.performance.totalMissTime += responseTime;
  }
  
  saveAnalytics(analytics);
}

/**
 * Get cache statistics
 * @returns {Object} - Formatted statistics
 */
function getStats() {
  const analytics = loadAnalytics();
  const totalRequests = analytics.totalHits + analytics.totalMisses;
  const hitRate = totalRequests > 0 ? (analytics.totalHits / totalRequests * 100).toFixed(2) : 0;
  const missRate = totalRequests > 0 ? (analytics.totalMisses / totalRequests * 100).toFixed(2) : 0;
  
  // Calculate uptime
  const uptimeMs = Date.now() - analytics.startTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);
  
  let uptimeStr;
  if (uptimeDays > 0) {
    uptimeStr = `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m`;
  } else if (uptimeHours > 0) {
    uptimeStr = `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`;
  } else if (uptimeMinutes > 0) {
    uptimeStr = `${uptimeMinutes}m ${uptimeSeconds % 60}s`;
  } else {
    uptimeStr = `${uptimeSeconds}s`;
  }
  
  // Get top 10 most accessed URLs
  const urlEntries = Object.entries(analytics.urlStats).map(([url, stats]) => ({
    url,
    hits: stats.hits,
    misses: stats.misses,
    total: stats.hits + stats.misses,
    hitRate: stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) : 0
  }));
  
  // Sort by total accesses (hits + misses)
  const topUrls = urlEntries
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  
  // Calculate performance metrics
  const performance = analytics.performance || {
    hitResponseTimes: [],
    missResponseTimes: [],
    totalHitTime: 0,
    totalMissTime: 0,
    bandwidthSaved: 0
  };
  
  const avgHitTime = performance.hitResponseTimes.length > 0
    ? (performance.totalHitTime / performance.hitResponseTimes.length).toFixed(2)
    : 0;
  
  const avgMissTime = performance.missResponseTimes.length > 0
    ? (performance.totalMissTime / performance.missResponseTimes.length).toFixed(2)
    : 0;
  
  // Format bandwidth saved
  let bandwidthSavedStr;
  const bytes = performance.bandwidthSaved;
  if (bytes > 1024 * 1024 * 1024) {
    bandwidthSavedStr = `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (bytes > 1024 * 1024) {
    bandwidthSavedStr = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (bytes > 1024) {
    bandwidthSavedStr = `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    bandwidthSavedStr = `${bytes} bytes`;
  }
  
  // Calculate compression statistics
  const compression = analytics.compression || {
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
    entriesCompressed: 0,
    gzipCount: 0,
    brotliCount: 0,
    noneCount: 0
  };
  
  const compressionRatio = compression.totalOriginalBytes > 0
    ? ((1 - compression.totalCompressedBytes / compression.totalOriginalBytes) * 100).toFixed(2)
    : 0;
  
  const totalEntries = compression.gzipCount + compression.brotliCount + compression.noneCount;
  
  return {
    totalHits: analytics.totalHits,
    totalMisses: analytics.totalMisses,
    totalRequests,
    hitRate: parseFloat(hitRate),
    missRate: parseFloat(missRate),
    uptime: uptimeStr,
    uptimeMs,
    topUrls,
    performance: {
      avgHitTime: parseFloat(avgHitTime),
      avgMissTime: parseFloat(avgMissTime),
      bandwidthSaved: bytes,
      bandwidthSavedStr,
      hitCount: performance.hitResponseTimes.length,
      missCount: performance.missResponseTimes.length
    },
    compression: {
      totalOriginalBytes: compression.totalOriginalBytes,
      totalCompressedBytes: compression.totalCompressedBytes,
      spaceSaved: compression.totalOriginalBytes - compression.totalCompressedBytes,
      compressionRatio: parseFloat(compressionRatio),
      entriesCompressed: compression.entriesCompressed,
      totalEntries,
      methodBreakdown: {
        gzip: compression.gzipCount,
        brotli: compression.brotliCount,
        none: compression.noneCount
      }
    }
  };
}

/**
 * Reset analytics
 */
function resetAnalytics() {
  const analytics = {
    totalHits: 0,
    totalMisses: 0,
    urlStats: {},
    startTime: Date.now()
  };
  saveAnalytics(analytics);
}

/**
 * Record compression statistics
 * @param {number} originalSize - Original size in bytes
 * @param {number} compressedSize - Compressed size in bytes
 * @param {string} method - Compression method: 'gzip', 'brotli', or 'none'
 */
function recordCompression(originalSize, compressedSize, method = 'none') {
  const analytics = loadAnalytics();
  
  // Initialize compression object if it doesn't exist
  if (!analytics.compression) {
    analytics.compression = {
      totalOriginalBytes: 0,
      totalCompressedBytes: 0,
      entriesCompressed: 0,
      gzipCount: 0,
      brotliCount: 0,
      noneCount: 0
    };
  }
  
  // Update compression statistics
  analytics.compression.totalOriginalBytes += originalSize;
  analytics.compression.totalCompressedBytes += compressedSize;
  
  if (method !== 'none') {
    analytics.compression.entriesCompressed++;
  }
  
  // Update method counts
  if (method === 'gzip') {
    analytics.compression.gzipCount++;
  } else if (method === 'brotli') {
    analytics.compression.brotliCount++;
  } else {
    analytics.compression.noneCount++;
  }
  
  saveAnalytics(analytics);
}

module.exports = {
  recordHit,
  recordMiss,
  recordCompression,
  getStats,
  resetAnalytics
};

