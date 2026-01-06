/**
 * Rate Limiting Module
 * Tracks and limits requests by IP address
 */

// Store for tracking requests per IP
// Structure: { ipAddress: [timestamp1, timestamp2, ...] }
const requestLog = new Map();

// Configuration
let rateLimitConfig = {
  enabled: false,
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  globalLimit: null, // Global requests per minute (all IPs combined)
  windowMs: 60000 // Time window for rate limiting (1 minute)
};

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
  
  console.log(`⚙️  Rate limiting: ${rateLimitConfig.enabled ? 'Enabled' : 'Disabled'}`);
  if (rateLimitConfig.enabled) {
    console.log(`   Per-IP Limits: ${rateLimitConfig.requestsPerMinute}/min, ${rateLimitConfig.requestsPerHour}/hour`);
    if (rateLimitConfig.globalLimit) {
      console.log(`   Global Limit: ${rateLimitConfig.globalLimit}/min (across all IPs)`);
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
 * Check if an IP address is rate limited
 * @param {string} ip - IP address to check
 * @returns {Object} - { allowed: boolean, retryAfter: number|null, limit: string|null }
 */
function checkRateLimit(ip) {
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
  
  return stats;
}

/**
 * Reset rate limit tracking
 */
function resetRateLimits() {
  requestLog.clear();
  console.log('✅ Rate limit tracking reset');
}

// Periodic cleanup (every 5 minutes)
setInterval(cleanupOldEntries, 5 * 60 * 1000);

module.exports = {
  configureRateLimit,
  getClientIP,
  checkRateLimit,
  recordRequest,
  getRateLimitStats,
  resetRateLimits
};

