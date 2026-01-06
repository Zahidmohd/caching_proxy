/**
 * Rate Limiting Module
 * Tracks and limits requests by IP address
 */

const fs = require('fs');
const path = require('path');

// File paths
const CACHE_DIR = path.join(process.cwd(), 'cache');
const METRICS_FILE = path.join(CACHE_DIR, 'rate-limit-metrics.json');

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load rate limit metrics from file
 */
function loadMetricsFromFile() {
  try {
    ensureCacheDir();
    if (fs.existsSync(METRICS_FILE)) {
      const data = fs.readFileSync(METRICS_FILE, 'utf8');
      const loaded = JSON.parse(data);
      
      // Convert arrays back to Maps
      return {
        totalRateLimited: loaded.totalRateLimited || 0,
        totalBlacklisted: loaded.totalBlacklisted || 0,
        totalWhitelisted: loaded.totalWhitelisted || 0,
        rateLimitedIPs: new Map(loaded.rateLimitedIPs || []),
        blacklistedAttempts: new Map(loaded.blacklistedAttempts || []),
        whitelistedRequests: new Map(loaded.whitelistedRequests || []),
        limitTypes: loaded.limitTypes || { perMinute: 0, perHour: 0, global: 0 },
        startTime: loaded.startTime || Date.now()
      };
    }
  } catch (error) {
    console.error('Error loading rate limit metrics:', error.message);
  }
  
  return {
    totalRateLimited: 0,
    totalBlacklisted: 0,
    totalWhitelisted: 0,
    rateLimitedIPs: new Map(),
    blacklistedAttempts: new Map(),
    whitelistedRequests: new Map(),
    limitTypes: { perMinute: 0, perHour: 0, global: 0 },
    startTime: Date.now()
  };
}

/**
 * Save rate limit metrics to file
 */
