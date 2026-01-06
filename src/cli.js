/**
 * CLI Handler Functions
 * Handles the main CLI commands with validation
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { createProxyServer } = require('./server');
const { clearCache, clearCacheByPattern, clearCacheByURL, clearCacheOlderThan, getCacheStats, setCachedResponse, generateCacheKey } = require('./cache');
const { getStats } = require('./analytics');
const { displayConfigSummary } = require('./config');
const { createDashboardServer } = require('./dashboard');

/**
 * Validate port number
 * @param {string|number} port - Port number to validate
 * @returns {number} - Valid port number
 */
function validatePort(port) {
  const portNum = parseInt(port, 10);
  
  if (isNaN(portNum)) {
    console.error('❌ Error: Port must be a valid number');
    process.exit(1);
  }
  
  if (portNum < 1 || portNum > 65535) {
    console.error('❌ Error: Port must be between 1 and 65535');
    process.exit(1);
  }
  
  return portNum;
}

/**
 * Validate origin URL
 * @param {string} origin - Origin URL to validate
 * @returns {string} - Valid origin URL
 */
function validateOrigin(origin) {
  try {
    const url = new URL(origin);
    
    // Check if protocol is http or https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Protocol must be http or https');
    }
    
    return origin;
  } catch (error) {
    console.error('❌ Error: Invalid origin URL');
    console.error(`   ${error.message}`);
    console.error('   Example: http://dummyjson.com');
    process.exit(1);
  }
}

/**
 * Start the caching proxy server
 * @param {string|number} port - Port to listen on
 * @param {string} origin - Origin server URL (null for multi-origin mode)
 * @param {Object} config - Optional configuration object
 */
function startServer(port, origin, config = null) {
  // Validate inputs
  const validPort = validatePort(port);
  
  // Skip origin validation if using multi-origin routing
  let validOrigin = null;
  if (origin) {
    validOrigin = validateOrigin(origin);
  } else if (config && !config.origins) {
    console.error('❌ Error: No origin configuration provided');
    console.error('   Either provide --origin or configure origins in config file');
    process.exit(1);
  }
  
  // Display configuration summary if config was used
  if (config) {
    displayConfigSummary(config);
  } else {
    console.log('\n🚀 Starting Caching Proxy Server...');
    console.log(`   Port:   ${validPort}`);
    console.log(`   Origin: ${validOrigin}`);
    console.log('');
  }
  
  // Create and start the proxy server
  createProxyServer(validPort, validOrigin, config);
  
  // Start dashboard if configured
  if (config && config.server && config.server.dashboardPort) {
    const dashboardPort = config.server.dashboardPort;
    createDashboardServer(dashboardPort, config);
  }
}

/**
 * Clear the cache
 * @param {boolean} dryRun - If true, only preview what would be deleted
 */
