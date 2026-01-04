/**
 * CLI Handler Functions
 * Handles the main CLI commands with validation
 */

const { createProxyServer } = require('./server');
const { clearCache, getCacheStats } = require('./cache');

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
 */
function startServer(port, origin) {
  // Validate inputs
  const validPort = validatePort(port);
  const validOrigin = validateOrigin(origin);
  
  console.log('\n🚀 Starting Caching Proxy Server...');
  console.log(`   Port:   ${validPort}`);
  console.log(`   Origin: ${validOrigin}`);
  console.log('');
  
  // Create and start the proxy server
  createProxyServer(validPort, validOrigin);
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

module.exports = {
  startServer,
  clearCache: clearCacheCommand,
  validatePort,
  validateOrigin
};

