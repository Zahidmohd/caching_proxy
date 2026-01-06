n # Configuration File Documentation

## Overview

The caching proxy server supports configuration files in JSON format. This allows you to manage complex settings without long command-line arguments.

---

## Usage

```bash
# Use a configuration file
caching-proxy --config proxy.config.json

# Configuration files can be named anything
caching-proxy --config my-custom-config.json
caching-proxy --config ./configs/production.json
```

**Note**: Command-line arguments override configuration file settings.

---

## Configuration File Structure

### Complete Example: `proxy.config.json`

```json
{
  "name": "Caching Proxy Configuration",
  "version": "1.0.0",
  
  "server": { ... },
  "cache": { ... },
  "security": { ... },
  "logging": { ... },
  "analytics": { ... },
  "performance": { ... },
  "headers": { ... },
  "ssl": { ... },
  "monitoring": { ... }
}
```

---

## Section 1: Server Configuration

Controls basic server settings.

```json
{
  "server": {
    "port": 3000,
    "origin": "https://dummyjson.com",
    "host": "localhost"
  }
}
```

### Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | number | 3000 | Port number for the proxy server |
| `origin` | string | **required** | Origin server URL to forward requests to |
| `host` | string | "localhost" | Host to bind the server to (use "0.0.0.0" for all interfaces) |

### Examples:

```json
// Local development
"server": {
  "port": 3000,
  "origin": "http://localhost:8080",
  "host": "localhost"
}

// Production (all interfaces)
"server": {
  "port": 80,
  "origin": "https://api.example.com",
  "host": "0.0.0.0"
}

// Using environment variables
"server": {
  "port": "${PORT}",
  "origin": "${ORIGIN_URL}",
  "host": "0.0.0.0"
}
```

---

## Section 2: Cache Configuration

Controls caching behavior and strategy.

```json
{
  "cache": {
    "enabled": true,
    "defaultTTL": 300,
    "maxEntries": 1000,
    "maxSizeMB": 100,
    "strategy": "lru",
    "storageDir": "./cache",
    "customTTL": { ... },
    "excludePatterns": [ ... ],
    "cacheControl": { ... }
  }
}
```

### Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable/disable caching |
| `defaultTTL` | number | 300 | Default cache TTL in seconds (5 minutes) |
| `maxEntries` | number | 1000 | Maximum number of cache entries (LRU eviction) |
| `maxSizeMB` | number | 100 | Maximum cache size in megabytes |
| `strategy` | string | "lru" | Eviction strategy: "lru", "lfu", "fifo" |
| `storageDir` | string | "./cache" | Directory for cache storage |

### Custom TTL Per Endpoint:

```json
"customTTL": {
  "/products/*": 600,      // 10 minutes
  "/users/*": 60,          // 1 minute
  "/static/*": 3600,       // 1 hour
  "/api/v1/news/*": 120    // 2 minutes
}
```

**Pattern Matching:**
- `*` matches any characters
- `/products/*` matches `/products/1`, `/products/abc`, etc.
- More specific patterns take precedence

### Exclude Patterns:

```json
"excludePatterns": [
  "/auth/*",      // Don't cache authentication endpoints
  "/admin/*",     // Don't cache admin endpoints
  "/api/private/*"
]
```

### Cache Control Settings:

```json
"cacheControl": {
  "respectOrigin": true,
  "defaultCacheControl": "public, max-age=300"
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `respectOrigin` | boolean | true | Respect Cache-Control headers from origin |
| `defaultCacheControl` | string | null | Default Cache-Control header if origin doesn't provide one |

---

## Section 3: Security Configuration

Security-related settings.

```json
{
  "security": {
    "excludeAuthenticatedRequests": true,
    "allowedOrigins": ["*"],
    "maxRequestSize": "10mb",
    "rateLimit": { ... }
  }
}
```

### Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `excludeAuthenticatedRequests` | boolean | true | Don't cache requests with Authorization headers or cookies |
| `allowedOrigins` | array | ["*"] | CORS allowed origins |
| `maxRequestSize` | string | "10mb" | Maximum request body size |

### Rate Limiting:

```json
"rateLimit": {
  "enabled": true,
  "windowMs": 60000,      // 1 minute window
  "maxRequests": 100,     // Max 100 requests per window
  "perIP": true           // Per IP address
}
```

---

## Section 4: Logging Configuration

Comprehensive logging settings.

```json
{
  "logging": {
    "enabled": true,
    "level": "info",
    "format": "json",
    "destination": "file",
    "files": { ... },
    "rotation": { ... },
    "console": { ... }
  }
}
```

### Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable/disable logging |
| `level` | string | "info" | Log level: "debug", "info", "warn", "error" |
| `format` | string | "json" | Log format: "json", "text" |
| `destination` | string | "file" | Log destination: "file", "console", "both" |

### Log Files:

```json
"files": {
  "access": "./logs/access.log",
  "error": "./logs/error.log",
  "cache": "./logs/cache.log",
  "performance": "./logs/performance.log"
}
```

### Log Rotation:

```json
"rotation": {
  "enabled": true,
  "maxSize": "10mb",   // Rotate when file reaches 10MB
  "maxFiles": 7        // Keep last 7 files
}
```

### Console Logging:

```json
"console": {
  "enabled": true,
  "colorize": true     // Use colors in console output
}
```

---

## Section 5: Analytics Configuration

Analytics and monitoring settings.

```json
{
  "analytics": {
    "enabled": true,
    "file": "./cache/analytics.json",
    "trackPerformance": true,
    "trackBandwidth": true
  }
}
```

### Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable/disable analytics |
| `file` | string | "./cache/analytics.json" | Analytics data file path |
| `trackPerformance` | boolean | true | Track response times |
| `trackBandwidth` | boolean | true | Track bandwidth savings |

---

## Section 6: Performance Configuration

Performance optimization settings.

```json
{
  "performance": {
    "compression": { ... },
    "timeout": { ... }
  }
}
```

### Compression:

```json
"compression": {
  "enabled": true,
  "algorithm": "gzip",    // "gzip" or "brotli"
  "threshold": 1024       // Only compress if > 1KB
}
```

### Timeouts:

```json
"timeout": {
  "request": 30000,      // 30 seconds
  "response": 30000      // 30 seconds
}
```

---

## Section 7: Headers Configuration

Custom headers to add or remove.

```json
{
  "headers": {
    "custom": { ... },
    "removeFromResponse": [ ... ],
    "addToRequest": { ... }
  }
}
```

### Custom Headers:

```json
"custom": {
  "X-Proxy-By": "Caching-Proxy-Server",
  "X-Proxy-Version": "1.0.0",
  "X-Content-Type-Options": "nosniff"
}
```

### Remove Headers:

```json
"removeFromResponse": [
  "X-Powered-By",
  "Server"
]
```

### Add to Requests:

```json
"addToRequest": {
  "X-Forwarded-By": "caching-proxy",
  "User-Agent": "Caching-Proxy/1.0"
}
```

---

## Section 8: SSL Configuration

HTTPS support settings.

```json
{
  "ssl": {
    "enabled": true,
    "cert": "./ssl/cert.pem",
    "key": "./ssl/key.pem",
    "redirectHttp": true
  }
}
```

### Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | false | Enable HTTPS |
| `cert` | string | required | Path to SSL certificate |
| `key` | string | required | Path to SSL private key |
| `redirectHttp` | boolean | false | Redirect HTTP to HTTPS |

---

## Section 9: Monitoring Configuration

Health checks and metrics endpoints.

```json
{
  "monitoring": {
    "healthCheck": { ... },
    "metrics": { ... }
  }
}
```

### Health Check:

```json
"healthCheck": {
  "enabled": true,
  "path": "/__health",
  "interval": 30000      // Check every 30 seconds
}
```

### Metrics:

```json
"metrics": {
  "enabled": true,
  "path": "/__metrics",
  "format": "prometheus"   // "prometheus" or "json"
}
```

---

## Environment Variables

Configuration values can reference environment variables using `${VAR_NAME}` syntax:

```json
{
  "server": {
    "port": "${PORT}",
    "origin": "${ORIGIN_URL}"
  },
  "ssl": {
    "cert": "${SSL_CERT_PATH}",
    "key": "${SSL_KEY_PATH}"
  }
}
```

### .env File Support

Create a `.env` file in the project root:

```env
PORT=3000
ORIGIN_URL=https://api.example.com
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