function clearCacheCommand(dryRun = false) {
  const mode = dryRun ? '[DRY RUN - PREVIEW ONLY]' : '';
  console.log(`\n🧹 Clearing cache... ${mode}`);
  
  // Get stats before clearing
  const statsBefore = getCacheStats();
  console.log(`   Current cache size: ${statsBefore.size} entries`);
  
  if (statsBefore.size === 0) {
    console.log('   Cache is already empty.\n');
    return;
  }
  
  // Clear the cache (or preview)
  const result = clearCache(dryRun);
  
  // Show what's being cleared
  console.log(`\n   ${dryRun ? 'Would delete' : 'Deleted'} entries:`);
  result.keys.slice(0, 10).forEach((key, index) => {
    console.log(`     ${index + 1}. ${key}`);
  });
  if (result.cleared > 10) {
    console.log(`     ... and ${result.cleared - 10} more`);
  }
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN: ${result.cleared} ${result.cleared === 1 ? 'entry' : 'entries'} would be removed`);
    console.log(`   💡 Run without --dry-run to actually delete these entries`);
  } else {
    console.log(`\n✅ Cache cleared successfully!`);
    console.log(`   ${result.cleared} ${result.cleared === 1 ? 'entry' : 'entries'} removed`);
    
    // Show expired entries info if any
    if (statsBefore.expiredRemoved > 0) {
      console.log(`   (${statsBefore.expiredRemoved} expired entries auto-removed during stats check)`);
    }
  }
  console.log();
}

/**
 * Clear cache entries matching a pattern
 * @param {string} pattern - Pattern with wildcards (e.g., "/products/*")
 * @param {boolean} dryRun - If true, only preview what would be deleted
 */
function clearCachePatternCommand(pattern, dryRun = false) {
  const mode = dryRun ? '[DRY RUN - PREVIEW ONLY]' : '';
  console.log(`\n🧹 Clearing cache entries matching pattern... ${mode}`);
  console.log(`   Pattern: ${pattern}`);
  
  // Get stats before clearing
  const statsBefore = getCacheStats();
  console.log(`   Current cache size: ${statsBefore.size} entries`);
  
  if (statsBefore.size === 0) {
    console.log('   Cache is already empty.\n');
    return;
  }
  
  // Clear cache by pattern (or preview)
  const result = clearCacheByPattern(pattern, dryRun);
  
  if (result.cleared === 0) {
    console.log(`\n⚠️  No cache entries matched the pattern "${pattern}"`);
    console.log();
    return;
  }
  
  // Show what was cleared
  console.log(`\n   ${dryRun ? 'Would delete' : 'Deleted'} entries:`);
  result.keys.slice(0, 10).forEach((key, index) => {
    console.log(`     ${index + 1}. ${key}`);
  });
  if (result.cleared > 10) {
    console.log(`     ... and ${result.cleared - 10} more`);
  }
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN: ${result.cleared} ${result.cleared === 1 ? 'entry' : 'entries'} would be removed`);
    console.log(`   ${statsBefore.size - result.cleared} entries would remain`);
    console.log(`   💡 Run without --dry-run to actually delete these entries`);
  } else {
    console.log(`\n✅ Cache cleared successfully!`);
    console.log(`   ${result.cleared} ${result.cleared === 1 ? 'entry' : 'entries'} removed`);
    console.log(`   ${statsBefore.size - result.cleared} entries remaining`);
  }
  console.log();
}

/**
 * Clear cache entry for a specific URL
 * @param {string} url - Exact URL to clear
 * @param {boolean} dryRun - If true, only preview what would be deleted
 * @param {string} method - HTTP method (default: "GET")
 */
