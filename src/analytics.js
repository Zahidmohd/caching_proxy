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
    totalRevalidations: 0,     // Number of 304 Not Modified responses
    urlStats: {}, // { url: { hits: 0, misses: 0, revalidations: 0, lastAccess: timestamp } }
    performance: {
      hitResponseTimes: [],    // Array of response times for cache hits (in ms)
      missResponseTimes: [],   // Array of response times for cache misses (in ms)
      revalidationResponseTimes: [], // Array of response times for 304 revalidations (in ms)
      totalHitTime: 0,         // Sum of all hit response times
      totalMissTime: 0,        // Sum of all miss response times
      totalRevalidationTime: 0, // Sum of all revalidation response times
      bandwidthSaved: 0        // Bytes saved from cache hits
    },
    bandwidth: {
      totalBytesFromOrigin: 0,    // Total bytes downloaded from origin
      totalBytesServed: 0,        // Total bytes served to clients
      bytesSavedBy304: 0,         // Bytes saved through 304 responses
      totalBytesSaved: 0,         // Total bandwidth saved (hits + 304s)
      revalidationCount: 0        // Number of successful revalidations
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
 * Record a cache revalidation (304 Not Modified)
 * @param {string} url - The URL that was revalidated
 * @param {number} responseTime - Response time in milliseconds
 * @param {number} bytesSaved - Bytes saved by not re-downloading
 */
function recordRevalidation(url, responseTime = 0, bytesSaved = 0) {
  const analytics = loadAnalytics();
  analytics.totalRevalidations = (analytics.totalRevalidations || 0) + 1;
  
  if (!analytics.urlStats[url]) {
    analytics.urlStats[url] = { hits: 0, misses: 0, revalidations: 0, lastAccess: Date.now() };
  }
  
  analytics.urlStats[url].revalidations = (analytics.urlStats[url].revalidations || 0) + 1;
  analytics.urlStats[url].lastAccess = Date.now();
  
  // Initialize bandwidth tracking if it doesn't exist
  if (!analytics.bandwidth) {
    analytics.bandwidth = {
      totalBytesFromOrigin: 0,
      totalBytesServed: 0,
      bytesSavedBy304: 0,
      totalBytesSaved: 0,
      revalidationCount: 0
    };
  }
  
  // Initialize performance.revalidationResponseTimes if it doesn't exist
  if (!analytics.performance.revalidationResponseTimes) {
    analytics.performance.revalidationResponseTimes = [];
    analytics.performance.totalRevalidationTime = 0;
  }
  
  // Record bandwidth savings from 304
  if (bytesSaved > 0) {
    analytics.bandwidth.bytesSavedBy304 += bytesSaved;
    analytics.bandwidth.totalBytesSaved += bytesSaved;
    analytics.bandwidth.revalidationCount++;
  }
  
  // Record performance metrics
  if (responseTime > 0) {
    analytics.performance.revalidationResponseTimes.push(responseTime);
    analytics.performance.totalRevalidationTime += responseTime;
  }
  
  saveAnalytics(analytics);
}

/**
 * Record bytes downloaded from origin (for bandwidth tracking)
 * @param {number} bytes - Bytes downloaded from origin
 */
function recordBytesFromOrigin(bytes) {
  if (bytes <= 0) return;
  
  const analytics = loadAnalytics();
  
  // Initialize bandwidth tracking if it doesn't exist
  if (!analytics.bandwidth) {
    analytics.bandwidth = {
      totalBytesFromOrigin: 0,
      totalBytesServed: 0,
      bytesSavedBy304: 0,
      totalBytesSaved: 0,
      revalidationCount: 0
    };
  }
  
  analytics.bandwidth.totalBytesFromOrigin += bytes;
  saveAnalytics(analytics);
}

/**
 * Record bytes served to client
 * @param {number} bytes - Bytes served to client
 */
function recordBytesServed(bytes) {
  if (bytes <= 0) return;
  
  const analytics = loadAnalytics();
  
  // Initialize bandwidth tracking if it doesn't exist
  if (!analytics.bandwidth) {
    analytics.bandwidth = {
      totalBytesFromOrigin: 0,
      totalBytesServed: 0,
      bytesSavedBy304: 0,
      totalBytesSaved: 0,
      revalidationCount: 0
    };
  }
  
  analytics.bandwidth.totalBytesServed += bytes;
  
  // Update total bandwidth saved (includes cache hits)
  analytics.bandwidth.totalBytesSaved = analytics.performance.bandwidthSaved + (analytics.bandwidth.bytesSavedBy304 || 0);
  
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
  
  // Calculate revalidation statistics
  const totalRevalidations = analytics.totalRevalidations || 0;
  const revalidationResponseTimes = performance.revalidationResponseTimes || [];
  const avgRevalidationTime = revalidationResponseTimes.length > 0
    ? ((performance.totalRevalidationTime || 0) / revalidationResponseTimes.length).toFixed(2)
    : 0;
  
  // Calculate bandwidth statistics
  const bandwidth = analytics.bandwidth || {
    totalBytesFromOrigin: 0,
    totalBytesServed: 0,
    bytesSavedBy304: 0,
    totalBytesSaved: 0,
    revalidationCount: 0
  };
  
  // Format bandwidth values
  const formatBytes = (bytes) => {
    if (bytes > 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (bytes > 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${bytes} bytes`;
    }
  };
  
  // Calculate bandwidth efficiency
  const totalDownloaded = bandwidth.totalBytesFromOrigin;
  const totalServed = bandwidth.totalBytesServed;
  const bandwidthEfficiency = totalDownloaded > 0
    ? ((1 - totalDownloaded / totalServed) * 100).toFixed(2)
    : 0;
  
  return {
    totalHits: analytics.totalHits,
    totalMisses: analytics.totalMisses,
    totalRevalidations,
    totalRequests: totalRequests + totalRevalidations,
    hitRate: parseFloat(hitRate),
    missRate: parseFloat(missRate),
    uptime: uptimeStr,
    uptimeMs,
    topUrls,
    performance: {
      avgHitTime: parseFloat(avgHitTime),
      avgMissTime: parseFloat(avgMissTime),
      avgRevalidationTime: parseFloat(avgRevalidationTime),
      bandwidthSaved: bytes,
      bandwidthSavedStr,
      hitCount: performance.hitResponseTimes.length,
      missCount: performance.missResponseTimes.length,
      revalidationCount: revalidationResponseTimes.length
    },
    bandwidth: {
      totalBytesFromOrigin: bandwidth.totalBytesFromOrigin,
      totalBytesFromOriginStr: formatBytes(bandwidth.totalBytesFromOrigin),
      totalBytesServed: bandwidth.totalBytesServed,
      totalBytesServedStr: formatBytes(bandwidth.totalBytesServed),
      bytesSavedBy304: bandwidth.bytesSavedBy304,
      bytesSavedBy304Str: formatBytes(bandwidth.bytesSavedBy304),
      totalBytesSaved: bandwidth.totalBytesSaved,
      totalBytesSavedStr: formatBytes(bandwidth.totalBytesSaved),
      bandwidthEfficiency: parseFloat(bandwidthEfficiency),
      revalidationCount: bandwidth.revalidationCount
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
  recordRevalidation,
  recordBytesFromOrigin,
  recordBytesServed,
  recordCompression,
  getStats,
  resetAnalytics
};

