#!/usr/bin/env node

/**
 * Caching Proxy Server - Entry Point
 * A CLI tool that forwards requests to an origin server and caches responses
 */

const { program } = require('commander');
const { startServer, clearCache, showCacheStats, showCacheList } = require('./cli');

// Configure CLI
program
  .name('caching-proxy')
  .description('A caching proxy server that forwards requests and caches responses')
  .version('1.0.0');

// Start server command
program
  .option('-p, --port <number>', 'Port number for the proxy server')
  .option('-o, --origin <url>', 'Origin server URL to forward requests to')
  .option('--clear-cache', 'Clear the cache')
  .option('--cache-stats', 'Show cache statistics and analytics')
  .option('--cache-list', 'List all cached URLs with details');

// Parse arguments
program.parse(process.argv);

const options = program.opts();

// Handle commands
if (options.clearCache) {
  clearCache();
} else if (options.cacheStats) {
  showCacheStats();
} else if (options.cacheList) {
  showCacheList();
} else if (options.port && options.origin) {
  startServer(options.port, options.origin);
} else {
  // Show help if no valid options provided
  console.error('\n❌ Error: Missing required arguments\n');
  console.log('Usage:');
  console.log('  Start server:   caching-proxy --port <number> --origin <url>');
  console.log('  Clear cache:    caching-proxy --clear-cache');
  console.log('  Cache stats:    caching-proxy --cache-stats');
  console.log('  Cache list:     caching-proxy --cache-list\n');
  console.log('Examples:');
  console.log('  caching-proxy --port 3000 --origin http://dummyjson.com');
  console.log('  caching-proxy --clear-cache');
  console.log('  caching-proxy --cache-stats');
  console.log('  caching-proxy --cache-list\n');
  process.exit(1);
}

