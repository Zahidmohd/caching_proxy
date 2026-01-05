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
 */
function recordHit(url) {
  const analytics = loadAnalytics();
  analytics.totalHits++;
  
  if (!analytics.urlStats[url]) {
    analytics.urlStats[url] = { hits: 0, misses: 0, lastAccess: Date.now() };
  }
  
  analytics.urlStats[url].hits++;
  analytics.urlStats[url].lastAccess = Date.now();
  
  saveAnalytics(analytics);
}

/**
 * Record a cache miss
 * @param {string} url - The URL that was missed
 */
function recordMiss(url) {
  const analytics = loadAnalytics();
  analytics.totalMisses++;
  
  if (!analytics.urlStats[url]) {
    analytics.urlStats[url] = { hits: 0, misses: 0, lastAccess: Date.now() };
  }
  
  analytics.urlStats[url].misses++;
  analytics.urlStats[url].lastAccess = Date.now();
  
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
  
  return {
    totalHits: analytics.totalHits,
    totalMisses: analytics.totalMisses,
    totalRequests,
    hitRate: parseFloat(hitRate),
    missRate: parseFloat(missRate),
    uptime: uptimeStr,
    uptimeMs,
    topUrls
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

module.exports = {
  recordHit,
  recordMiss,
  getStats,
  resetAnalytics
};

