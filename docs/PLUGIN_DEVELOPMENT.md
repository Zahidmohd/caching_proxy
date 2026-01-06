# Plugin Development Guide

## Overview

The Caching Proxy Plugin System allows you to extend the proxy's functionality without modifying the core code. Plugins can intercept and modify requests/responses at every stage of the request lifecycle.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Plugin Structure](#plugin-structure)
3. [Lifecycle Hooks](#lifecycle-hooks)
4. [Configuration](#configuration)
5. [Context Objects](#context-objects)
6. [Best Practices](#best-practices)
7. [Example Plugins](#example-plugins)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Create a Plugin File

Create a new JavaScript file in the `plugins/` directory:

```javascript
// plugins/my-plugin.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',
  
  onServerStart: async (context, config) => {
    console.log('[MyPlugin] Server started!');
  },
  
  beforeRequest: async (context, config) => {
    console.log(`[MyPlugin] Request: ${context.request.method} ${context.request.url}`);
  }
};
```

### 2. Configure the Plugin

Add your plugin to `proxy.config.json`:

```json
{
  "plugins": [
    {
      "name": "my-plugin",
      "path": "./plugins/my-plugin.js",
      "enabled": true,
      "config": {
        "customOption": "value"
      }
    }
  ]
}
```

### 3. Start the Server

```bash
caching-proxy --config proxy.config.json
```

---

## Plugin Structure

A plugin is a JavaScript module that exports an object with the following structure:

```javascript
module.exports = {
  // Required: Plugin metadata
  name: 'plugin-name',           // Unique identifier
  version: '1.0.0',               // Semantic version
  description: 'Plugin description',
  
  // Optional: Lifecycle hooks (implement only what you need)
  onServerStart: async (context, config) => { /* ... */ },
  beforeRequest: async (context, config) => { /* ... */ },
  afterRequest: async (context, config) => { /* ... */ },
  onCacheHit: async (context, config) => { /* ... */ },
  onCacheMiss: async (context, config) => { /* ... */ },
  onCacheStore: async (context, config) => { /* ... */ },
  onError: async (context, config) => { /* ... */ },
  onServerStop: async (context, config) => { /* ... */ }
};
```

### Key Points

- **All hooks are optional** - Only implement what you need
- **Hooks are async** - Use `async/await` for asynchronous operations
- **Return values** - You can return modified context objects
- **Error handling** - Plugin errors are isolated (won't crash the server)

---

## Lifecycle Hooks

### 1. onServerStart

Called when the server starts listening for connections.

**When to use:**
- Initialize plugin resources
- Set up connections to external services
- Log startup information

**Context:**
```javascript
{
  server: serverInstance,     // HTTP/HTTPS server instance
  config: serverConfig,        // Full server configuration
  port: 3000,                  // Server port
  origin: 'https://api.com',   // Origin URL (or null for multi-origin)
  protocol: 'http' | 'https' | 'dual'  // Server protocol
}
```

**Example:**
```javascript
onServerStart: async (context, config) => {
  console.log(`[MyPlugin] Server started on port ${context.port}`);
  console.log(`[MyPlugin] Proxying to: ${context.origin}`);
  
  // Initialize your plugin resources
  await initializeDatabase();
  await connectToMetricsService();
}
```

---

### 2. beforeRequest

Called before processing each incoming request.

**When to use:**
- Modify request headers
- Add authentication
- Log incoming requests
- Validate requests
- Add custom tracking headers

**Context:**
```javascript
{
  request: {
    method: 'GET',               // HTTP method
    url: 'https://api.com/data', // Full URL
    headers: { /* ... */ },      // Request headers
    body: null                   // Request body (for POST/PUT)
  },
  requestId: '1234567890-abc',   // Unique request ID
  clientIP: '192.168.1.1'        // Client IP address
}
```

**Return:** Modified context (optional)

**Example:**
```javascript
beforeRequest: async (context, config) => {
  // Add custom authentication header
  const modifiedHeaders = {
    ...context.request.headers,
    'X-API-Key': config.apiKey,
    'X-Custom-Header': 'value'
  };
  
  // Return modified context
  return {
    request: {
      ...context.request,
      headers: modifiedHeaders
    }
  };
}
```

---

### 3. afterRequest

Called after the request completes and response is sent to the client.

**When to use:**
- Log responses
- Track performance metrics
- Send data to analytics services
- Audit completed requests

**Context:**
```javascript
{
  request: {
    method: 'GET',
    url: 'https://api.com/data',
    headers: { /* ... */ }
  },
  response: {
    statusCode: 200,
    headers: { /* ... */ },
    body: '...'                  // Response body
  },
  requestId: '1234567890-abc',
  responseTime: 150,             // Response time in milliseconds
  cacheStatus: 'HIT' | 'MISS' | 'REVALIDATED'
}
```

**Example:**
```javascript
afterRequest: async (context, config) => {
  // Log response
  console.log(`[${context.requestId}] ${context.request.method} ${context.request.url} - ${context.response.statusCode} - ${context.cacheStatus} (${context.responseTime}ms)`);
  
  // Send to metrics service
  await sendMetrics({
    url: context.request.url,
    status: context.response.statusCode,
    responseTime: context.responseTime,
    cacheStatus: context.cacheStatus
  });
}
```

---

### 4. onCacheHit

Called when a request is served from cache.

**When to use:**
- Track cache hits
- Log cached responses
- Collect cache performance metrics

**Context:**
```javascript
{
  cacheKey: 'GET:https://api.com/data',
  cachedEntry: {
    statusCode: 200,
    headers: { /* ... */ },
    body: '...',
    cachedAt: 1234567890,
    expiresAt: 1234567990
  },
  requestId: '1234567890-abc',
  url: 'https://api.com/data',
  method: 'GET'
}
```

**Example:**
```javascript
onCacheHit: async (context, config) => {
  const age = Date.now() - context.cachedEntry.cachedAt;
  console.log(`[Cache] HIT - ${context.url} (age: ${age}ms)`);
  
  // Track cache hit metrics
  await incrementCounter('cache.hits');
}
```

---

### 5. onCacheMiss

Called when a request is not found in cache and must be forwarded to the origin.

**When to use:**
- Track cache misses
- Log cache misses for optimization
- Collect cache performance metrics

**Context:**
```javascript
{
  cacheKey: 'GET:https://api.com/data',
  requestId: '1234567890-abc',
  url: 'https://api.com/data',
  method: 'GET'
}
```

**Example:**
```javascript
onCacheMiss: async (context, config) => {
  console.log(`[Cache] MISS - ${context.url}`);
  
  // Track cache miss metrics
  await incrementCounter('cache.misses');
  
  // Log for cache optimization analysis
  await logCacheMiss({
    url: context.url,
    timestamp: Date.now()
  });
}
```

---

### 6. onCacheStore

Called when a response is being stored in the cache.

**When to use:**
- Track what gets cached
- Log cache storage events
- Validate cached content
- Implement custom cache policies

**Context:**
```javascript
{
  cacheKey: 'GET:https://api.com/data',
  response: {
    statusCode: 200,
    headers: { /* ... */ },
    body: '...'
  },
  ttl: 300000,                   // TTL in milliseconds
  requestId: '1234567890-abc'
}
```

**Example:**
```javascript
onCacheStore: async (context, config) => {
  const sizeKB = Buffer.byteLength(context.response.body) / 1024;
  console.log(`[Cache] STORE - ${context.cacheKey} (${sizeKB.toFixed(2)} KB, TTL: ${context.ttl}ms)`);
  
  // Track cache storage
  await trackCacheStorage({
    key: context.cacheKey,
    size: sizeKB,
    ttl: context.ttl
  });
}
```

---

### 7. onError

Called when an error occurs during request processing.

**When to use:**
- Log errors
- Send error alerts
- Track error rates
- Implement custom error recovery

**Context:**
```javascript
{
  error: Error,                  // The error object
  request: {
    method: 'GET',
    url: 'https://api.com/data',
    headers: { /* ... */ }
  },
  requestId: '1234567890-abc',
  stage: 'request' | 'response' | 'cache'
}
```

**Example:**
```javascript
onError: async (context, config) => {
  console.error(`[Error] ${context.stage} - ${context.error.message}`);
  console.error(`Request: ${context.request.method} ${context.request.url}`);
  
  // Send error alert
  if (config.alertOnError) {
    await sendAlert({
      message: context.error.message,
      url: context.request.url,
      stage: context.stage
    });
  }
}
```

---

### 8. onServerStop

Called when the server is shutting down.

**When to use:**
- Clean up resources
- Close connections
- Save state
- Log shutdown information

**Context:**
```javascript
{
  server: serverInstance,
  uptime: 3600000,               // Server uptime in milliseconds
  stats: {
    totalRequests: 1000,
    cacheHits: 600,
    cacheMisses: 400
  }
}
```

**Example:**
```javascript
onServerStop: async (context, config) => {
  console.log(`[MyPlugin] Server stopping after ${context.uptime}ms uptime`);
  
  // Clean up resources
  await closeDatabaseConnection();
  await saveState();
}
```

---

## Configuration

### Plugin Configuration Structure

```json
{
  "plugins": [
    {
      "name": "my-plugin",                    // Plugin identifier
      "path": "./plugins/my-plugin.js",       // Path to plugin file
      "enabled": true,                        // Enable/disable flag
      "config": {                             // Plugin-specific config
        "option1": "value1",
        "option2": 123,
        "nested": {
          "key": "value"
        }
      }
    }
  ]
}
```

### Accessing Configuration

The `config` parameter in each hook contains the plugin-specific configuration:

```javascript
beforeRequest: async (context, config) => {
  // Access your plugin config
  const apiKey = config.apiKey;
  const logLevel = config.logLevel || 'info';
  
  if (config.enabled) {
    // Do something
  }
}
```

### Path Resolution

Plugin paths are resolved relative to the project root:

- `./plugins/my-plugin.js` - Relative path
- `/absolute/path/to/plugin.js` - Absolute path
- `../shared-plugins/plugin.js` - Parent directory

---

## Context Objects

### Modifying Context

Some hooks allow you to modify and return the context. This is useful for:
- Adding/removing headers
- Modifying request parameters
- Injecting custom data

**Example:**
```javascript
beforeRequest: async (context, config) => {
  // Modify request headers
  return {
    request: {
      ...context.request,
      headers: {
        ...context.request.headers,
        'X-Custom-Header': 'value'
      }
    }
  };
}
```

### Context Propagation

Modified context is passed to subsequent plugins in the chain:

```
Plugin 1 (beforeRequest) → Modified Context
    ↓
Plugin 2 (beforeRequest) → Further Modified Context
    ↓
Server Processing (uses final context)
```

---

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```javascript
beforeRequest: async (context, config) => {
  try {
    // Your plugin logic
    const result = await someAsyncOperation();
    return result;
  } catch (error) {
    console.error(`[MyPlugin] Error: ${error.message}`);
    // Don't throw - let the request continue
    return context; // Return original context
  }
}
```

### 2. Performance

- **Keep hooks fast** - They run on every request
- **Use async operations** - Don't block the event loop
- **Cache expensive operations** - Store results when possible

```javascript
// ❌ Bad - Synchronous blocking operation
beforeRequest: async (context, config) => {
  const data = fs.readFileSync('/large/file.json'); // Blocks!
}

// ✅ Good - Async non-blocking operation
let cachedData = null;

onServerStart: async (context, config) => {
  // Load once at startup
  cachedData = await fs.promises.readFile('/large/file.json');
}

beforeRequest: async (context, config) => {
  // Use cached data
  if (cachedData) {
    // Process request
  }
}
```

### 3. Logging

Use consistent logging format:

```javascript
beforeRequest: async (context, config) => {
  const logLevel = config.logLevel || 'info';
  
  if (logLevel === 'debug') {
    console.log(`[PluginName] [${context.requestId}] ${context.request.method} ${context.request.url}`);
  }
}
```

### 4. Conditional Logic

Check configuration before executing logic:

```javascript
beforeRequest: async (context, config) => {
  // Skip if disabled
  if (!config.enabled) return;
  
  // Conditional features
  if (config.logRequests) {
    console.log(`Request: ${context.request.url}`);
  }
}
```

### 5. Resource Management

Clean up resources properly:

```javascript
let connection = null;

onServerStart: async (context, config) => {
  connection = await createConnection(config.dbUrl);
}

onServerStop: async (context, config) => {
  if (connection) {
    await connection.close();
    connection = null;
  }
}
```

---

## Example Plugins

### Request Logger Plugin

```javascript
// plugins/request-logger.js
module.exports = {
  name: 'request-logger',
  version: '1.0.0',
  description: 'Logs all requests and responses',
  
  onServerStart: async (context, config) => {
    console.log(`[RequestLogger] Started - Log level: ${config.logLevel}`);
  },
  
  beforeRequest: async (context, config) => {
    const { request, requestId, clientIP } = context;
    console.log(`[${requestId}] ${clientIP} → ${request.method} ${request.url}`);
  },
  
  afterRequest: async (context, config) => {
    const { request, response, requestId, responseTime, cacheStatus } = context;
    console.log(`[${requestId}] ${request.method} ${request.url} → ${response.statusCode} [${cacheStatus}] (${responseTime}ms)`);
  }
};
```

### Metrics Collector Plugin

```javascript
// plugins/metrics.js
const metrics = {
  requests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  errors: 0,
  totalResponseTime: 0
};

module.exports = {
  name: 'metrics',
  version: '1.0.0',
  description: 'Collects performance metrics',
  
  afterRequest: async (context, config) => {
    metrics.requests++;
    metrics.totalResponseTime += context.responseTime;
  },
  
  onCacheHit: async (context, config) => {
    metrics.cacheHits++;
  },
  
  onCacheMiss: async (context, config) => {
    metrics.cacheMisses++;
  },
  
  onError: async (context, config) => {
    metrics.errors++;
  },
  
  // Custom method to export metrics
  getMetrics: () => ({
    ...metrics,
    avgResponseTime: metrics.requests > 0 
      ? metrics.totalResponseTime / metrics.requests 
      : 0,
    cacheHitRate: metrics.requests > 0
      ? (metrics.cacheHits / metrics.requests * 100).toFixed(2) + '%'
      : '0%'
  })
};
```

### Authentication Plugin

```javascript
// plugins/auth.js
module.exports = {
  name: 'auth',
  version: '1.0.0',
  description: 'Adds authentication to requests',
  
  beforeRequest: async (context, config) => {
    const headers = { ...context.request.headers };
    
    // Add API key
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }
    
    // Add Bearer token
    if (config.token) {
      headers['authorization'] = `Bearer ${config.token}`;
    }
    
    return {
      request: {
        ...context.request,
        headers
      }
    };
  }
};
```

---

## Troubleshooting

### Plugin Not Loading

**Check:**
1. Plugin path is correct and file exists
2. Plugin exports an object with valid structure
3. No syntax errors in plugin file
4. Plugin is enabled in configuration

**Debug:**
```bash
# Check server logs
caching-proxy --config config.json

# Look for plugin loading messages:
# ✅ Plugin loaded: plugin-name
# ❌ Failed to load plugin: plugin-name
```

### Plugin Not Executing

**Check:**
1. Plugin has the hook you expect (e.g., `beforeRequest`)
2. Hook function is async
3. Server is receiving requests
4. Plugin is not disabled in configuration

### Plugin Errors

**Check server logs for error messages:**
```
❌ Plugin error in plugin-name.beforeRequest:
   Error message here
```

**Common errors:**
- Undefined variables
- Async/await issues
- Missing dependencies
- Invalid context modifications

### Performance Issues

**Check:**
- Are you blocking the event loop?
- Are you making too many external calls?
- Are you logging too much?

**Profile your plugin:**
```javascript
beforeRequest: async (context, config) => {
  const start = Date.now();
  
  // Your plugin logic
  await doSomething();
  
  const duration = Date.now() - start;
  if (duration > 100) {
    console.warn(`[Plugin] Slow execution: ${duration}ms`);
  }
}
```

---

## Advanced Topics

### Sharing Data Between Hooks

Use module-level variables:

```javascript
let requestCount = 0;
const requestCache = new Map();

module.exports = {
  beforeRequest: async (context, config) => {
    requestCount++;
    requestCache.set(context.requestId, Date.now());
  },
  
  afterRequest: async (context, config) => {
    const startTime = requestCache.get(context.requestId);
    const duration = Date.now() - startTime;
    console.log(`Request took ${duration}ms (Total requests: ${requestCount})`);
    requestCache.delete(context.requestId);
  }
};
```

### Accessing Other Plugins

Not directly supported. Use external state management if needed (database, Redis, etc.).

### Hot Reload

Plugins can be reloaded without restarting the server (when supported):

```javascript
const { getPluginManager } = require('./src/pluginManager');

// Reload a specific plugin
getPluginManager().reloadPlugin('plugin-name');
```

---

## API Reference

### Plugin Manager Functions

```javascript
const { 
  initializePlugins,
  executeHook,
  isPluginSystemEnabled,
  getPluginStats,
  getPluginManager 
} = require('./src/pluginManager');

// Initialize plugins
const stats = initializePlugins(config);

// Check if plugins are enabled
if (isPluginSystemEnabled()) {
  // Execute a hook
  await executeHook('beforeRequest', context);
}

// Get plugin statistics
const stats = getPluginStats();
// Returns: { enabled, totalPlugins, plugins, hookCounts }

// Get manager instance
const manager = getPluginManager();
manager.reloadPlugin('plugin-name');
manager.setPluginEnabled('plugin-name', false);
```

---

## Support

For issues, questions, or contributions:
- Check the [main README](../README.md)
- Review the [project plan](../doc/PROJECT_PLAN.md)
- Examine the [example plugins](../plugins/)

---

## License

Same as the main project.