function saveMetricsToFile() {
  try {
    ensureCacheDir();
    const dataToSave = {
      totalRateLimited: rateLimitMetrics.totalRateLimited,
      totalBlacklisted: rateLimitMetrics.totalBlacklisted,
      totalWhitelisted: rateLimitMetrics.totalWhitelisted,
      rateLimitedIPs: Array.from(rateLimitMetrics.rateLimitedIPs.entries()),
      blacklistedAttempts: Array.from(rateLimitMetrics.blacklistedAttempts.entries()),
      whitelistedRequests: Array.from(rateLimitMetrics.whitelistedRequests.entries()),
      limitTypes: rateLimitMetrics.limitTypes,
      startTime: rateLimitMetrics.startTime
    };
    fs.writeFileSync(METRICS_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving rate limit metrics:', error.message);
  }
}

// Store for tracking requests per IP
// Structure: { ipAddress: [timestamp1, timestamp2, ...] }
const requestLog = new Map();

// Metrics tracking - load from file on module initialization
const rateLimitMetrics = loadMetricsFromFile();

// Configuration
let rateLimitConfig = {
  enabled: false,
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  globalLimit: null, // Global requests per minute (all IPs combined)
  windowMs: 60000, // Time window for rate limiting (1 minute)
  whitelist: [], // IPs that bypass rate limiting
  blacklist: [] // IPs that are completely blocked (403)
};

/**
 * Check if IP matches a CIDR pattern
 * @param {string} ip - IP address to check
 * @param {string} cidr - CIDR notation (e.g., "192.168.1.0/24")
 * @returns {boolean} - True if IP matches CIDR
 */
function matchCIDR(ip, cidr) {
  if (!cidr.includes('/')) {
    // Not CIDR, just exact match
    return ip === cidr;
  }
  
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Check if IP matches any pattern in a list
 * @param {string} ip - IP address to check
 * @param {Array} patterns - Array of IP addresses or CIDR patterns
 * @returns {boolean} - True if IP matches any pattern
 */
function matchesAnyPattern(ip, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  
  // Normalize IPv6 localhost to IPv4
  const normalizedIP = ip === '::1' ? '127.0.0.1' : ip;
  
  for (const pattern of patterns) {
    // Normalize pattern if it's IPv6 localhost
    const normalizedPattern = pattern === '::1' ? '127.0.0.1' : pattern;
    
    // Exact match (check both original and normalized)
    if (ip === pattern || normalizedIP === normalizedPattern) {
      return true;
    }
    
    // CIDR match (only works with IPv4)
    if (normalizedPattern.includes('/') && !normalizedPattern.includes(':')) {
      try {
        if (matchCIDR(normalizedIP, normalizedPattern)) {
          return true;
        }
      } catch (e) {
        // Invalid CIDR, skip
        console.warn(`Invalid CIDR pattern: ${normalizedPattern}`);
      }
    }
    
    // Wildcard match (e.g., "192.168.*")
    if (normalizedPattern.includes('*')) {
      const regex = new RegExp('^' + normalizedPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      if (regex.test(normalizedIP)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if IP is whitelisted (bypasses rate limiting)
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if whitelisted
 */
function isWhitelisted(ip) {
  return matchesAnyPattern(ip, rateLimitConfig.whitelist);
}

/**
 * Check if IP is blacklisted (blocked completely)
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if blacklisted
 */
function isBlacklisted(ip) {
  return matchesAnyPattern(ip, rateLimitConfig.blacklist);
}

/**
 * Configure rate limiting settings
 * @param {Object} config - Rate limit configuration
 */
function configureRateLimit(config = {}) {
  if (config.enabled !== undefined) {
    rateLimitConfig.enabled = config.enabled;
  }
  if (config.requestsPerMinute !== undefined) {
    rateLimitConfig.requestsPerMinute = config.requestsPerMinute;
  }
  if (config.requestsPerHour !== undefined) {
    rateLimitConfig.requestsPerHour = config.requestsPerHour;
  }
  if (config.globalLimit !== undefined) {
    rateLimitConfig.globalLimit = config.globalLimit;
  }
  if (config.windowMs !== undefined) {
    rateLimitConfig.windowMs = config.windowMs;
  }
  if (config.whitelist !== undefined) {
    rateLimitConfig.whitelist = Array.isArray(config.whitelist) ? config.whitelist : [];
  }
  if (config.blacklist !== undefined) {
    rateLimitConfig.blacklist = Array.isArray(config.blacklist) ? config.blacklist : [];
  }
  
  console.log(`⚙️  Rate limiting: ${rateLimitConfig.enabled ? 'Enabled' : 'Disabled'}`);
  if (rateLimitConfig.enabled) {
    console.log(`   Per-IP Limits: ${rateLimitConfig.requestsPerMinute}/min, ${rateLimitConfig.requestsPerHour}/hour`);
    if (rateLimitConfig.globalLimit) {
      console.log(`   Global Limit: ${rateLimitConfig.globalLimit}/min (across all IPs)`);
    }
    if (rateLimitConfig.whitelist.length > 0) {
      console.log(`   Whitelist: ${rateLimitConfig.whitelist.length} IP(s) bypass rate limiting`);
    }
    if (rateLimitConfig.blacklist.length > 0) {
      console.log(`   Blacklist: ${rateLimitConfig.blacklist.length} IP(s) blocked`);
    }
  }
}

/**
 * Clean up old request timestamps from the log
 * Removes entries older than 1 hour
 */
function cleanupOldEntries() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [ip, timestamps] of requestLog.entries()) {
    // Filter out timestamps older than 1 hour
    const recentTimestamps = timestamps.filter(ts => ts > oneHourAgo);
    
    if (recentTimestamps.length === 0) {
      // No recent requests, remove IP from log
      requestLog.delete(ip);
    } else {
      requestLog.set(ip, recentTimestamps);
    }
  }
}

/**
 * Get the client IP address from the request
 * @param {Object} req - HTTP request object
 * @returns {string} - Client IP address
 */
function getClientIP(req) {
  // Check for X-Forwarded-For header (proxy/load balancer)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  // Check for X-Real-IP header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP.trim();
  }
  
  // Fall back to socket remote address
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Count total requests across all IPs in a time window
 * @param {number} windowStart - Timestamp for start of window
 * @returns {number} - Total request count
 */
function countGlobalRequests(windowStart) {
  let total = 0;
  
  for (const timestamps of requestLog.values()) {
    total += timestamps.filter(ts => ts > windowStart).length;
  }
  
  return total;
}

/**
 * Record a metric event
 * @param {string} type - Type of event (rateLimited, blacklisted, whitelisted)
 * @param {string} ip - IP address
 * @param {string} limitType - Type of limit hit (perMinute, perHour, global)
 */
function recordMetric(type, ip, limitType = null) {
  if (type === 'rateLimited') {
    rateLimitMetrics.totalRateLimited++;
    const count = rateLimitMetrics.rateLimitedIPs.get(ip) || 0;
    rateLimitMetrics.rateLimitedIPs.set(ip, count + 1);
    
    if (limitType) {
      rateLimitMetrics.limitTypes[limitType]++;
    }
  } else if (type === 'blacklisted') {
    rateLimitMetrics.totalBlacklisted++;
    const count = rateLimitMetrics.blacklistedAttempts.get(ip) || 0;
    rateLimitMetrics.blacklistedAttempts.set(ip, count + 1);
  } else if (type === 'whitelisted') {
    rateLimitMetrics.totalWhitelisted++;
    const count = rateLimitMetrics.whitelistedRequests.get(ip) || 0;
    rateLimitMetrics.whitelistedRequests.set(ip, count + 1);
  }
  
  // Save metrics to file after recording
  saveMetricsToFile();
}

/**
 * Check if an IP address is rate limited
 * @param {string} ip - IP address to check
 * @returns {Object} - { allowed: boolean, retryAfter: number|null, limit: string|null }
 */
function checkRateLimit(ip) {
  // Check blacklist first - blocked IPs always get denied
  if (isBlacklisted(ip)) {
    recordMetric('blacklisted', ip);
    return {
      allowed: false,
      retryAfter: null,
      limit: 'IP address is blacklisted',
      current: null,
      isBlacklisted: true,
      statusCode: 403 // Forbidden instead of 429
    };
  }
  
  // Check whitelist - whitelisted IPs bypass all rate limiting
  if (isWhitelisted(ip)) {
    recordMetric('whitelisted', ip);
    return {
      allowed: true,
      retryAfter: null,
      limit: null,
      isWhitelisted: true
    };
  }
  
  if (!rateLimitConfig.enabled) {
    return { allowed: true, retryAfter: null, limit: null };
  }
  
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Check global rate limit first (if configured)
  if (rateLimitConfig.globalLimit && rateLimitConfig.globalLimit > 0) {
    const globalRequestsLastMinute = countGlobalRequests(oneMinuteAgo);
    
    if (globalRequestsLastMinute >= rateLimitConfig.globalLimit) {
      recordMetric('rateLimited', ip, 'global');
      return {
        allowed: false,
        retryAfter: 60,
        limit: `${rateLimitConfig.globalLimit} requests per minute (global limit)`,
        current: globalRequestsLastMinute,
        isGlobal: true
      };
    }
  }
  
  // Get request history for this IP
  const timestamps = requestLog.get(ip) || [];
  
  // Count requests in the last minute
  const requestsLastMinute = timestamps.filter(ts => ts > oneMinuteAgo).length;
  
  // Count requests in the last hour
  const requestsLastHour = timestamps.filter(ts => ts > oneHourAgo).length;
  
  // Check per-minute limit
  if (requestsLastMinute >= rateLimitConfig.requestsPerMinute) {
    // Find when the oldest request in the current minute will expire
    const oldestInWindow = timestamps.find(ts => ts > oneMinuteAgo);
    const retryAfter = oldestInWindow ? Math.ceil((oldestInWindow + 60000 - now) / 1000) : 60;
    
    recordMetric('rateLimited', ip, 'perMinute');
    return {
      allowed: false,
      retryAfter,
      limit: `${rateLimitConfig.requestsPerMinute} requests per minute`,
      current: requestsLastMinute
    };
  }
  
  // Check per-hour limit
  if (requestsLastHour >= rateLimitConfig.requestsPerHour) {
    // Find when the oldest request in the current hour will expire
    const oldestInWindow = timestamps.find(ts => ts > oneHourAgo);
    const retryAfter = oldestInWindow ? Math.ceil((oldestInWindow + 3600000 - now) / 1000) : 3600;
    
    recordMetric('rateLimited', ip, 'perHour');
    return {
      allowed: false,
      retryAfter,
      limit: `${rateLimitConfig.requestsPerHour} requests per hour`,
      current: requestsLastHour
    };
  }
  
  return { allowed: true, retryAfter: null, limit: null };
}

/**
 * Record a request from an IP address
 * @param {string} ip - IP address making the request
 */
function recordRequest(ip) {
  if (!rateLimitConfig.enabled) {
    return;
  }
  
  const now = Date.now();
  const timestamps = requestLog.get(ip) || [];
  
  // Add current timestamp
  timestamps.push(now);
  
  // Store updated timestamps
  requestLog.set(ip, timestamps);
}

/**
 * Get rate limit statistics
 * @returns {Object} - Rate limit statistics
 */
function getRateLimitStats() {
  const stats = {
    enabled: rateLimitConfig.enabled,
    config: {
      requestsPerMinute: rateLimitConfig.requestsPerMinute,
      requestsPerHour: rateLimitConfig.requestsPerHour,
      globalLimit: rateLimitConfig.globalLimit
    },
    tracked: {
      totalIPs: requestLog.size,
      ips: []
    }
  };
  
  if (!rateLimitConfig.enabled) {
    return stats;
  }
  
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Calculate global statistics
  const globalRequestsLastMinute = countGlobalRequests(oneMinuteAgo);
  const globalRequestsLastHour = countGlobalRequests(oneHourAgo);
  
  stats.global = {
    requestsLastMinute: globalRequestsLastMinute,
    requestsLastHour: globalRequestsLastHour,
    limitPerMinute: rateLimitConfig.globalLimit,
    utilizationPercent: rateLimitConfig.globalLimit 
      ? ((globalRequestsLastMinute / rateLimitConfig.globalLimit) * 100).toFixed(2)
      : null
  };
  
  // Collect stats for each IP
  for (const [ip, timestamps] of requestLog.entries()) {
    const requestsLastMinute = timestamps.filter(ts => ts > oneMinuteAgo).length;
    const requestsLastHour = timestamps.filter(ts => ts > oneHourAgo).length;
    
    stats.tracked.ips.push({
      ip,
      requestsLastMinute,
      requestsLastHour,
      totalRequests: timestamps.length
    });
  }
  
  // Sort by most active IPs
  stats.tracked.ips.sort((a, b) => b.requestsLastMinute - a.requestsLastMinute);
  
  // Add metrics
  stats.metrics = {
    totalRateLimited: rateLimitMetrics.totalRateLimited,
    totalBlacklisted: rateLimitMetrics.totalBlacklisted,
    totalWhitelisted: rateLimitMetrics.totalWhitelisted,
    limitTypes: { ...rateLimitMetrics.limitTypes },
    uptime: Date.now() - rateLimitMetrics.startTime,
    topRateLimitedIPs: Array.from(rateLimitMetrics.rateLimitedIPs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),
    topBlacklistedIPs: Array.from(rateLimitMetrics.blacklistedAttempts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),
    topWhitelistedIPs: Array.from(rateLimitMetrics.whitelistedRequests.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }))
  };
  
  return stats;
}

/**
 * Get rate limit metrics only
 * @returns {Object} - Rate limit metrics
 */
function getRateLimitMetrics() {
  const uptime = Date.now() - rateLimitMetrics.startTime;
  const uptimeSeconds = Math.floor(uptime / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  
  let uptimeStr;
  if (uptimeHours > 0) {
    uptimeStr = `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`;
  } else if (uptimeMinutes > 0) {
    uptimeStr = `${uptimeMinutes}m ${uptimeSeconds % 60}s`;
  } else {
    uptimeStr = `${uptimeSeconds}s`;
  }
  
  return {
    enabled: rateLimitConfig.enabled,
    totalEvents: rateLimitMetrics.totalRateLimited + rateLimitMetrics.totalBlacklisted + rateLimitMetrics.totalWhitelisted,
    totalRateLimited: rateLimitMetrics.totalRateLimited,
    totalBlacklisted: rateLimitMetrics.totalBlacklisted,
    totalWhitelisted: rateLimitMetrics.totalWhitelisted,
    limitTypes: {
      perMinute: rateLimitMetrics.limitTypes.perMinute,
      perHour: rateLimitMetrics.limitTypes.perHour,
      global: rateLimitMetrics.limitTypes.global
    },
    uniqueIPsRateLimited: rateLimitMetrics.rateLimitedIPs.size,
    uniqueIPsBlacklisted: rateLimitMetrics.blacklistedAttempts.size,
    uniqueIPsWhitelisted: rateLimitMetrics.whitelistedRequests.size,
    uptime: uptimeStr,
    uptimeMs: uptime,
    topRateLimitedIPs: Array.from(rateLimitMetrics.rateLimitedIPs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),
    topBlacklistedIPs: Array.from(rateLimitMetrics.blacklistedAttempts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),
    topWhitelistedIPs: Array.from(rateLimitMetrics.whitelistedRequests.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }))
  };
}

/**
 * Reset rate limit tracking and metrics
 */
function resetRateLimits() {
  requestLog.clear();
  
  // Reset metrics
  rateLimitMetrics.totalRateLimited = 0;
  rateLimitMetrics.totalBlacklisted = 0;
  rateLimitMetrics.totalWhitelisted = 0;
  rateLimitMetrics.rateLimitedIPs.clear();
  rateLimitMetrics.blacklistedAttempts.clear();
  rateLimitMetrics.whitelistedRequests.clear();
  rateLimitMetrics.limitTypes = { perMinute: 0, perHour: 0, global: 0 };
  rateLimitMetrics.startTime = Date.now();
  
  // Delete metrics file
  try {
    if (fs.existsSync(METRICS_FILE)) {
      fs.unlinkSync(METRICS_FILE);
    }
  } catch (error) {
    console.error('Error deleting metrics file:', error.message);
  }
  
  console.log('✅ Rate limit tracking and metrics reset');
}

// Cleanup interval reference
let cleanupInterval = null;

/**
 * Start periodic cleanup (called when server starts)
 */
function startCleanup() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupOldEntries, 5 * 60 * 1000);
  }
}

/**
 * Stop periodic cleanup (called when server stops)
 */
function stopCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

module.exports = {
  configureRateLimit,
  getClientIP,
  checkRateLimit,
  recordRequest,
  getRateLimitStats,
  getRateLimitMetrics,
  resetRateLimits,
  isWhitelisted,
  isBlacklisted,
  startCleanup,
  stopCleanup
};