function clearCacheURLCommand(url, dryRun = false, method = 'GET') {
  const mode = dryRun ? '[DRY RUN - PREVIEW ONLY]' : '';
  console.log(`\n🧹 Clearing cache entry for specific URL... ${mode}`);
  console.log(`   URL: ${url}`);
  console.log(`   Method: ${method}`);
  
  // Get stats before clearing
  const statsBefore = getCacheStats();
  console.log(`   Current cache size: ${statsBefore.size} entries`);
  
  if (statsBefore.size === 0) {
    console.log('   Cache is already empty.\n');
    return;
  }
  
  // Clear cache by URL (or preview)
  const result = clearCacheByURL(url, method, dryRun);
  
  if (!result.cleared) {
    console.log(`\n⚠️  No cache entry found for "${method}:${url}"`);
    console.log('   💡 Tip: Make sure the URL includes the protocol (http:// or https://)');
    console.log();
    return;
  }
  
  console.log(`\n   ${dryRun ? 'Would delete' : 'Deleted'} entry:`);
  console.log(`     ${result.key}`);
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN: 1 entry would be removed`);
    console.log(`   ${statsBefore.size - 1} entries would remain`);
    console.log(`   💡 Run without --dry-run to actually delete this entry`);
  } else {
    console.log(`\n✅ Cache cleared successfully!`);
    console.log(`   1 entry removed`);
    console.log(`   ${statsBefore.size - 1} entries remaining`);
  }
  console.log();
}

/**
 * Clear cache entries older than specified time
 * @param {string} timeStr - Time string (e.g., "1h", "30m", "2d")
 * @param {boolean} dryRun - If true, only preview what would be deleted
 */
function clearCacheOlderThanCommand(timeStr, dryRun = false) {
  const mode = dryRun ? '[DRY RUN - PREVIEW ONLY]' : '';
  console.log(`\n🧹 Clearing cache entries older than specified time... ${mode}`);
  console.log(`   Time threshold: ${timeStr}`);
  
  // Get stats before clearing
  const statsBefore = getCacheStats();
  console.log(`   Current cache size: ${statsBefore.size} entries`);
  
  if (statsBefore.size === 0) {
    console.log('   Cache is already empty.\n');
    return;
  }
  
  // Clear cache older than time (or preview)
  const result = clearCacheOlderThan(timeStr, dryRun);
  
  // Check for error
  if (result.error) {
    console.log(`\n❌ Error: ${result.error}`);
    console.log('   Examples: 1h (1 hour), 30m (30 minutes), 2d (2 days), 60s (60 seconds)');
    console.log();
    return;
  }
  
  if (result.cleared === 0) {
    console.log(`\n⚠️  No cache entries older than ${timeStr}`);
    console.log();
    return;
  }
  
  // Show what was cleared
  console.log(`\n   ${dryRun ? 'Would delete' : 'Deleted'} entries:`);
  result.keys.slice(0, 10).forEach((key, index) => {
    console.log(`     ${index + 1}. ${key}`);
  });
  if (result.cleared > 10) {
    console.log(`     ... and ${result.cleared - 10} more`);
  }
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN: ${result.cleared} ${result.cleared === 1 ? 'entry' : 'entries'} would be removed`);
    console.log(`   ${statsBefore.size - result.cleared} entries would remain`);
    console.log(`   💡 Run without --dry-run to actually delete these entries`);
  } else {
    console.log(`\n✅ Cache cleared successfully!`);
    console.log(`   ${result.cleared} ${result.cleared === 1 ? 'entry' : 'entries'} removed`);
    console.log(`   ${statsBefore.size - result.cleared} entries remaining`);
  }
  console.log();
}

/**
 * Show cache statistics and analytics
 */
