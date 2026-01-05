#!/usr/bin/env node

/**
 * Caching Proxy Server - Entry Point
 * A CLI tool that forwards requests to an origin server and caches responses
 */

const { program } = require('commander');
const { startServer, clearCache, showCacheStats, showCacheList, clearCachePattern, clearCacheURL, clearCacheOlderThan } = require('./cli');
const { loadConfig } = require('./config');

// Configure CLI
program
  .name('caching-proxy')
  .description('A caching proxy server that forwards requests and caches responses')
  .version('1.0.0');

// Start server command
program
  .option('-p, --port <number>', 'Port number for the proxy server')
  .option('-o, --origin <url>', 'Origin server URL to forward requests to')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--log-level <level>', 'Set log level: debug, info, warn, error (default: info)')
  .option('--clear-cache', 'Clear the cache')
  .option('--clear-cache-pattern <pattern>', 'Clear cache entries matching pattern (e.g., "/products/*")')
  .option('--clear-cache-url <url>', 'Clear cache entry for specific URL (e.g., "https://api.com/products/1")')
  .option('--clear-cache-older-than <time>', 'Clear cache entries older than specified time (e.g., "1h", "30m", "2d")')
  .option('--cache-stats', 'Show cache statistics and analytics')
  .option('--cache-list', 'List all cached URLs with details');

// Parse arguments
program.parse(process.argv);

const options = program.opts();

// Handle commands
if (options.clearCache) {
  clearCache();
} else if (options.clearCachePattern) {
  clearCachePattern(options.clearCachePattern);
} else if (options.clearCacheUrl) {
  clearCacheURL(options.clearCacheUrl);
} else if (options.clearCacheOlderThan) {
  clearCacheOlderThan(options.clearCacheOlderThan);
} else if (options.cacheStats) {
  showCacheStats();
} else if (options.cacheList) {
  showCacheList();
} else if (options.config || (options.port && options.origin)) {
  // Load configuration
  const config = loadConfig({
    configPath: options.config,
    cliArgs: {
      port: options.port,
      origin: options.origin,
      logLevel: options.logLevel
    }
  });
  
  // Start server with configuration
  startServer(config.server.port, config.server.origin, config);
} else {
  // Show help if no valid options provided
  console.error('\n❌ Error: Missing required arguments\n');
  console.log('Usage:');
  console.log('  Start server:   caching-proxy --port <number> --origin <url> [--log-level <level>]');
  console.log('  Use config:     caching-proxy --config <path>');
  console.log('  Clear cache:    caching-proxy --clear-cache');
  console.log('  Cache stats:    caching-proxy --cache-stats');
  console.log('  Cache list:     caching-proxy --cache-list\n');
  console.log('Examples:');
  console.log('  caching-proxy --port 3000 --origin http://dummyjson.com');
  console.log('  caching-proxy --port 3000 --origin http://dummyjson.com --log-level debug');
  console.log('  caching-proxy --config proxy.config.json');
  console.log('  caching-proxy --config proxy.config.json --port 4000 --log-level warn');
  console.log('  caching-proxy --clear-cache');
  console.log('  caching-proxy --cache-stats');
  console.log('  caching-proxy --cache-list\n');
  process.exit(1);
}

