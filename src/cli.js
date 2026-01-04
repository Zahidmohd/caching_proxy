/**
 * CLI Handler Functions
 * Handles the main CLI commands with validation
 */

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
  
  // TODO: Implement server start logic in Stage 3
  console.log('⏳ Server implementation coming in Stage 3...\n');
}

/**
 * Clear the cache
 */
function clearCache() {
  console.log('\n🧹 Clearing cache...');
  
  // TODO: Implement cache clearing logic in Stage 6
  console.log('⏳ Cache clearing implementation coming in Stage 6...\n');
}

module.exports = {
  startServer,
  clearCache,
  validatePort,
  validateOrigin
};