function showCacheStats() {
  console.log('\n📊 Cache Statistics & Analytics\n');
  console.log('═'.repeat(60));
  
  // Get analytics stats
  const stats = getStats();
  
  // Get current cache stats
  const cacheStats = getCacheStats();
  
  // Overall Statistics
  console.log('\n📈 Overall Performance:');
  console.log(`   Total Requests:   ${stats.totalRequests.toLocaleString()}`);
  console.log(`   Cache Hits:       ${stats.totalHits.toLocaleString()} (${stats.hitRate}%)`);
  console.log(`   Cache Misses:     ${stats.totalMisses.toLocaleString()} (${stats.missRate}%)`);
  if (stats.totalRevalidations > 0) {
    console.log(`   Revalidations:    ${stats.totalRevalidations.toLocaleString()} (304 Not Modified) 🔄`);
  }
  console.log(`   Hit Rate:         ${stats.hitRate}% 🎯`);
  console.log(`   Uptime:           ${stats.uptime}`);
  
  // Cache Storage
  console.log(`\n💾 Cache Storage:`);
  console.log(`   Current Entries:  ${cacheStats.size.toLocaleString()}`);
  
  // Calculate cache size in KB/MB
  let cacheSizeBytes = 0;
  if (cacheStats.size > 0) {
    const fs = require('fs');
    const path = require('path');
    const cacheFile = path.join(__dirname, '..', 'cache', 'cache-data.json');
    if (fs.existsSync(cacheFile)) {
      const fileStats = fs.statSync(cacheFile);
      cacheSizeBytes = fileStats.size;
    }
  }
  
  let cacheSizeStr;
  if (cacheSizeBytes > 1024 * 1024) {
    cacheSizeStr = `${(cacheSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (cacheSizeBytes > 1024) {
    cacheSizeStr = `${(cacheSizeBytes / 1024).toFixed(2)} KB`;
  } else {
    cacheSizeStr = `${cacheSizeBytes} bytes`;
  }
  
  console.log(`   Cache File Size:  ${cacheSizeStr}`);
  
  // Performance Metrics
  if (stats.performance && stats.performance.hitCount > 0 || stats.performance.missCount > 0) {
    console.log(`\n⚡ Performance Metrics:`);
    
    if (stats.performance.hitCount > 0) {
      console.log(`   Avg Cache Hit Time:   ${stats.performance.avgHitTime}ms 🚀`);
    }
    
    if (stats.performance.missCount > 0) {
      console.log(`   Avg Cache Miss Time:  ${stats.performance.avgMissTime}ms`);
    }
    
    if (stats.performance.hitCount > 0 && stats.performance.missCount > 0) {
      const speedup = (stats.performance.avgMissTime / stats.performance.avgHitTime).toFixed(2);
      console.log(`   Cache Speedup:        ${speedup}x faster ⚡`);
    }
    
    if (stats.performance.bandwidthSaved > 0) {
      console.log(`   Bandwidth Saved:      ${stats.performance.bandwidthSavedStr} 💾`);
    }
  }
  
  // Top URLs
  if (stats.topUrls.length > 0) {
    console.log(`\n🔥 Top 10 Most Accessed URLs:`);
    console.log('   ' + '─'.repeat(56));
    stats.topUrls.forEach((urlStat, index) => {
      const shortUrl = urlStat.url.length > 40 ? urlStat.url.substring(0, 37) + '...' : urlStat.url;
      console.log(`   ${(index + 1).toString().padStart(2)}. ${shortUrl}`);
      console.log(`       Hits: ${urlStat.hits} | Misses: ${urlStat.misses} | Total: ${urlStat.total} | Hit Rate: ${urlStat.hitRate}%`);
    });
  } else {
    console.log(`\n🔥 Top URLs: No data yet (server hasn't received requests)`);
  }
  
  // Performance Summary
  console.log(`\n✨ Summary:`);
  if (stats.hitRate >= 80) {
    console.log(`   🎉 Excellent cache performance! (${stats.hitRate}% hit rate)`);
  } else if (stats.hitRate >= 50) {
    console.log(`   👍 Good cache performance (${stats.hitRate}% hit rate)`);
  } else if (stats.hitRate >= 25) {
    console.log(`   ⚠️  Moderate cache performance (${stats.hitRate}% hit rate)`);
  } else if (stats.totalRequests > 0) {
    console.log(`   ⚠️  Low cache performance (${stats.hitRate}% hit rate)`);
  } else {
    console.log(`   ℹ️  No requests processed yet`);
  }
  
  // Compression Statistics
  if (stats.compression && stats.compression.totalEntries > 0) {
    console.log(`\n🗜️  Compression Statistics:`);
    
    // Format space saved
    let spaceSavedStr;
    const spaceSavedBytes = stats.compression.spaceSaved;
    if (spaceSavedBytes > 1024 * 1024) {
      spaceSavedStr = `${(spaceSavedBytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (spaceSavedBytes > 1024) {
      spaceSavedStr = `${(spaceSavedBytes / 1024).toFixed(2)} KB`;
    } else {
      spaceSavedStr = `${spaceSavedBytes} bytes`;
    }
    
    console.log(`   Compression Ratio:    ${stats.compression.compressionRatio}% saved 📦`);
    console.log(`   Space Saved:          ${spaceSavedStr}`);
    console.log(`   Entries Compressed:   ${stats.compression.entriesCompressed} / ${stats.compression.totalEntries}`);
    
    if (stats.compression.methodBreakdown.gzip > 0 || stats.compression.methodBreakdown.brotli > 0) {
      console.log(`   Methods Used:`);
      if (stats.compression.methodBreakdown.gzip > 0) {
        console.log(`     • Gzip:   ${stats.compression.methodBreakdown.gzip} entries`);
      }
      if (stats.compression.methodBreakdown.brotli > 0) {
        console.log(`     • Brotli: ${stats.compression.methodBreakdown.brotli} entries`);
      }
      if (stats.compression.methodBreakdown.none > 0) {
        console.log(`     • None:   ${stats.compression.methodBreakdown.none} entries`);
      }
    }
  }
  
  // Bandwidth Statistics
  if (stats.bandwidth) {
    console.log(`\n📡 Bandwidth Statistics:`);
    console.log(`   Total Downloaded:     ${stats.bandwidth.totalBytesFromOriginStr} (from origin)`);
    console.log(`   Total Served:         ${stats.bandwidth.totalBytesServedStr} (to clients)`);
    console.log(`   Total Saved:          ${stats.bandwidth.totalBytesSavedStr} 💰`);
    
    if (stats.totalRevalidations > 0) {
      console.log(`   Saved by 304:         ${stats.bandwidth.bytesSavedBy304Str} 🔄`);
      console.log(`   Revalidations:        ${stats.totalRevalidations} (${stats.bandwidth.revalidationCount} successful)`);
      
      if (stats.performance.revalidationCount > 0) {
        console.log(`   Avg Revalidation:     ${stats.performance.avgRevalidationTime}ms`);
      }
    }
    
    if (stats.bandwidth.totalBytesServed > 0 && stats.bandwidth.bandwidthEfficiency > 0) {
      console.log(`   Bandwidth Efficiency: ${stats.bandwidth.bandwidthEfficiency}% reduction 🎯`);
    }
  }
  
  // Per-Origin Statistics (for multi-origin routing)
  if (stats.originStats && stats.originStats.length > 0) {
    console.log(`\n🗺️  Per-Origin Statistics:`);
    console.log('   ' + '─'.repeat(56));
    stats.originStats.forEach((originStat, index) => {
      const shortOrigin = originStat.origin.length > 40 ? originStat.origin.substring(0, 37) + '...' : originStat.origin;
      console.log(`   ${(index + 1).toString().padStart(2)}. ${shortOrigin}`);
      console.log(`       Hits: ${originStat.hits} | Misses: ${originStat.misses} | Revalidations: ${originStat.revalidations}`);
      console.log(`       Total Requests: ${originStat.total} | Hit Rate: ${originStat.hitRate}%`);
      console.log(`       Downloaded: ${originStat.bytesFromOriginStr} | Served: ${originStat.bytesServedStr}`);
    });
  }
  
  // Origin Health Status
  try {
    const fs = require('fs');
    const path = require('path');
    const healthMetricsFile = path.join(__dirname, '..', 'cache', 'health-metrics.json');
    
    if (fs.existsSync(healthMetricsFile)) {
      const healthData = fs.readFileSync(healthMetricsFile, 'utf8');
      const healthStatuses = JSON.parse(healthData);
      const origins = Object.keys(healthStatuses);
      
      if (origins.length > 0) {
        console.log(`\n🏥 Origin Health Status:`);
        console.log('   ' + '─'.repeat(56));
        
        origins.forEach((origin) => {
          const health = healthStatuses[origin];
          const shortOrigin = origin.length > 40 ? origin.substring(0, 37) + '...' : origin;
          const statusIcon = health.status === 'healthy' ? '✅' : health.status === 'unhealthy' ? '❌' : '❓';
          const statusText = health.status.toUpperCase();
          
          console.log(`   ${statusIcon} ${shortOrigin}`);
          console.log(`      Status: ${statusText}`);
          
          if (health.lastCheck) {
            const lastCheckDate = new Date(health.lastCheck);
            const timeSinceCheck = Math.floor((Date.now() - health.lastCheck) / 1000);
            console.log(`      Last Check: ${timeSinceCheck}s ago (${lastCheckDate.toLocaleTimeString()})`);
          }
          
          if (health.responseTime !== undefined) {
            console.log(`      Response Time: ${health.responseTime}ms`);
          }
          
          if (health.totalChecks > 0) {
            console.log(`      Checks: ${health.totalChecks} (${health.totalFailures} failures)`);
            console.log(`      Uptime: ${health.uptimePercentage}%`);
          }
          
          if (health.consecutiveFailures > 0) {
            console.log(`      ⚠️  Consecutive Failures: ${health.consecutiveFailures}`);
          }
          
          if (health.lastError) {
            console.log(`      Last Error: ${health.lastError}`);
          }
          
          console.log('');
        });
      }
    }
  } catch (error) {
    // Health metrics file not available or error loading
  }
  
  // Rate Limit Metrics
  try {
    const { getRateLimitMetrics } = require('./rateLimit');
    const rateLimitMetrics = getRateLimitMetrics();
    
    // Show metrics if there are any events (regardless of current enabled state)
    if (rateLimitMetrics.totalEvents > 0) {
      console.log(`\n🛡️  Rate Limit Metrics:`);
      console.log(`   Total Events:         ${rateLimitMetrics.totalEvents.toLocaleString()}`);
      
      if (rateLimitMetrics.totalRateLimited > 0) {
        console.log(`   Rate Limited:         ${rateLimitMetrics.totalRateLimited.toLocaleString()} requests blocked`);
        console.log(`   Unique IPs Limited:   ${rateLimitMetrics.uniqueIPsRateLimited}`);
        
        // Show limit type breakdown
        const types = [];
        if (rateLimitMetrics.limitTypes.perMinute > 0) {
          types.push(`${rateLimitMetrics.limitTypes.perMinute} per-minute`);
        }
        if (rateLimitMetrics.limitTypes.perHour > 0) {
          types.push(`${rateLimitMetrics.limitTypes.perHour} per-hour`);
        }
        if (rateLimitMetrics.limitTypes.global > 0) {
          types.push(`${rateLimitMetrics.limitTypes.global} global`);
        }
        if (types.length > 0) {
          console.log(`   Limit Types:          ${types.join(', ')}`);
        }
      }
      
      if (rateLimitMetrics.totalWhitelisted > 0) {
        console.log(`   Whitelisted:          ${rateLimitMetrics.totalWhitelisted.toLocaleString()} requests bypassed`);
        console.log(`   Unique IPs Whitelisted: ${rateLimitMetrics.uniqueIPsWhitelisted}`);
      }
      
      if (rateLimitMetrics.totalBlacklisted > 0) {
        console.log(`   Blacklisted:          ${rateLimitMetrics.totalBlacklisted.toLocaleString()} requests blocked`);
        console.log(`   Unique IPs Blacklisted: ${rateLimitMetrics.uniqueIPsBlacklisted}`);
      }
      
      // Top rate limited IPs
      if (rateLimitMetrics.topRateLimitedIPs.length > 0) {
        console.log(`\n   Top Rate Limited IPs:`);
        rateLimitMetrics.topRateLimitedIPs.slice(0, 5).forEach((entry, index) => {
          console.log(`     ${index + 1}. ${entry.ip}: ${entry.count} times`);
        });
      }
    }
  } catch (e) {
    // Rate limiting module not available or error
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log();
}

/**
 * Show detailed list of all cached URLs
 */
function showCacheList() {
  console.log('\n📋 Cached URLs List\n');
  console.log('═'.repeat(80));
  
  // Get current cache
  const cacheStats = getCacheStats();
  
  if (cacheStats.size === 0) {
    console.log('\n   ℹ️  Cache is empty. No URLs cached yet.\n');
    console.log('═'.repeat(80));
    console.log();
    return;
  }
  
  // Load cache data to get details
  const fs = require('fs');
  const path = require('path');
  const cacheFile = path.join(__dirname, '..', 'cache', 'cache-data.json');
  
  if (!fs.existsSync(cacheFile)) {
    console.log('\n   ℹ️  Cache file not found.\n');
    console.log('═'.repeat(80));
    console.log();
    return;
  }
  
  const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const entries = Object.entries(cacheData);
  
  console.log(`\n   Total Cached Entries: ${entries.length}\n`);
  
  // Sort by cache time (newest first)
  entries.sort((a, b) => b[1].cachedAt - a[1].cachedAt);
  
  entries.forEach(([key, value], index) => {
    const now = Date.now();
    const cachedAt = new Date(value.cachedAt);
    const expiresAt = new Date(value.expiresAt);
    const timeUntilExpiry = expiresAt - now;
    const isExpired = timeUntilExpiry <= 0;
    
    // Calculate TTL remaining
    let ttlStr;
    if (isExpired) {
      ttlStr = '❌ EXPIRED';
    } else {
      const minutes = Math.floor(timeUntilExpiry / 60000);
      const seconds = Math.floor((timeUntilExpiry % 60000) / 1000);
      ttlStr = `${minutes}m ${seconds}s`;
    }
    
    // Calculate entry size
    const entrySize = JSON.stringify(value).length;
    let sizeStr;
    if (entrySize > 1024) {
      sizeStr = `${(entrySize / 1024).toFixed(2)} KB`;
    } else {
      sizeStr = `${entrySize} bytes`;
    }
    
    // Parse URL for display
    let displayUrl = key;
    if (key.length > 60) {
      displayUrl = key.substring(0, 57) + '...';
    }
    
    console.log(`   ${(index + 1).toString().padStart(2)}. ${displayUrl}`);
    console.log(`       Status: ${value.statusCode}`);
    console.log(`       Size: ${sizeStr}`);
    console.log(`       Cached: ${cachedAt.toLocaleString()}`);
    console.log(`       Expires: ${expiresAt.toLocaleString()}`);
    console.log(`       TTL Remaining: ${ttlStr}`);
    console.log(`       Content-Type: ${value.headers['content-type'] || 'N/A'}`);
    console.log();
  });
  
  // Summary
  const expired = entries.filter(([key, value]) => Date.now() > value.expiresAt).length;
  const active = entries.length - expired;
  
  console.log('   ' + '─'.repeat(76));
  console.log(`   Summary: ${active} active, ${expired} expired`);
  
  if (expired > 0) {
    console.log(`   💡 Tip: Expired entries will be auto-removed on next access`);
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log();
}

/**
 * Warm the cache by pre-fetching URLs from a file
 * @param {string} filePath - Path to file containing URLs (one per line)
 * @param {string} originUrl - Origin server URL
 */
async function warmCacheCommand(filePath, originUrl) {
  console.log('\n🔥 Cache Warming\n');
  console.log('═'.repeat(60));
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Error: File not found: ${filePath}`);
    console.log('   Make sure the file path is correct.\n');
    process.exit(1);
  }
  
  // Validate origin URL
  let originUrlObj;
  try {
    originUrlObj = new URL(originUrl);
  } catch (error) {
    console.error(`\n❌ Error: Invalid origin URL: ${originUrl}`);
    console.log('   Example: https://api.com\n');
    process.exit(1);
  }
  
  console.log(`\n📁 Reading URLs from: ${filePath}`);
  console.log(`🌐 Origin server: ${originUrl}\n`);
  
  // Read and parse URLs from file
  let urls = [];
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    urls = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // Filter empty lines and comments
  } catch (error) {
    console.error(`\n❌ Error reading file: ${error.message}\n`);
    process.exit(1);
  }
  
  if (urls.length === 0) {
    console.log('⚠️  No URLs found in file.\n');
    return;
  }
  
  console.log(`📋 Found ${urls.length} URL${urls.length === 1 ? '' : 's'} to warm\n`);
  
  // Statistics
  const stats = {
    total: urls.length,
    success: 0,
    failed: 0,
    cached: 0,
    notCached: 0,
    startTime: Date.now()
  };
  
  // Fetch each URL sequentially
  for (let i = 0; i < urls.length; i++) {
    const urlPath = urls[i];
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${originUrl}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
    const progress = `[${i + 1}/${urls.length}]`;
    
    process.stdout.write(`${progress} Fetching: ${urlPath} ... `);
    
    try {
      const result = await fetchAndCache(fullUrl, originUrl);
      
      if (result.success) {
        stats.success++;
        if (result.cached) {
          stats.cached++;
          console.log(`✅ ${result.status} (cached)`);
        } else {
          stats.notCached++;
          console.log(`✅ ${result.status} (not cached: ${result.reason})`);
        }
      } else {
        stats.failed++;
        console.log(`❌ ${result.error}`);
      }
    } catch (error) {
      stats.failed++;
      console.log(`❌ ${error.message}`);
    }
  }
  
  // Calculate timing
  const duration = Date.now() - stats.startTime;
  const durationSec = (duration / 1000).toFixed(2);
  
  // Display summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Cache Warming Summary\n');
  console.log(`   Total URLs:        ${stats.total}`);
  console.log(`   Successful:        ${stats.success} ✅`);
  console.log(`   Failed:            ${stats.failed} ❌`);
  console.log(`   Cached:            ${stats.cached} 💾`);
  console.log(`   Not Cached:        ${stats.notCached}`);
  console.log(`   Duration:          ${durationSec}s`);
  
  if (stats.success > 0) {
    const avgTime = (duration / stats.success).toFixed(0);
    console.log(`   Avg Time per URL:  ${avgTime}ms`);
  }
  
  console.log('\n' + '═'.repeat(60));
  
  if (stats.success === stats.total) {
    console.log('\n✅ Cache warming completed successfully!\n');
  } else {
    console.log(`\n⚠️  Cache warming completed with ${stats.failed} error(s)\n`);
  }
}

