/**
 * Proxy Server Module
 * Handles HTTP server creation and request handling
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');
const { getCachedResponse, getStaleEntryForValidation, refreshCacheTimestamp, setCachedResponse, getCacheStats, configureCacheLimits, configurePatternTTL, configureVersionTTL, configureCompression, configureCacheKeyHeaders } = require('./cache');
const { getStats, recordRevalidation, recordBytesFromOrigin, recordBytesServed } = require('./analytics');
const { configureRateLimit, getClientIP, checkRateLimit, recordRequest, startCleanup } = require('./rateLimit');
const { configureRouter, matchOrigin, isMultiOriginEnabled, getRoutingTable } = require('./router');
const { configureHealthCheck, startHealthChecks, getAllHealthStatuses, isHealthCheckEnabled } = require('./healthCheck');
const { checkVersionChange, clearVersionCache } = require('./versionManager');
const logger = require('./logger');

// Track server start time for uptime
const serverStartTime = Date.now();

// Track cache version and config
let cacheVersion = null;
let serverConfig = null;

/**
 * Format uptime duration in human-readable format
 * @param {number} ms - Milliseconds
 * @returns {string} - Formatted uptime
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Check if origin server is reachable
 * @param {string} origin - Origin URL
 * @returns {Promise<boolean>} - True if reachable
 */
