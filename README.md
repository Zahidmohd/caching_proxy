# Caching Proxy Server

A production-ready, feature-rich HTTP caching proxy server built with Node.js. This high-performance CLI tool intelligently forwards requests to origin servers, caches responses, and serves subsequent requests instantly from cache - complete with a real-time web dashboard for monitoring.

> **Built from scratch** to understand HTTP caching mechanisms, proxy architecture, and modern web development practices.

## ✨ Key Features

### Core Caching
- ⚡ **Lightning Fast** - Cache HIT responses in <5ms (vs 100-500ms origin requests)
- 💾 **Smart Caching** - Intelligent cache policies respecting HTTP standards
- 🔄 **Cache Headers** - Clear `X-Cache: HIT/MISS/REVALIDATED` indicators
- 📦 **Persistent Storage** - File-based cache survives server restarts
- 🗑️ **LRU Eviction** - Automatic memory management with configurable limits
- ⏱️ **Configurable TTL** - Pattern-based TTL rules for different endpoints

### Advanced Features
- 🔑 **Header-Based Keys** - Cache variants by Accept-Language, User-Agent, etc.
- 🗜️ **Response Compression** - Gzip/Brotli compression for optimized storage
- 🔄 **Conditional Requests** - ETag/Last-Modified support with 304 responses
- 🚦 **Rate Limiting** - IP-based rate limiting with whitelist/blacklist
- 🌐 **Multi-Origin Routing** - Path-based routing to multiple backend services
- 🔐 **HTTPS Support** - Full SSL/TLS with dual HTTP/HTTPS mode
- 🔌 **Plugin System** - Extensible architecture with lifecycle hooks
- 🎯 **Cache Versioning** - API version-specific cache isolation
- 🔧 **Request Transformation** - Custom request/response modification hooks

### Monitoring & Management
- 📊 **Web Dashboard** - Real-time visual monitoring interface
- 📈 **Analytics** - Detailed metrics on cache performance and bandwidth savings
- 🏥 **Health Checks** - Origin server health monitoring
- 📝 **Advanced Logging** - Structured logging with rotation
- 🔥 **Cache Warming** - Pre-populate cache from URL lists
- 🎯 **Flexible Invalidation** - Pattern-based, URL-specific, time-based cache clearing

## 📦 Installation

### Prerequisites
- Node.js v14 or higher
- npm (comes with Node.js)

### Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd caching-proxy

# Install dependencies
npm install

# Make it globally available
npm link

# Start the proxy server
caching-proxy --port 3000 --origin https://dummyjson.com
```

### Alternative: Run Without Global Install

```bash
# Clone and install
git clone <your-repo-url>
cd caching-proxy
npm install

# Run directly
node src/index.js --port 3000 --origin https://dummyjson.com
```

## 🚀 Quick Usage Examples

### Example 1: Basic Usage

```bash
# Start the proxy
caching-proxy --port 3000 --origin https://dummyjson.com

# In another terminal, make requests
curl http://localhost:3000/products/1        # MISS - fetches from origin
curl http://localhost:3000/products/1        # HIT - serves from cache

# Clear cache when needed
caching-proxy --clear-cache
```

### Example 2: With Web Dashboard

```bash
# Start proxy with real-time dashboard
caching-proxy --port 3000 --origin https://dummyjson.com --dashboard 4000

# Open http://localhost:4000 in your browser
# See live metrics, manage cache, view performance stats
```

**Dashboard Features**:
- 📊 Real-time metrics with auto-refresh (every 5 seconds)
- 🎨 Modern dark theme UI with smooth animations
- 🔍 Search and filter cached URLs
- 🗑️ Interactive cache management (delete/clear)
- 📈 Performance charts and bandwidth savings
- 🏥 Origin server health monitoring

### Example 3: Using Configuration File

```bash
# Create config file
cat > proxy.config.json << EOF
{
  "server": {
    "port": 3000,
    "origin": "https://dummyjson.com",
    "dashboardPort": 4000
  },
  "cache": {
    "defaultTTL": 300,
    "maxEntries": 1000,
    "maxSizeMB": 100,
    "cacheKeyHeaders": ["accept-language"]
  },
  "logging": {
    "level": "info",
    "format": "text"
  }
}
EOF

# Start with config
caching-proxy --config proxy.config.json
```

### Example 4: Cache Warming

```bash
# Create a file with URLs to pre-fetch
cat > warm-urls.txt << EOF
/products/1
/products/2
/users/1
/categories
EOF

