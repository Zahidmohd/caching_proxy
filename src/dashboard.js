/**
 * Web Dashboard Module
 * Provides a visual interface for monitoring the caching proxy
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { getStats } = require('./analytics');
const { getCacheStats, getAllCachedEntries, deleteCacheEntry, clearCache } = require('./cache');
const { getRateLimitMetrics } = require('./rateLimit');
const { getAllHealthStatuses } = require('./healthCheck');
const { getPluginStats } = require('./pluginManager');

/**
 * Create and start the dashboard server
 * @param {number} port - Port to run dashboard on
 * @param {Object} proxyConfig - Proxy configuration
 */
function createDashboardServer(port, proxyConfig) {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Set CORS headers for API endpoints
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API Endpoints
    if (pathname.startsWith('/api/')) {
      handleApiRequest(req, res, pathname, parsedUrl.query, proxyConfig);
      return;
    }

    // Serve static files
    serveStaticFile(req, res, pathname);
  });

  server.listen(port, () => {
    console.log(`\n📊 Dashboard is running on http://localhost:${port}`);
    console.log(`   Open in browser to view real-time monitoring\n`);
  });

  return server;
}

/**
 * Handle API requests
 */
function handleApiRequest(req, res, pathname, query, proxyConfig) {
  try {
    switch (pathname) {
      case '/api/stats':
        handleGetStats(req, res, proxyConfig);
        break;
      
      case '/api/cache':
        if (req.method === 'GET') {
          handleGetCacheList(req, res);
        } else if (req.method === 'DELETE') {
          handleClearCache(req, res);
        }
        break;
      
      case '/api/cache/entry':
        if (req.method === 'DELETE' && query.key) {
          handleDeleteCacheEntry(req, res, query.key);
        }
        break;
      
      case '/api/health':
        handleGetHealth(req, res);
        break;
      
      case '/api/rate-limits':
        handleGetRateLimits(req, res);
        break;
      
      case '/api/plugins':
        handleGetPlugins(req, res);
        break;
      
      default:
        sendJsonResponse(res, 404, { error: 'API endpoint not found' });
    }
  } catch (error) {
    console.error('Dashboard API error:', error);
    sendJsonResponse(res, 500, { error: 'Internal server error' });
  }
}

/**
 * Get overall statistics
 */
function handleGetStats(req, res, proxyConfig) {
  const analytics = getStats();
  const cacheStats = getCacheStats();
  
  const stats = {
    server: {
      uptime: Date.now() - (global.serverStartTime || Date.now()),
      port: proxyConfig?.server?.port || 3000,
      origin: proxyConfig?.server?.origin || 'N/A'
    },
    requests: {
      total: analytics.totalRequests,
      cacheHits: analytics.cacheHits,
      cacheMisses: analytics.cacheMisses,
      hitRate: analytics.hitRate
    },
    cache: {
      entries: cacheStats.entries,
      size: cacheStats.size,
      maxEntries: cacheStats.maxEntries,
      maxSize: cacheStats.maxSize
    },
    performance: {
      avgResponseTime: analytics.avgResponseTime,
      avgHitTime: analytics.avgHitTime,
      avgMissTime: analytics.avgMissTime,
      cacheSpeedup: analytics.cacheSpeedup
    },
    bandwidth: {
      totalFromOrigin: analytics.totalBytesFromOrigin || 0,
      totalServed: analytics.totalBytesServed || 0,
      saved: analytics.totalBytesSaved || 0,
      efficiency: analytics.bandwidthEfficiency || 0
    },
    topUrls: analytics.topUrls || []
  };

  sendJsonResponse(res, 200, stats);
}

/**
 * Get cache list
 */
function handleGetCacheList(req, res) {
  const entries = getAllCachedEntries();
  const now = Date.now();
  
  const cacheList = entries.map(entry => ({
    key: entry.key,
    url: entry.url || entry.key,
    method: entry.method || 'GET',
    statusCode: entry.statusCode,
    size: Buffer.byteLength(entry.body || '', 'utf8'),
    cachedAt: entry.cachedAt,
    expiresAt: entry.expiresAt,
    ttl: Math.max(0, entry.expiresAt - now),
    age: now - entry.cachedAt
  }));

  sendJsonResponse(res, 200, { entries: cacheList, count: cacheList.length });
}

/**
 * Delete specific cache entry
 */
function handleDeleteCacheEntry(req, res, cacheKey) {
  const deleted = deleteCacheEntry(cacheKey);
  
  if (deleted) {
    sendJsonResponse(res, 200, { 
      success: true, 
      message: 'Cache entry deleted',
      key: cacheKey 
    });
  } else {
    sendJsonResponse(res, 404, { 
      success: false, 
      error: 'Cache entry not found' 
    });
  }
}

/**
 * Clear all cache
 */
function handleClearCache(req, res) {
  const count = clearCache();
  
  sendJsonResponse(res, 200, { 
    success: true, 
    message: 'Cache cleared',
    entriesRemoved: count 
  });
}

/**
 * Get health status
 */
function handleGetHealth(req, res) {
  const healthStatuses = getAllHealthStatuses();
  
  sendJsonResponse(res, 200, { 
    origins: healthStatuses,
    count: healthStatuses.length 
  });
}

/**
 * Get rate limit metrics
 */
function handleGetRateLimits(req, res) {
  const metrics = getRateLimitMetrics();
  
  sendJsonResponse(res, 200, metrics);
}

/**
 * Get plugin information
 */
function handleGetPlugins(req, res) {
  const pluginStats = getPluginStats();
  
  sendJsonResponse(res, 200, pluginStats);
}

/**
 * Serve static files (HTML, CSS, JS)
 */
function serveStaticFile(req, res, pathname) {
  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, '../public', pathname);
  const extname = path.extname(filePath).toLowerCase();
  
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 - File Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 - Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

/**
 * Send JSON response
 */
function sendJsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

module.exports = {
  createDashboardServer
};

