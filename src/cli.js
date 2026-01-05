/**
 * CLI Handler Functions
 * Handles the main CLI commands with validation
 */

const { createProxyServer } = require('./server');
const { clearCache, clearCacheByPattern, clearCacheByURL, getCacheStats } = require('./cache');
const { getStats } = require('./analytics');
const { displayConfigSummary } = require('./config');

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
 * @param {string} origin - Origin server URL
 * @param {Object} config - Optional configuration object
 */
function startServer(port, origin, config = null) {
  // Validate inputs
  const validPort = validatePort(port);
  const validOrigin = validateOrigin(origin);
  
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
}

/**
 * Clear the cache
 */
function clearCacheCommand() {
  console.log('\n🧹 Clearing cache...');
  
  // Get stats before clearing
  const statsBefore = getCacheStats();
  console.log(`   Current cache size: ${statsBefore.size} entries`);
  
  if (statsBefore.size === 0) {
    console.log('   Cache is already empty.\n');
    return;
  }
  
  // Show what's being cleared
  console.log('\n   Cached entries:');
  statsBefore.keys.slice(0, 5).forEach((key, index) => {
    console.log(`     ${index + 1}. ${key}`);
  });
  if (statsBefore.size > 5) {
    console.log(`     ... and ${statsBefore.size - 5} more`);
  }
  
  // Clear the cache
  const clearedCount = clearCache();
  
  console.log(`\n✅ Cache cleared successfully!`);
  console.log(`   ${clearedCount} ${clearedCount === 1 ? 'entry' : 'entries'} removed`);
  
  // Show expired entries info if any
  if (statsBefore.expiredRemoved > 0) {
    console.log(`   (${statsBefore.expiredRemoved} expired entries auto-removed during stats check)`);
  }
  console.log();
}

/**
 * Clear cache entries matching a pattern
 * @param {string} pattern - Pattern with wildcards (e.g., "/products/*")
 */
function clearCachePatternCommand(pattern) {
  console.log('\n🧹 Clearing cache entries matching pattern...');
  console.log(`   Pattern: ${pattern}`);
  
  // Get stats before clearing
  const statsBefore = getCacheStats();
  console.log(`   Current cache size: ${statsBefore.size} entries`);
  
  if (statsBefore.size === 0) {
    console.log('   Cache is already empty.\n');
    return;
  }
  
  // Clear cache by pattern
  const result = clearCacheByPattern(pattern);
  
  if (result.cleared === 0) {
    console.log(`\n⚠️  No cache entries matched the pattern "${pattern}"`);
    console.log();
    return;
  }
  
  // Show what was cleared
  console.log(`\n   Cleared entries:`);
  result.keys.slice(0, 5).forEach((key, index) => {
    console.log(`     ${index + 1}. ${key}`);
  });
  if (result.cleared > 5) {
    console.log(`     ... and ${result.cleared - 5} more`);
  }
  
  console.log(`\n✅ Cache cleared successfully!`);
  console.log(`   ${result.cleared} ${result.cleared === 1 ? 'entry' : 'entries'} removed`);
  console.log(`   ${statsBefore.size - result.cleared} entries remaining`);
  console.log();
}

/**
 * Clear cache entry for a specific URL
 * @param {string} url - Exact URL to clear
 * @param {string} method - HTTP method (default: "GET")
 */
function clearCacheURLCommand(url, method = 'GET') {
  console.log('\n🧹 Clearing cache entry for specific URL...');
  console.log(`   URL: ${url}`);
  console.log(`   Method: ${method}`);
  
  // Get stats before clearing
  const statsBefore = getCacheStats();
  console.log(`   Current cache size: ${statsBefore.size} entries`);
  
  if (statsBefore.size === 0) {
    console.log('   Cache is already empty.\n');
    return;
  }
  
  // Clear cache by URL
  const result = clearCacheByURL(url, method);
  
  if (!result.cleared) {
    console.log(`\n⚠️  No cache entry found for "${method}:${url}"`);
    console.log('   💡 Tip: Make sure the URL includes the protocol (http:// or https://)');
    console.log();
    return;
  }
  
  console.log(`\n   Cleared entry:`);
  console.log(`     ${result.key}`);
  
  console.log(`\n✅ Cache cleared successfully!`);
  console.log(`   1 entry removed`);
  console.log(`   ${statsBefore.size - 1} entries remaining`);
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

module.exports = {
  startServer,
  clearCache: clearCacheCommand,
  clearCachePattern: clearCachePatternCommand,
  clearCacheURL: clearCacheURLCommand,
  showCacheStats,
  showCacheList,
  validatePort,
  validateOrigin
};