# Warm the cache
caching-proxy --warm-cache warm-urls.txt --origin https://dummyjson.com
```

### Example 5: Advanced Cache Management

```bash
# View cache statistics
caching-proxy --cache-stats

# List all cached URLs
caching-proxy --cache-list

# Clear cache by pattern
caching-proxy --clear-cache-pattern "/products/*"

# Clear cache older than 1 hour
caching-proxy --clear-cache-older-than 1h

# Preview what would be deleted (dry-run)
caching-proxy --clear-cache-pattern "/api/*" --dry-run
```

## 🔧 How It Works

### Request Flow

```
1. Client Request → Proxy Server
2. Proxy checks cache
   ├─ Cache HIT?  → Return cached response with X-Cache: HIT
   └─ Cache MISS? → Forward to origin
                   → Receive response
                   → Add X-Cache: MISS header
                   → Return to client
                   → Store in cache (if cacheable)
```

### Caching Strategy

**What Gets Cached:**
- ✅ Only **GET requests** (standard HTTP practice)
- ✅ Only successful responses (status codes 200-299)
- ✅ Only **non-authenticated** requests (no Authorization header or cookies)
- ✅ Only when origin allows (respects Cache-Control headers)
- ✅ Complete response: status code, headers, and body
- ✅ With **5-minute TTL by default** (configurable)
- ✅ Query parameters are part of the cache key
- ✅ Optional header-based cache keys for content negotiation

**What Doesn't Get Cached:**
- ❌ Non-GET methods (POST, PUT, DELETE, PATCH, etc.)
- ❌ Authenticated requests (Authorization header or cookies present)
- ❌ Responses with `Cache-Control: no-store`, `no-cache`, or `private`
- ❌ Client errors (4xx) and server errors (5xx)
- ❌ Redirects (3xx)
- ❌ Expired entries

### Cache Key Format

```
Basic: METHOD:URL
Examples:
- GET:https://dummyjson.com/products/1
- GET:https://dummyjson.com/products?limit=10

With Headers: METHOD:URL:HEADER_HASH
Examples:
- GET:https://api.com/data:a1b2c3d4 (with Accept-Language: en-US)
- GET:https://api.com/data:x9y8z7w6 (with Accept-Language: fr-FR)
```

### LRU (Least Recently Used) Eviction

The cache automatically manages its size to prevent unlimited growth:

**How It Works:**
1. Each cache entry tracks its `lastAccessTime`
2. When cache exceeds limits (entries or size), oldest entries are evicted
3. Eviction targets 90% of limits to avoid constant cleanup
4. All eviction events are logged to `logs/cache.log`

**Default Limits:**
- **Max Entries**: 1,000 cache entries
- **Max Size**: 100 MB total cache size

**Configuration:**
```json
{
  "cache": {
    "maxEntries": 1000,
    "maxSizeMB": 100
  }
}
```

## ⚙️ Configuration

### Command-Line Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `--port <number>` | Port for proxy server | `--port 3000` |
| `--origin <url>` | Origin server URL | `--origin https://api.com` |
| `--config <path>` | Load configuration from file | `--config proxy.config.json` |
| `--dashboard <port>` | Start web dashboard on specified port | `--dashboard 4000` |
| `--clear-cache` | Clear all cached entries | `--clear-cache` |
| `--clear-cache-pattern <pattern>` | Clear cache matching URL pattern | `--clear-cache-pattern "/api/*"` |
| `--clear-cache-url <url>` | Clear specific cached URL | `--clear-cache-url "https://api.com/data"` |
| `--clear-cache-older-than <time>` | Clear entries older than time | `--clear-cache-older-than 1h` |
| `--dry-run` | Preview deletions without deleting | `--clear-cache --dry-run` |
| `--warm-cache <file>` | Pre-populate cache with URLs from file | `--warm-cache urls.txt` |
| `--cache-stats` | Display cache statistics | `--cache-stats` |
| `--cache-list` | List all cached URLs | `--cache-list` |
| `--log-level <level>` | Set log level (debug/info/warn/error) | `--log-level debug` |
| `--help` | Show help message | `--help` |
| `--version` | Show version number | `--version` |

### Configuration File Options

**Basic Configuration:**
```json
{
  "server": {
    "port": 3000,
    "origin": "https://api.example.com",
    "dashboardPort": 4000
  },
  "cache": {
    "defaultTTL": 300,
    "maxEntries": 1000,
    "maxSizeMB": 100,
    "cacheKeyHeaders": ["accept-language", "accept-encoding"],
    "compression": {
      "enabled": true,
      "method": "gzip"
    }
  },
  "logging": {
    "level": "info",
    "format": "text"
  }
}
```