/**
 * Fetch a URL and cache the response
 * @param {string} fullUrl - Full URL to fetch
 * @param {string} originUrl - Origin base URL
 * @returns {Promise<Object>} - Result object { success, status, cached, reason, error }
 */
function fetchAndCache(fullUrl, originUrl) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(fullUrl);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'CachingProxy/1.0 (Cache Warming)',
        }
      };
      
      const req = protocol.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          const statusCode = res.statusCode;
          
          // Check if response should be cached (2xx status codes only)
          if (statusCode >= 200 && statusCode < 300) {
            // Prepare response data
            const responseData = {
              statusCode: statusCode,
              headers: res.headers,
              body: body
            };
            
            // Check if it's cacheable
            const cacheControl = res.headers['cache-control'] || '';
            const hasCacheControl = cacheControl.includes('no-store') || 
                                   cacheControl.includes('no-cache') || 
                                   cacheControl.includes('private');
            
            if (hasCacheControl) {
              resolve({
                success: true,
                status: statusCode,
                cached: false,
                reason: 'Cache-Control header'
              });
            } else {
              // Cache the response
              setCachedResponse('GET', fullUrl, responseData, false, cacheControl, null, options.headers);
              
              resolve({
                success: true,
                status: statusCode,
                cached: true
              });
            }
          } else {
            resolve({
              success: true,
              status: statusCode,
              cached: false,
              reason: `Status ${statusCode}`
            });
          }
        });
      });
      
      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Timeout'
        });
      });
      
      req.end();
    } catch (error) {
      resolve({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = {
  startServer,
  clearCache: clearCacheCommand,
  clearCachePattern: clearCachePatternCommand,
  clearCacheURL: clearCacheURLCommand,
  clearCacheOlderThan: clearCacheOlderThanCommand,
  warmCache: warmCacheCommand,
  showCacheStats,
  showCacheList,
  validatePort,
  validateOrigin
};

