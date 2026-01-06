#!/usr/bin/env node

/**
 * Caching Proxy Server - Entry Point
 * A CLI tool that forwards requests to an origin server and caches responses
 */

const { program } = require('commander');
const { startServer, clearCache, showCacheStats, showCacheList, clearCachePattern, clearCacheURL, clearCacheOlderThan, warmCache } = require('./cli');
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
  .option('--version-tag <string>', 'Cache version tag for versioning support (e.g., "v1", "v2.0", "2024-01")')
  .option('--log-level <level>', 'Set log level: debug, info, warn, error (default: info)')
  .option('--https', 'Enable HTTPS server')
  .option('--cert <path>', 'Path to SSL certificate file (required with --https)')
  .option('--key <path>', 'Path to SSL private key file (required with --https)')
  .option('--http-port <number>', 'HTTP port for dual HTTP/HTTPS mode (runs both servers simultaneously)')
  .option('--clear-cache', 'Clear the cache')
  .option('--clear-cache-pattern <pattern>', 'Clear cache entries matching pattern (e.g., "/products/*")')
  .option('--clear-cache-url <url>', 'Clear cache entry for specific URL (e.g., "https://api.com/products/1")')
  .option('--clear-cache-older-than <time>', 'Clear cache entries older than specified time (e.g., "1h", "30m", "2d")')
  .option('--dry-run', 'Preview what would be deleted without actually deleting (use with clear-cache commands)')
  .option('--warm-cache <file>', 'Pre-populate cache with URLs from file')
  .option('--cache-stats', 'Show cache statistics and analytics')
  .option('--cache-list', 'List all cached URLs with details');

// Parse arguments
program.parse(process.argv);

const options = program.opts();

// Handle commands
if (options.clearCache) {
  clearCache(options.dryRun);
} else if (options.clearCachePattern) {
  clearCachePattern(options.clearCachePattern, options.dryRun);
} else if (options.clearCacheUrl) {
  clearCacheURL(options.clearCacheUrl, options.dryRun);
} else if (options.clearCacheOlderThan) {
  clearCacheOlderThan(options.clearCacheOlderThan, options.dryRun);
} else if (options.warmCache) {
  // Warm cache requires origin URL
  if (!options.origin && !options.config) {
    console.error('\n❌ Error: --warm-cache requires --origin or --config\n');
    console.log('Usage: caching-proxy --warm-cache <file> --origin <url>');
    console.log('Example: caching-proxy --warm-cache urls.txt --origin https://api.com\n');
    process.exit(1);
  }
  
  // Load config if provided, otherwise use CLI origin
  let originUrl = options.origin;
  if (options.config) {
    const config = loadConfig({ configPath: options.config, cliArgs: { origin: options.origin } });
    originUrl = config.server.origin;
  }
  
  warmCache(options.warmCache, originUrl);
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
      logLevel: options.logLevel,
      versionTag: options.versionTag,
      https: options.https,
      certPath: options.cert,
      keyPath: options.key,
      httpPort: options.httpPort
    }
  });
  
  // Start server with configuration
  // Pass null for origin if using multi-origin routing
  const origin = config.origins ? null : config.server.origin;
  startServer(config.server.port, origin, config);
} else {
  // Show help if no valid options provided
  console.error('\n❌ Error: Missing required arguments\n');
  console.log('Usage:');
  console.log('  Start server:   caching-proxy --port <number> --origin <url> [--version-tag <string>] [--log-level <level>]');
  console.log('  Use config:     caching-proxy --config <path>');
  console.log('  Clear cache:    caching-proxy --clear-cache');
  console.log('  Cache stats:    caching-proxy --cache-stats');
  console.log('  Cache list:     caching-proxy --cache-list\n');
  console.log('Examples:');
  console.log('  caching-proxy --port 3000 --origin http://dummyjson.com');
  console.log('  caching-proxy --port 3000 --origin http://dummyjson.com --version-tag v1');
  console.log('  caching-proxy --port 3000 --origin http://dummyjson.com --log-level debug');
  console.log('  caching-proxy --config proxy.config.json');
  console.log('  caching-proxy --config proxy.config.json --version-tag v2.0');
  console.log('  caching-proxy --clear-cache');
  console.log('  caching-proxy --cache-stats');
  console.log('  caching-proxy --cache-list\n');
  process.exit(1);
}