**Advanced Configuration:**
```json
{
  "server": {
    "port": 3000,
    "origin": "https://api.example.com",
    "dashboardPort": 4000,
    "https": {
      "enabled": true,
      "certPath": "./certs/server.crt",
      "keyPath": "./certs/server.key"
    }
  },
  "cache": {
    "defaultTTL": 300,
    "maxEntries": 5000,
    "maxSizeMB": 500,
    "cacheKeyHeaders": ["accept-language", "user-agent"],
    "patternTTL": {
      "/api/products/*": 600,
      "/api/users/*": 300,
      "/api/static/**": 3600
    }
  },
  "security": {
    "rateLimit": {
      "enabled": true,
      "requestsPerMinute": 100,
      "requestsPerHour": 1000
    }
  }
}
```

### Header-Based Cache Keys

Configure headers to include in cache keys for content negotiation:

```json
{
  "cache": {
    "cacheKeyHeaders": ["accept-language", "accept-encoding"]
  }
}
```

**Common Use Cases:**
- **Internationalization**: `["accept-language"]` - Cache by language (en-US, fr-FR, etc.)
- **Content Negotiation**: `["accept-encoding"]` - Cache by encoding (gzip, brotli)
- **Device Differentiation**: `["user-agent"]` - Separate cache for mobile/desktop
- **API Versioning**: `["x-api-version"]` - Cache by version (v1, v2, v3)
- **Multi-Tenant**: `["x-tenant-id"]` - Separate cache per tenant

**Automatic Vary Header Support:**

The proxy automatically respects the `Vary` header from origin responses:
- Parses varying headers (e.g., `Vary: Accept-Language`)
- Merges with configured `cacheKeyHeaders`
- Stores separate cache entries for different header combinations

## 🗂️ Project Structure

```
caching-proxy/
├── src/
│   ├── index.js          # CLI entry point
│   ├── cli.js            # Command handlers
│   ├── server.js         # Proxy server
│   ├── cache.js          # Cache management
│   ├── analytics.js      # Analytics & metrics
│   ├── logger.js         # Logging system
│   ├── config.js         # Configuration loader
│   ├── dashboard.js      # Web dashboard server
│   ├── router.js         # Multi-origin routing
│   ├── rateLimit.js      # Rate limiting
│   ├── healthCheck.js    # Health monitoring
│   ├── versionManager.js # Cache versioning
│   ├── transformations.js# Request/response transforms
│   └── pluginManager.js  # Plugin system
├── public/               # Dashboard UI files
│   ├── index.html        # Dashboard HTML
│   ├── dashboard.css     # Dashboard styles
│   └── dashboard.js      # Dashboard JavaScript
├── cache/                # Cache storage (auto-generated)
├── logs/                 # Log files (auto-generated)
├── docs/                 # Documentation guides
│   ├── TESTING.md        # Test documentation
│   ├── CONFIG_DOCUMENTATION.md  # Configuration guide
│   └── PLUGIN_DEVELOPMENT.md    # Plugin development guide
├── proxy.config.json     # Example configuration
├── package.json          # Dependencies & scripts
└── README.md             # This file
```

## 🧪 Testing

### Manual Testing

```bash
# Start the server
caching-proxy --port 3000 --origin https://dummyjson.com

# Test cache MISS (first request)
curl -i http://localhost:3000/products/1
# Look for: x-cache: MISS

# Test cache HIT (second request)
curl -i http://localhost:3000/products/1
# Look for: x-cache: HIT

# Test with query parameters
curl http://localhost:3000/products?limit=5

# Clear cache and verify
caching-proxy --clear-cache
curl -i http://localhost:3000/products/1  # Should be MISS again
```

### Comprehensive Testing

See [TESTING.md](docs/TESTING.md) for detailed test documentation covering:
- CLI argument parsing
- HTTP server functionality
- Request forwarding
- Caching mechanisms
- Cache headers and invalidation
- Performance benchmarks

**Total: 85+ documented test cases**

## 🚨 Troubleshooting

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Option 1: Use a different port
caching-proxy --port 8080 --origin https://dummyjson.com

# Option 2: Kill the process (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Option 2: Kill the process (Linux/Mac)
lsof -ti:3000 | xargs kill -9
```

### Invalid Origin URL

**Error:** `Invalid origin URL`

**Solution:** Ensure the origin URL includes the protocol:
```bash
# ❌ Wrong
caching-proxy --port 3000 --origin dummyjson.com