---

## Example Configurations

### Minimal Configuration

```json
{
  "server": {
    "port": 3000,
    "origin": "https://dummyjson.com"
  },
  "cache": {
    "enabled": true,
    "defaultTTL": 300
  }
}
```

### Development Configuration

```json
{
  "server": {
    "port": 3000,
    "origin": "http://localhost:8080"
  },
  "cache": {
    "defaultTTL": 60,
    "maxEntries": 100
  },
  "logging": {
    "level": "debug",
    "console": {
      "enabled": true,
      "colorize": true
    }
  }
}
```

### Production Configuration

```json
{
  "server": {
    "port": 8080,
    "origin": "${ORIGIN_URL}",
    "host": "0.0.0.0"
  },
  "cache": {
    "defaultTTL": 600,
    "maxEntries": 10000,
    "maxSizeMB": 500
  },
  "security": {
    "rateLimit": {
      "enabled": true,
      "maxRequests": 1000
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "rotation": {
      "enabled": true,
      "maxSize": "50mb"
    }
  },
  "ssl": {
    "enabled": true,
    "cert": "${SSL_CERT_PATH}",
    "key": "${SSL_KEY_PATH}"
  }
}
```

---

## Validation

The configuration file is validated on load:

- **Required fields**: `server.port`, `server.origin`
- **Type checking**: All fields must match expected types
- **Range validation**: Numbers must be within valid ranges
- **Path validation**: File paths must be accessible

### Validation Errors:

```bash
❌ Error: Invalid configuration file
   - server.port must be a number between 1 and 65535
   - cache.defaultTTL must be a positive number
   - ssl.cert file not found: /path/to/cert.pem
```

---

## Priority Order

Settings are applied in this order (later overrides earlier):

1. **Configuration file** (`proxy.config.json`)
2. **Environment variables** (`.env` file)
3. **Command-line arguments** (`--port 3000`)

Example:
```bash
# Config file says port 3000
# Command line overrides to 4000
caching-proxy --config proxy.config.json --port 4000
# Server starts on port 4000
```

---

## Best Practices

### 1. Use Environment Variables for Secrets

```json
{
  "server": {
    "origin": "${API_URL}"
  },
  "ssl": {
    "cert": "${SSL_CERT}",
    "key": "${SSL_KEY}"
  }
}
```

### 2. Separate Configs for Environments

```
configs/
  ├── development.json
  ├── staging.json
  └── production.json
```

### 3. Version Your Configs

```json
{
  "name": "Production Config",
  "version": "2.1.0",
  "lastModified": "2026-01-05"
}
```

### 4. Document Custom Settings

```json
{
  "cache": {
    "customTTL": {
      "/products/*": 600,  // Products change infrequently
      "/users/*": 60       // User data changes often
    }
  }
}
```

---

## Troubleshooting

### Config File Not Found

```bash
❌ Error: Configuration file not found: proxy.config.json
```

**Solution**: Provide full path or ensure file is in current directory.

### Invalid JSON

```bash
❌ Error: Invalid JSON in configuration file
   Unexpected token } in JSON at position 245
```

**Solution**: Use a JSON validator (jsonlint.com) to find syntax errors.

### Environment Variable Not Set

```bash
⚠️  Warning: Environment variable ORIGIN_URL not set
   Using fallback value: http://localhost:8080
```

**Solution**: Set the environment variable or provide a default in config.

---

## See Also

- [README.md](README.md) - General usage guide
- [PROJECT_PLAN.md](doc/PROJECT_PLAN.md) - Project roadmap
- [TESTING.md](doc/TESTING.md) - Testing documentation

