/**
 * Proxy Server Module
 * Handles HTTP server creation and request handling
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { getCachedResponse, setCachedResponse, getCacheStats } = require('./cache');
const { getStats } = require('./analytics');
const logger = require('./logger');

// Track server start time for uptime
const serverStartTime = Date.now();

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
    version: '1.0.0'
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
  
  // ✅ Check cache first
  const cached = getCachedResponse(req.method, fullUrl, startTime, requestId);
  
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
    
    // Send cached response to client
    res.writeHead(cached.statusCode, cachedHeaders);
    res.end(cached.body);
    return;
  }
  
  // Cache MISS - forward to origin
  console.log(`📤 ${req.method} ${targetUrl.pathname}${targetUrl.search}`);
  
  // Choose http or https based on origin protocol
  const client = originUrl.protocol === 'https:' ? https : http;
  
  // Prepare request options
  // Supports ALL HTTP methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, etc.
  const options = {
    hostname: originUrl.hostname,
    port: originUrl.port || (originUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search, // ✅ Preserves query parameters
    method: req.method, // ✅ Preserves HTTP method (GET, POST, etc.)
    headers: {
      ...req.headers, // ✅ Preserves all original headers (Content-Type, Authorization, custom headers, etc.)
      host: originUrl.hostname // Override host header to match origin
    }
  };
  
  // Forward the request to origin server
  const proxyReq = client.request(options, (proxyRes) => {
    console.log(`📥 ${proxyRes.statusCode} ${req.method} ${targetUrl.pathname}${targetUrl.search}`);
    
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
      
      // Store in cache (only if successful 2xx response and not authenticated)
      setCachedResponse(req.method, fullUrl, {
        statusCode: proxyRes.statusCode,
        headers: proxyRes.headers, // Store original headers (without X-Cache)
        body: responseBody
      }, hasAuth, cacheControl, requestId);
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
  
  const server = http.createServer(async (req, res) => {
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
    
    // Forward all other requests
    forwardRequest(req, res, origin);
  });

  server.listen(port, () => {
    console.log(`✅ Proxy server is running on http://localhost:${port}`);
    console.log(`📡 Forwarding requests to: ${origin}`);
    console.log(`\n🎯 Try: curl http://localhost:${port}/test\n`);
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${port} is already in use`);
      console.error('   Please choose a different port or stop the process using this port.\n');
    } else {
      console.error(`\n❌ Server Error: ${error.message}\n`);
    }
    process.exit(1);
  });

  return server;
}

module.exports = {
  createProxyServer
};