# ✅ Correct
caching-proxy --port 3000 --origin https://dummyjson.com
```

### Requests Not Being Cached

**Possible Causes:**
1. Non-2xx status code - Only 200-299 responses are cached
2. Authenticated request - Requests with Authorization header are not cached
3. Origin sends `Cache-Control: no-store` - Respecting HTTP caching directives
4. Non-GET method - Only GET requests are cached by default

**Check:** Look at server logs for `💾 Cached:` or `⏭️ NOT cached` messages

### Connection Errors

**Error:** `Bad Gateway: Unable to reach origin server`

**Solution:** Verify origin server is accessible:
```bash
curl https://dummyjson.com/products/1
```

## 📊 Performance Notes

### Cache Performance
- **Cache HIT**: ~1-5ms response time (instant, no network call)
- **Cache MISS**: Depends on origin server response time
- **Speedup**: Typically 50-100x faster for cached responses
- **Storage**: File-based, persists across server restarts
- **Memory**: Minimal - cache stored on disk

### Scalability
- **Concurrent Requests**: Node.js handles multiple simultaneous requests
- **Cache Size**: Limited only by configured limits and disk space
- **File I/O**: Optimized for read/write operations

### Best Practices
1. **Use for Read-Heavy APIs** - Maximum benefit for GET requests
2. **Configure Appropriate TTL** - Balance freshness vs performance
3. **Monitor Cache Size** - Use `--cache-stats` regularly
4. **Set Reasonable Limits** - Based on your server's resources
5. **Use Dashboard** - Monitor performance in real-time

## 📚 Additional Documentation

- **[CONFIG_DOCUMENTATION.md](docs/CONFIG_DOCUMENTATION.md)** - Complete configuration reference with environment variable support
- **[PLUGIN_DEVELOPMENT.md](docs/PLUGIN_DEVELOPMENT.md)** - Plugin system architecture and development guide
- **[TESTING.md](docs/TESTING.md)** - Comprehensive testing documentation and procedures

## 🛠️ Tech Stack

- **Runtime**: Node.js (v14+)
- **Language**: JavaScript (ES6+)
- **Dependencies**:
  - `commander` (v11.1.0) - CLI argument parsing
  - Node.js built-in modules: `http`, `https`, `fs`, `path`, `crypto`, `zlib`

## 💡 What I Learned

Building this project from scratch taught me:

- **HTTP Protocol**: Deep understanding of HTTP methods, headers, status codes, caching headers (ETag, Cache-Control, Vary), and conditional requests
- **Proxy Architecture**: Request forwarding, header preservation, response streaming, and error handling patterns
- **Caching Strategies**: LRU eviction algorithms, TTL management, cache invalidation patterns, and compression techniques
- **Node.js**: HTTP/HTTPS modules, streams, file I/O, event-driven architecture, and async programming
- **Production Practices**: Structured logging, health monitoring, rate limiting, graceful error handling, and deployment considerations
- **Web Development**: Real-time dashboard with vanilla JavaScript, CSS animations, responsive design, and REST API design
- **Software Architecture**: Modular design patterns, plugin systems, configuration management, and separation of concerns

## 🚀 Why This Project?

This caching proxy was built as a comprehensive learning project to understand:
- How CDNs and reverse proxies work under the hood
- HTTP caching mechanisms and best practices
- Building production-ready Node.js applications
- System design for scalable backend services

The project evolved from a simple proxy server to a feature-complete caching solution with 27 production-ready features, demonstrating progressive enhancement and iterative development.

## 📊 Project Statistics

- **Total Features**: 27 comprehensive features
- **Lines of Code**: ~7,000+ (excluding tests and documentation)
- **Architecture**: Modular design with 15+ separate modules
- **Test Coverage**: 85+ documented test cases
- **Production Ready**: Complete error handling, logging, and monitoring

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

ISC

## 🔗 Resources

- [HTTP Caching - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [HTTP Proxy - Wikipedia](https://en.wikipedia.org/wiki/Proxy_server#Web_proxy_servers)
- [Node.js HTTP Module](https://nodejs.org/api/http.html)
- [RFC 7234 - HTTP Caching](https://tools.ietf.org/html/rfc7234)
- [Project Idea](https://roadmap.sh/projects/caching-server)

---

**Built from scratch with Node.js** • Production-ready • Well-documented • Feature-complete