async function checkOriginReachability(origin) {
  return new Promise((resolve) => {
    try {
      const originUrl = new URL(origin);
      const client = originUrl.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: originUrl.hostname,
        port: originUrl.port || (originUrl.protocol === 'https:' ? 443 : 80),
        path: '/',
        method: 'HEAD',
        timeout: 3000 // 3 second timeout
      };
      
      const req = client.request(options, (res) => {
        resolve(true);
      });
      
      req.on('error', () => {
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      
      req.end();
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Handle health check endpoint
 * @param {http.IncomingMessage} req - Request
 * @param {http.ServerResponse} res - Response
 * @param {string} origin - Origin server URL
 */
async function handleHealthCheck(req, res, origin) {
  const uptime = Date.now() - serverStartTime;
  const cacheStats = getCacheStats();
  const analytics = getStats();
  const originReachable = await checkOriginReachability(origin);
  
  // Get memory usage
  const memUsage = process.memoryUsage();
  const memoryMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
  
  // Determine health status
  const status = originReachable ? 'healthy' : 'degraded';
  const statusCode = originReachable ? 200 : 503;
  
  const healthData = {
    status: status,
    uptime: formatUptime(uptime),
    uptimeMs: uptime,
    timestamp: new Date().toISOString(),
    cache: {
      size: cacheStats.size,
      hitRate: analytics.hitRate,
      entries: cacheStats.size,
      totalHits: analytics.totalHits,
      totalMisses: analytics.totalMisses
    },
    origin: {
      url: origin,
      reachable: originReachable
    },
    memory: {
      heapUsed: `${memoryMB} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`
    },
    version: '1.0.0',
    cacheVersion: cacheVersion || 'none'
  };
  
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(healthData, null, 2));
}

/**
 * Handle metrics endpoint (Prometheus format)
 * @param {http.IncomingMessage} req - Request
 * @param {http.ServerResponse} res - Response
 * @param {string} origin - Origin server URL
 */
function handleMetricsEndpoint(req, res, origin) {
  const uptime = Date.now() - serverStartTime;
  const uptimeSeconds = Math.floor(uptime / 1000);
  const cacheStats = getCacheStats();
  const analytics = getStats();
  const memUsage = process.memoryUsage();
  
  // Build Prometheus format metrics
  const metrics = [];
  
  // Add HELP and TYPE comments for each metric
  
  // HTTP request metrics
  metrics.push('# HELP http_requests_total Total number of HTTP requests processed');
  metrics.push('# TYPE http_requests_total counter');
  metrics.push(`http_requests_total ${analytics.totalRequests}`);
  metrics.push('');
  
  // Cache hit metrics
  metrics.push('# HELP cache_hits_total Total number of cache hits');
  metrics.push('# TYPE cache_hits_total counter');
  metrics.push(`cache_hits_total ${analytics.totalHits}`);
  metrics.push('');
  
  // Cache miss metrics
  metrics.push('# HELP cache_misses_total Total number of cache misses');
  metrics.push('# TYPE cache_misses_total counter');
  metrics.push(`cache_misses_total ${analytics.totalMisses}`);
  metrics.push('');
  
  // Cache hit rate
  metrics.push('# HELP cache_hit_rate Cache hit rate percentage (0-100)');
  metrics.push('# TYPE cache_hit_rate gauge');
  metrics.push(`cache_hit_rate ${analytics.hitRate}`);
  metrics.push('');
  
  // Cache size
  metrics.push('# HELP cache_entries_total Number of entries in cache');
  metrics.push('# TYPE cache_entries_total gauge');
  metrics.push(`cache_entries_total ${cacheStats.size}`);
  metrics.push('');
  
  // Average response time for cache hits
  metrics.push('# HELP cache_response_time_hit_ms Average response time for cache hits in milliseconds');
  metrics.push('# TYPE cache_response_time_hit_ms gauge');
  metrics.push(`cache_response_time_hit_ms ${analytics.avgHitTime}`);
  metrics.push('');
  
  // Average response time for cache misses
  metrics.push('# HELP cache_response_time_miss_ms Average response time for cache misses in milliseconds');
  metrics.push('# TYPE cache_response_time_miss_ms gauge');
  metrics.push(`cache_response_time_miss_ms ${analytics.avgMissTime}`);
  metrics.push('');
  
  // Bandwidth saved
  metrics.push('# HELP bandwidth_saved_bytes Total bandwidth saved by caching in bytes');
  metrics.push('# TYPE bandwidth_saved_bytes counter');
  metrics.push(`bandwidth_saved_bytes ${analytics.bandwidthSaved}`);
  metrics.push('');
  
  // Memory usage
  metrics.push('# HELP process_memory_heap_used_bytes Memory used by the heap in bytes');
  metrics.push('# TYPE process_memory_heap_used_bytes gauge');
  metrics.push(`process_memory_heap_used_bytes ${memUsage.heapUsed}`);
  metrics.push('');
  
  metrics.push('# HELP process_memory_heap_total_bytes Total heap size in bytes');
  metrics.push('# TYPE process_memory_heap_total_bytes gauge');
  metrics.push(`process_memory_heap_total_bytes ${memUsage.heapTotal}`);
  metrics.push('');
  
  metrics.push('# HELP process_memory_rss_bytes Resident set size in bytes');
  metrics.push('# TYPE process_memory_rss_bytes gauge');
  metrics.push(`process_memory_rss_bytes ${memUsage.rss}`);
  metrics.push('');
  
  // Server uptime
  metrics.push('# HELP process_uptime_seconds Server uptime in seconds');
  metrics.push('# TYPE process_uptime_seconds counter');
  metrics.push(`process_uptime_seconds ${uptimeSeconds}`);
  metrics.push('');
  
  // Join all metrics with newlines
  const metricsText = metrics.join('\n');
  
  // Send response in Prometheus text format
  res.writeHead(200, {
    'Content-Type': 'text/plain; version=0.0.4',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(metricsText);
}

/**
 * Handle liveness probe endpoint for Kubernetes
 * Returns 200 if the server process is running
 * @param {http.IncomingMessage} req - Request
 * @param {http.ServerResponse} res - Response
 */
function handleLivenessCheck(req, res) {
  // Liveness check - just indicates the server is running
  // If this endpoint responds, the process is alive
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify({
    status: 'alive',
    timestamp: new Date().toISOString()
  }));
}

/**
 * Handle readiness probe endpoint for Kubernetes
 * Returns 200 if the server is ready to accept traffic
 * @param {http.IncomingMessage} req - Request
 * @param {http.ServerResponse} res - Response
 * @param {string} origin - Origin server URL
 */
async function handleReadinessCheck(req, res, origin) {
  // Readiness check - indicates if the server can handle requests
  // Check if origin is reachable
  const originReachable = await checkOriginReachability(origin);
  
  if (originReachable) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify({
      status: 'ready',
      timestamp: new Date().toISOString()
    }));
  } else {
    // Not ready - origin is unreachable
    res.writeHead(503, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify({
      status: 'not ready',
      reason: 'origin server unreachable',
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Forward request to origin server (or serve from cache if available)
 * Preserves: headers, query parameters, request body, and HTTP method
 * @param {http.IncomingMessage} req - Incoming request
 * @param {http.ServerResponse} res - Response object
 * @param {string} origin - Origin server URL
 */
function forwardRequest(req, res, origin) {
  const originUrl = new URL(origin);
  const targetUrl = new URL(req.url, origin); // Preserves path and query params
  const fullUrl = `${origin}${req.url}`;
  
  // Generate unique request ID for tracking
  const requestId = logger.generateRequestId();
  
  // Track request start time for performance metrics
  const startTime = Date.now();
  
  // Determine version to use (from header or default)
  let requestVersion = cacheVersion;
  if (serverConfig && serverConfig.cache?.versioning?.allowVersionHeader) {
    const versionHeader = serverConfig.cache.versioning.versionHeader || 'X-API-Version';
    const headerVersion = req.headers[versionHeader.toLowerCase()];
    if (headerVersion) {
      requestVersion = headerVersion;
      console.log(`🔀 Using version from header: ${requestVersion}`);
    }
  }
  
  // ✅ Check cache first
  const cached = getCachedResponse(req.method, fullUrl, startTime, requestId, req.headers, origin, requestVersion);
  
  if (cached) {
    // Cache HIT - serve from cache
    const responseTime = Date.now() - startTime;
    console.log(`✨ Serving from cache: ${req.method} ${targetUrl.pathname}${targetUrl.search}`);
    
    // Add X-Cache: HIT header
    const cachedHeaders = {
      ...cached.headers,
      'x-cache': 'HIT',
      'x-request-id': requestId
    };
    
    // Log access event
    logger.logAccess({
      method: req.method,
      url: fullUrl,
      statusCode: cached.statusCode,
      cacheStatus: 'HIT',
      responseTime,
      requestId
    });
    
    // Track bandwidth served
    const bodySize = cached.body ? Buffer.byteLength(cached.body, 'utf8') : 0;
    if (bodySize > 0) {
      recordBytesServed(bodySize, origin);
    }
    
    // Send cached response to client
    res.writeHead(cached.statusCode, cachedHeaders);
    res.end(cached.body);
    return;
  }
  
  // Cache MISS - forward to origin
  console.log(`📤 ${req.method} ${targetUrl.pathname}${targetUrl.search}`);
  
  // Check for stale cache entry with validation headers (ETag/Last-Modified)
  const staleEntry = getStaleEntryForValidation(req.method, fullUrl, req.headers, origin, requestVersion);
  
  // Choose http or https based on origin protocol
  const client = originUrl.protocol === 'https:' ? https : http;
  
  // Prepare request options
  // Supports ALL HTTP methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, etc.
  const requestHeaders = {
    ...req.headers, // ✅ Preserves all original headers (Content-Type, Authorization, custom headers, etc.)
    host: originUrl.hostname // Override host header to match origin
  };
  
  // Add conditional request headers if we have a stale cache entry
  if (staleEntry) {
    if (staleEntry.etag) {
      requestHeaders['if-none-match'] = staleEntry.etag;
      console.log(`🔄 Conditional request: If-None-Match: ${staleEntry.etag}`);
    }
    if (staleEntry.lastModified) {
      requestHeaders['if-modified-since'] = staleEntry.lastModified;
      console.log(`🔄 Conditional request: If-Modified-Since: ${staleEntry.lastModified}`);
    }
  }
  
  const options = {
    hostname: originUrl.hostname,
    port: originUrl.port || (originUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search, // ✅ Preserves query parameters
    method: req.method, // ✅ Preserves HTTP method (GET, POST, etc.)
    headers: requestHeaders
  };
  
  // Forward the request to origin server
  const proxyReq = client.request(options, (proxyRes) => {
    console.log(`📥 ${proxyRes.statusCode} ${req.method} ${targetUrl.pathname}${targetUrl.search}`);
    
    // ✅ Handle 304 Not Modified response (conditional request validation)
    if (proxyRes.statusCode === 304 && staleEntry) {
      console.log(`✅ 304 Not Modified - content unchanged, serving from cache`);
      
      // Get Cache-Control from 304 response (for TTL refresh)
      const cacheControl = proxyRes.headers['cache-control'];
      
      // Refresh cache timestamp to extend TTL
      refreshCacheTimestamp(req.method, fullUrl, req.headers, origin, requestVersion, null, cacheControl);
      
      // Get the cached content (now with refreshed timestamp)
      const freshContent = getCachedResponse(req.method, fullUrl, startTime, requestId, req.headers, origin, requestVersion);
      
      if (freshContent) {
        // Calculate response time
        const responseTime = Date.now() - startTime;
        
        // Calculate bandwidth saved
        const savedBytes = Buffer.byteLength(freshContent.body, 'utf8');
        
        // Serve cached content with 200 status and REVALIDATED header
        const revalidatedHeaders = {
          ...freshContent.headers,
          'x-cache': 'REVALIDATED',
          'x-request-id': requestId
        };
        
        res.writeHead(200, revalidatedHeaders);
        res.end(freshContent.body);
        
        // Log access event
        logger.logAccess({
          method: req.method,
          url: fullUrl,
          statusCode: 200,
          cacheStatus: 'REVALIDATED',
          responseTime,
          requestId
        });
        
        // Record revalidation and bandwidth savings in analytics
        recordRevalidation(fullUrl, responseTime, savedBytes, origin);
        recordBytesServed(savedBytes, origin);
        
        console.log(`📊 Bandwidth saved: ${savedBytes} bytes (${(savedBytes / 1024).toFixed(2)} KB)`);
      } else {
        // Fallback: if we can't get cached content, return 304 to client
        console.log(`⚠️  Warning: 304 received but cached content not available`);
        const responseHeaders = {
          ...proxyRes.headers,
          'x-cache': 'REVALIDATED',
          'x-request-id': requestId
        };
        res.writeHead(304, responseHeaders);
        res.end();
      }
      
      return; // Don't continue with normal response handling
    }
    
    // ✅ Add X-Cache: MISS header to indicate response is from origin server
    const responseHeaders = {
      ...proxyRes.headers,
      'x-cache': 'MISS',
      'x-request-id': requestId
    };
    
    // Forward status code and headers (including X-Cache: MISS and X-Request-Id)
    res.writeHead(proxyRes.statusCode, responseHeaders);
    
    // Collect response body to store in cache
    let responseBody = '';
    
    proxyRes.on('data', (chunk) => {
      responseBody += chunk;
      res.write(chunk); // Forward to client
    });
    
    proxyRes.on('end', () => {
      res.end();
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Log access event
      logger.logAccess({
        method: req.method,
        url: fullUrl,
        statusCode: proxyRes.statusCode,
        cacheStatus: 'MISS',
        responseTime,
        requestId
      });
      
      // Check if request has authentication (don't cache authenticated requests)
      const hasAuth = req.headers['authorization'] || req.headers['cookie'];
      
      // Check Cache-Control header from origin server
      const cacheControl = proxyRes.headers['cache-control'];
      
      // Track bandwidth usage
      const bodySize = responseBody ? Buffer.byteLength(responseBody, 'utf8') : 0;
      if (bodySize > 0) {
        recordBytesFromOrigin(bodySize, origin);
        recordBytesServed(bodySize, origin);
      }
      
      // Store in cache (only if successful 2xx response and not authenticated)
      setCachedResponse(req.method, fullUrl, {
        statusCode: proxyRes.statusCode,
        headers: proxyRes.headers, // Store original headers (without X-Cache)
        body: responseBody
      }, hasAuth, cacheControl, requestId, req.headers, origin, requestVersion);
    });
  });
  
  // Handle errors
  proxyReq.on('error', (error) => {
    console.error(`❌ Error forwarding request: ${error.message}`);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway: Unable to reach origin server');
  });
  
  // ✅ Preserves request body using streaming (handles JSON, form data, binary, etc.)
  // This works for all content types and efficiently handles large payloads
  req.pipe(proxyReq);
}

/**
 * Create and start the proxy server
 * @param {number} port - Port to listen on
 * @param {string} origin - Origin server URL
 * @param {Object} config - Optional configuration object
 * @returns {http.Server} - HTTP server instance
 */
function createProxyServer(port, origin, config = null) {
  // Store config for use in request handlers
  serverConfig = config;
  
  // Configure cache limits if config provided
  if (config && config.cache) {
    // Set cache version if provided
    if (config.cache.version) {
      cacheVersion = config.cache.version;
      console.log(`🏷️  Cache version: ${cacheVersion}`);
      
      // Get versioning options
      const versioningOptions = {
        autoClear: config.cache.versioning?.autoClear !== false,
        maxVersions: config.cache.versioning?.maxVersions || null
      };
      
      // Check for version change
      const versionCheck = checkVersionChange(cacheVersion, clearVersionCache, versioningOptions);
      
      if (versionCheck.changed) {
        if (versionCheck.cleared) {
          console.log(`📊 Cache auto-cleared: ${versionCheck.clearedCount} entries removed`);
        } else {
          console.log(`📊 Multi-version mode: Old cache preserved`);
        }
      }
      
      // Display versioning configuration
      if (config.cache.versioning?.enabled) {
        console.log(`🔀 Multi-version support: Enabled`);
        if (config.cache.versioning.allowVersionHeader) {
          console.log(`   Version header: ${config.cache.versioning.versionHeader}`);
        }
        if (config.cache.versioning.maxVersions) {
          console.log(`   Max versions: ${config.cache.versioning.maxVersions}`);
        }
      }
    }
    
    configureCacheLimits({
      maxEntries: config.cache.maxEntries,
      maxSizeMB: config.cache.maxSizeMB
    });
    console.log(`💾 Cache limits: ${config.cache.maxEntries} entries, ${config.cache.maxSizeMB} MB`);
    
    // Configure pattern-based TTL if provided
    if (config.cache.customTTL) {
      configurePatternTTL(config.cache.customTTL);
    }
    
    // Configure version-specific TTL if provided
    if (config.cache.versioning?.versionTTL) {
      configureVersionTTL(config.cache.versioning.versionTTL);
    }
    
    // Configure compression if provided
    if (config.cache.compression) {
      if (config.cache.compression.enabled === false) {
        configureCompression('none');
        console.log(`🗜️  Compression: Disabled`);
      } else {
        const method = config.cache.compression.method || 'gzip';
        configureCompression(method);
        console.log(`🗜️  Compression: ${method}`);
      }
    }
    
    // Configure cache key headers if provided
    if (config.cache.cacheKeyHeaders && Array.isArray(config.cache.cacheKeyHeaders)) {
      configureCacheKeyHeaders(config.cache.cacheKeyHeaders);
      if (config.cache.cacheKeyHeaders.length > 0) {
        console.log(`🔑 Cache key headers: ${config.cache.cacheKeyHeaders.join(', ')}`);
      }
    }
  }
  
  // Configure logger if config provided
  if (config && config.logging) {
    if (config.logging.level) {
      logger.setLogLevel(config.logging.level);
      console.log(`📝 Log level set to: ${config.logging.level}`);
    }
    if (config.logging.format) {
      logger.setLogFormat(config.logging.format);
      console.log(`📝 Log format set to: ${config.logging.format}`);
    }
  }
  
  // Configure rate limiting if config provided
  const rateLimitCfg = config && (config.security?.rateLimit || config.rateLimit);
  if (rateLimitCfg) {
    const rateLimitEnabled = rateLimitCfg.enabled !== false;
    configureRateLimit({
      enabled: rateLimitEnabled, // Default to true if present
      requestsPerMinute: rateLimitCfg.requestsPerMinute || 60,
      requestsPerHour: rateLimitCfg.requestsPerHour || 1000,
      globalLimit: rateLimitCfg.globalLimit || null,
      whitelist: rateLimitCfg.whitelist || [],
      blacklist: rateLimitCfg.blacklist || []
    });
    
    // Start periodic cleanup if rate limiting is enabled
    if (rateLimitEnabled) {
      startCleanup();
    }
  } else {
    // Default: rate limiting disabled
    configureRateLimit({ enabled: false });
  }
  
  // Configure multi-origin routing if config provided
  if (config && config.origins) {
    configureRouter(config.origins);
  } else if (origin) {
    // Single origin mode - configure router with default origin
    configureRouter({ default: origin });
  }
  
  // Configure health checks if config provided
  if (config && config.healthCheck) {
    // Extract origins from routing configuration
    const origins = [];
    if (config.origins) {
      Object.entries(config.origins).forEach(([pattern, originUrl]) => {
        if (pattern !== 'default' && !origins.includes(originUrl)) {
          origins.push(originUrl);
        }
      });
      // Add default origin if present
      if (config.origins.default && !origins.includes(config.origins.default)) {
        origins.push(config.origins.default);
      }
    } else if (origin) {
      origins.push(origin);
    }
    
    configureHealthCheck({
      enabled: config.healthCheck.enabled !== false,
      interval: config.healthCheck.interval || 30000,
      timeout: config.healthCheck.timeout || 5000,
      path: config.healthCheck.path || '/',
      method: config.healthCheck.method || 'HEAD',
      origins: origins
    });
    
    // Start health checks if enabled
    if (config.healthCheck.enabled) {
      startHealthChecks();
    }
  }
  
  // Request handler function (used by both HTTP and HTTPS)
  const requestHandler = async (req, res) => {
    // Get client IP address
    const clientIP = getClientIP(req);
    
    // Generate request ID for logging
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check rate limit (skip for health/metrics endpoints)
    if (!req.url.startsWith('/__')) {
      const rateLimitCheck = checkRateLimit(clientIP);
      
      if (!rateLimitCheck.allowed) {
        // Handle blacklisted IPs (403 Forbidden)
        if (rateLimitCheck.isBlacklisted) {
          console.log(`🚫 Blacklisted IP blocked: ${clientIP}`);
          
          res.writeHead(403, {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId
          });
          
          res.end(JSON.stringify({
            error: 'Forbidden',
            message: 'IP address is blacklisted',
            ip: clientIP
          }));
          
          return;
        }
        
        // Handle rate limit exceeded (429 Too Many Requests)
        console.log(`⛔ Rate limit exceeded: ${clientIP} - ${rateLimitCheck.limit} (current: ${rateLimitCheck.current})`);
        
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': rateLimitCheck.retryAfter,
          'X-RateLimit-Limit': rateLimitCheck.limit,
          'X-RateLimit-Current': rateLimitCheck.current,
          'X-Request-Id': requestId
        });
        
        res.end(JSON.stringify({
          error: 'Too Many Requests',
          message: rateLimitCheck.limit,
          current: rateLimitCheck.current,
          retryAfter: rateLimitCheck.retryAfter,
          ip: clientIP
        }));
        
        return;
      }
      
      // Record this request for rate limiting
      recordRequest(clientIP);
    }
    
    // Handle health check endpoint
    if (req.url === '/__health') {
      await handleHealthCheck(req, res, origin);
      return;
    }
    
    // Handle metrics endpoint (Prometheus format)
    if (req.url === '/__metrics') {
      handleMetricsEndpoint(req, res, origin);
      return;
    }
    
    // Handle liveness probe (Kubernetes)
    if (req.url === '/__live') {
      handleLivenessCheck(req, res);
      return;
    }
    
    // Handle readiness probe (Kubernetes)
    if (req.url === '/__ready') {
      await handleReadinessCheck(req, res, origin);
      return;
    }
    
    // Forward all other requests
    // Use multi-origin routing if enabled
    if (isMultiOriginEnabled()) {
      const match = matchOrigin(req.url);
      
      if (!match.origin) {
        // No matching origin found
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Service Unavailable',
          message: `No origin configured for path: ${req.url}`
        }));
        return;
      }
      
      // Log routing decision for transparency
      if (match.matched) {
        console.log(`🗺️  Routing ${req.url} → ${match.origin} (matched: ${match.pattern})`);
      }
      
      forwardRequest(req, res, match.origin);
    } else {
      // Single origin mode (backward compatible)
      forwardRequest(req, res, origin);
    }
  };

  // Create HTTP or HTTPS server based on configuration
  let server;
  const httpsEnabled = config && config.server.https && config.server.https.enabled;
  
  if (httpsEnabled) {
    // Load SSL certificate and key
    const httpsOptions = {
      cert: fs.readFileSync(config.server.https.certPath),
      key: fs.readFileSync(config.server.https.keyPath)
    };
    
    server = https.createServer(httpsOptions, requestHandler);
    console.log(`🔒 HTTPS server enabled`);
  } else {
    server = http.createServer(requestHandler);
  }

  // Check for dual mode configuration
  const httpPort = config && config.server.httpPort;
  const isDualMode = httpsEnabled && httpPort;
  
  let httpsServer = null;
  let httpServer = null;
  let servers = [];
  
  if (isDualMode) {
    // Dual mode: Run both HTTP and HTTPS servers
    console.log(`🔀 Dual mode: Starting both HTTP and HTTPS servers`);
    
    // Create HTTPS server
    const httpsOptions = {
      cert: fs.readFileSync(config.server.https.certPath),
      key: fs.readFileSync(config.server.https.keyPath)
    };
    httpsServer = https.createServer(httpsOptions, requestHandler);
    servers.push({ server: httpsServer, type: 'HTTPS', port: port });
    
    // Create HTTP server
    httpServer = http.createServer(requestHandler);
    servers.push({ server: httpServer, type: 'HTTP', port: httpPort });
    
    // Start HTTPS server
    httpsServer.listen(port, () => {
      console.log(`🔒 HTTPS server is running on https://localhost:${port}`);
    });
    
    // Start HTTP server
    httpServer.listen(httpPort, () => {
      console.log(`✅ HTTP server is running on http://localhost:${httpPort}`);
      
      // Show summary after both servers start
      setTimeout(() => {
        console.log(`\n🎯 Dual mode active:`);
        console.log(`   HTTP:  curl http://localhost:${httpPort}/test`);
        console.log(`   HTTPS: curl -k https://localhost:${port}/test`);
        
        if (isMultiOriginEnabled()) {
          console.log(`\n📡 Multi-origin routing enabled`);
        } else if (origin) {
          console.log(`\n📡 Forwarding requests to: ${origin}`);
        }
        console.log();
      }, 100);
    });
    
  } else {
    // Single mode (HTTP or HTTPS only)
    server.listen(port, () => {
      const protocol = httpsEnabled ? 'https' : 'http';
      console.log(`✅ Proxy server is running on ${protocol}://localhost:${port}`);
      
      if (isMultiOriginEnabled()) {
        console.log(`📡 Multi-origin routing enabled`);
      } else if (origin) {
        console.log(`📡 Forwarding requests to: ${origin}`);
      }
      
      console.log(`\n🎯 Try: curl ${protocol}://localhost:${port}/test\n`);
    });
    
    servers.push({ server: server, type: httpsEnabled ? 'HTTPS' : 'HTTP', port: port });
  }

  // Handle server errors for all servers
  servers.forEach(({ server: srv, type, port: srvPort }) => {
    srv.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Error: ${type} port ${srvPort} is already in use`);
        console.error('   Please choose a different port or stop the process using this port.\n');
      } else {
        console.error(`\n❌ ${type} Server Error: ${error.message}\n`);
      }
      process.exit(1);
    });
  });

  // Graceful shutdown for all servers
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down proxy server(s)...');
    
    let closedCount = 0;
    const totalServers = servers.length;
    
    servers.forEach(({ server: srv }) => {
      srv.close(() => {
        closedCount++;
        if (closedCount === totalServers) {
          console.log('✅ All servers closed');
          process.exit(0);
        }
      });
    });
  });

  return httpsServer || server;
}

module.exports = {
  createProxyServer
};

