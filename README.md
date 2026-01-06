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

## 📖 Detailed Examples

### Example 1: Basic Usage with DummyJSON API

```bash
# Start the proxy
caching-proxy --port 3000 --origin https://dummyjson.com

# In another terminal, make requests
curl http://localhost:3000/products/1        # MISS - fetches from origin
curl http://localhost:3000/products/1        # HIT - serves from cache
curl http://localhost:3000/products/2        # MISS - different endpoint
curl http://localhost:3000/products/2        # HIT - cached

# Clear cache when needed
caching-proxy --clear-cache
```

### Example 2: With Query Parameters

```bash
# Query parameters are part of the cache key
curl http://localhost:3000/products?limit=10     # MISS
curl http://localhost:3000/products?limit=10     # HIT
curl http://localhost:3000/products?limit=20     # MISS (different query)
```

### Example 3: Testing Cache Headers

```bash
# First request shows MISS
curl -i http://localhost:3000/products/1 | grep x-cache
# x-cache: MISS

# Second request shows HIT
curl -i http://localhost:3000/products/1 | grep x-cache
# x-cache: HIT
```

### Example 4: Multiple HTTP Methods

```bash
# GET request
curl http://localhost:3000/products/1

# POST request (not cached by most APIs, but supported)
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Test"}' \
  http://localhost:3000/products/add

# PUT request
curl -X PUT -H "Content-Type: application/json" \
  -d '{"title":"Updated"}' \
  http://localhost:3000/products/1
```

### Example 5: Advanced Cache Management

```bash
# Preview what would be deleted (dry-run mode)
caching-proxy --clear-cache --dry-run
caching-proxy --clear-cache-pattern "/products/*" --dry-run

# Clear cache by URL pattern
caching-proxy --clear-cache-pattern "/products/*"    # Clear all products
caching-proxy --clear-cache-pattern "/api/**"        # Clear all API routes

# Clear specific URL
caching-proxy --clear-cache-url "https://api.com/products/1"

# Clear old cache entries
caching-proxy --clear-cache-older-than 1h    # Older than 1 hour
caching-proxy --clear-cache-older-than 30m   # Older than 30 minutes
caching-proxy --clear-cache-older-than 2d    # Older than 2 days

# View cache statistics
caching-proxy --cache-stats
caching-proxy --cache-list
```

### Example 6: Cache Warming

```bash
# Create a file with URLs to warm (one per line)
cat > warm-urls.txt << EOF
# Products
/products/1
/products/2
/products/3

# Users
/users/1
/users/2

# Categories
/categories
EOF

# Warm the cache by pre-fetching these URLs
caching-proxy --warm-cache warm-urls.txt --origin https://dummyjson.com

# Output:
# 🔥 Cache Warming
# ════════════════════════════════════════════════════════════
# 
# 📁 Reading URLs from: warm-urls.txt
# 🌐 Origin server: https://dummyjson.com
# 
# 📋 Found 6 URLs to warm
# 
# [1/6] Fetching: /products/1 ... ✅ 200 (cached)
# [2/6] Fetching: /products/2 ... ✅ 200 (cached)
# ...
# 
# 📊 Cache Warming Summary
#    Total URLs:        6
#    Successful:        6 ✅
#    Cached:            6 💾
#    Duration:          1.5s
```

### Example 7: Header-Based Cache Keys

```bash
# Create a configuration file with header-based cache keys
cat > proxy.config.json << EOF
{
  "server": {
    "port": 3000,
    "origin": "https://api.example.com"
  },
  "cache": {
    "cacheKeyHeaders": ["accept-language", "accept-encoding"]
  }
}
EOF

# Start the proxy
caching-proxy --config proxy.config.json

# Same URL with different Accept-Language headers creates separate cache entries
curl -H "Accept-Language: en-US" http://localhost:3000/api/data    # MISS - caches with en-US
curl -H "Accept-Language: fr-FR" http://localhost:3000/api/data    # MISS - caches with fr-FR
curl -H "Accept-Language: en-US" http://localhost:3000/api/data    # HIT - serves en-US cached version

# Check cache stats to see both entries
caching-proxy --cache-stats --config proxy.config.json

# Cache keys include a hash of the header values:
# GET:https://api.example.com/api/data:a1b2c3d4 (en-US)
# GET:https://api.example.com/api/data:x9y8z7w6 (fr-FR)
```

### Example 8: Web Dashboard

```bash
# Start proxy with real-time web dashboard
caching-proxy --port 3000 --origin https://dummyjson.com --dashboard 4000

# Dashboard automatically opens on http://localhost:4000
# Shows real-time:
#   • Live request counts and cache hit rates
#   • Performance metrics (response times, speedup factor)
#   • Bandwidth savings and efficiency
#   • List of all cached URLs with search/filter
#   • Interactive cache management (delete entries, clear cache)
#   • Server health and uptime
#   • Top requested URLs

# Or use config file
cat > proxy.config.json << EOF
{
  "server": {
    "port": 3000,
    "origin": "https://dummyjson.com",
    "dashboardPort": 4000
  }
}
EOF

caching-proxy --config proxy.config.json
```

**Dashboard Features**:
- 📊 Real-time metrics with auto-refresh (every 5 seconds)
- 🎨 Modern dark theme UI with smooth animations
- 🔍 Search and filter cached URLs
- 🗑️ Interactive cache management (delete/clear)
- 📈 Performance charts and statistics
- 💾 Bandwidth savings visualization
- ⚡ Live cache hit/miss tracking
- 🏥 Origin server health monitoring

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
                   → Store in cache (if 2xx)
```

### Caching Strategy

**What Gets Cached:**
- ✅ Only **GET requests** (standard HTTP practice)
- ✅ Only successful responses (status codes 200-299)
- ✅ Only **non-authenticated** requests (no Authorization header or cookies)
- ✅ Only when origin allows (respects Cache-Control headers)
- ✅ Complete response: status code, headers, and body
- ✅ With **5-minute TTL** (auto-expires after 300 seconds)
- ✅ Query parameters are part of the cache key
- ✅ Optional header-based cache keys for content negotiation

**What Doesn't Get Cached:**
- ❌ Non-GET methods (POST, PUT, DELETE, PATCH, etc.)
- ❌ Authenticated requests (Authorization header or cookies present)
- ❌ Responses with `Cache-Control: no-store`, `no-cache`, or `private`
- ❌ Client errors (4xx) - 404, 401, 403, etc.
- ❌ Server errors (5xx) - 500, 502, 503, etc.
- ❌ Redirects (3xx) - 301, 302, 307, etc.
- ❌ Expired entries (older than 5 minutes)

### Cache Key Format

```
METHOD:URL

Examples:
- GET:https://dummyjson.com/products/1
- GET:https://dummyjson.com/products?limit=10
- POST:https://dummyjson.com/products/add
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

**Example Log Output:**
```
🗑️  LRU Eviction: Removed 2 entries (Cache: 998 entries, 98.5 MB)
💾 Cached: GET:https://api.com/data (TTL: 5min, 998 entries, 98.5 MB) [Evicted 2]
```

## ✨ Features

- ✅ **Proxy Forwarding:** HTTP & HTTPS origin servers supported
- ✅ **All HTTP Methods:** GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, etc.
- ✅ **Request Preservation:**
  - Query parameters (`?limit=10&skip=5`)
  - All request headers (Content-Type, Authorization, custom)
  - Request body (JSON, form data, binary) via streaming
  - HTTP methods and status codes
- ✅ **Smart Caching:**
  - Only cache GET requests (not POST, PUT, DELETE)
  - Only cache 2xx responses
  - Avoid authenticated requests (no Authorization/cookies)
  - Respect Cache-Control headers (no-store, no-cache, private)
  - 5-minute TTL with auto-expiration
  - LRU eviction (max 1000 entries, 100 MB by default)
  - File-based persistent storage (`cache/cache-data.json`)
  - Method and URL specific caching
  - Query parameter aware
  - Optional header-based cache keys for content negotiation
- ✅ **Cache Indicators:**
  - `X-Cache: HIT` - Response served from cache (fast!)
  - `X-Cache: MISS` - Response fetched from origin
- ✅ **Cache Management:**
  - `--clear-cache` command
  - Shows cache statistics before clearing
  - User-friendly confirmation messages

## 📦 Installation

### Option 1: Clone and Install Locally

```bash
# Clone the repository
git clone <your-repo-url>
cd caching-proxy

# Install dependencies
npm install

# Make it globally available
npm link
```

### Option 2: Direct Usage (Without Global Install)

```bash
# Clone and install
git clone <your-repo-url>
cd caching-proxy
npm install

# Run directly with node
node src/index.js --port 3000 --origin https://api.example.com
```

## 🎯 Usage

### Start the Proxy Server

```bash
caching-proxy --port <number> --origin <url>
```

**Example:**
```bash
caching-proxy --port 3000 --origin https://dummyjson.com
```

**Output:**
```
🚀 Starting Caching Proxy Server...
   Port:   3000
   Origin: https://dummyjson.com

✅ Proxy server is running on http://localhost:3000
📡 Forwarding requests to: https://dummyjson.com

🎯 Try: curl http://localhost:3000/test
```

### Make Requests Through the Proxy

```bash
# First request - fetched from origin (MISS)
curl http://localhost:3000/products/1

# Second request - served from cache (HIT)
curl http://localhost:3000/products/1

# Check headers to see cache status
curl -i http://localhost:3000/products/1 | grep x-cache
# x-cache: HIT
```

### Clear the Cache

```bash
caching-proxy --clear-cache
```

**Output:**
```
🧹 Clearing cache...
   Current cache size: 5 entries

   Cached entries:
     1. GET:https://dummyjson.com/products/1
     2. GET:https://dummyjson.com/products/2
     3. GET:https://dummyjson.com/products?limit=10
     ... and 2 more

✅ Cache cleared successfully!
   5 entries removed
```

### Get Help

```bash
caching-proxy --help
```

### Check Version

```bash
caching-proxy --version
```

## ⚙️ Configuration Options

### Command-Line Arguments

| Argument | Description | Required | Example |
|----------|-------------|----------|---------|
| `--port <number>` | Port for proxy server | Yes* | `--port 3000` |
| `--origin <url>` | Origin server URL | Yes* | `--origin https://api.com` |
| `--config <path>` | Load configuration from file | No | `--config proxy.config.json` |
| `--clear-cache` | Clear all cached entries | No | `--clear-cache` |
| `--clear-cache-pattern <pattern>` | Clear cache matching URL pattern | No | `--clear-cache-pattern "/api/*"` |
| `--clear-cache-url <url>` | Clear specific cached URL | No | `--clear-cache-url "https://api.com/products/1"` |
| `--clear-cache-older-than <time>` | Clear entries older than time | No | `--clear-cache-older-than 1h` |
| `--dry-run` | Preview deletions without deleting | No | `--clear-cache --dry-run` |
| `--warm-cache <file>` | Pre-populate cache with URLs from file | No | `--warm-cache urls.txt --origin https://api.com` |
| `--dashboard <port>` | Start web dashboard on specified port | No | `--dashboard 4000` |
| `--cache-stats` | Display cache statistics | No | `--cache-stats` |
| `--cache-list` | List all cached URLs | No | `--cache-list` |
| `--log-level <level>` | Set log level (debug/info/warn/error) | No | `--log-level debug` |
| `--help` | Show help message | No | `--help` |
| `--version` | Show version number | No | `--version` |

*Required when starting server (not needed for `--clear-cache`)

### Port Requirements

- Port must be between 1 and 65535
- Port must not be already in use
- Common choices: 3000, 8080, 8000

### Origin URL Requirements

- Must be a valid URL with `http://` or `https://` protocol
- Examples:
  - ✅ `https://dummyjson.com`
  - ✅ `http://api.example.com`
  - ✅ `https://api.github.com`
  - ❌ `dummyjson.com` (missing protocol)
  - ❌ `ftp://example.com` (wrong protocol)

### Configuration File

Use `--config <path>` to load settings from a JSON file:

```bash
caching-proxy --config proxy.config.json
```

**Example Configuration:**
```json
{
  "server": {
    "port": 3000,
    "origin": "https://dummyjson.com"
  },
  "cache": {
    "defaultTTL": 300,
    "maxEntries": 1000,
    "maxSizeMB": 100
  },
  "logging": {
    "level": "info",
    "format": "text"
  }
}
```

**Cache Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultTTL` | number | 300 | Cache TTL in seconds (5 minutes) |
| `maxEntries` | number | 1000 | Maximum number of cache entries |
| `maxSizeMB` | number | 100 | Maximum cache size in megabytes |
| `cacheKeyHeaders` | array | [] | Request headers to include in cache keys (e.g., `["accept-language", "accept-encoding"]`) |
| `compression.enabled` | boolean | true | Enable/disable response compression |
| `compression.method` | string | "gzip" | Compression method: `gzip`, `brotli`, or `none` |

When cache limits are reached, the **LRU (Least Recently Used)** eviction policy automatically removes the oldest entries.

**Header-Based Cache Keys:**

By default, the cache key is `METHOD:URL`. When `cacheKeyHeaders` is configured, a hash of the specified header values is appended to the cache key (e.g., `GET:https://api.com/data:a1b2c3d4`). This allows different cache entries for the same URL with different header combinations.

**Configuration accepts ANY header name** - no hardcoding required. Common use cases:

- **Internationalization**: 
  ```json
  { "cache": { "cacheKeyHeaders": ["accept-language"] } }
  ```
  Cache responses by `accept-language` for multi-language support (en-US, fr-FR, es-ES, etc.)

- **Content Negotiation**: 
  ```json
  { "cache": { "cacheKeyHeaders": ["accept-encoding"] } }
  ```
  Cache different encodings (gzip, brotli, deflate)

- **Device Differentiation**:
  ```json
  { "cache": { "cacheKeyHeaders": ["user-agent"] } }
  ```
  Separate cache for mobile, desktop, tablet

- **API Versioning**:
  ```json
  { "cache": { "cacheKeyHeaders": ["x-api-version"] } }
  ```
  Differentiate cache entries by custom version headers (v1, v2, v3)

- **Multi-Tenant**:
  ```json
  { "cache": { "cacheKeyHeaders": ["x-tenant-id"] } }
  ```
  Separate cache per tenant/client

- **Multiple Headers**:
  ```json
  { "cache": { "cacheKeyHeaders": ["accept-language", "user-agent"] } }
  ```
  Combine multiple headers for complex scenarios

**Automatic Vary Header Support**:

The proxy automatically detects and respects the `Vary` header from origin responses. When an origin server sends a `Vary` header, the proxy:
- Parses the varying headers (e.g., `Vary: Accept-Language`)
- Merges them with configured `cacheKeyHeaders`
- Uses the combined list to generate cache keys
- Stores separate cache entries for different header combinations

Example:
```bash
# Origin responds with: Vary: Accept-Encoding
# Configuration has: cacheKeyHeaders: ["accept-language"]

# Final cache key includes BOTH:
# - accept-language (from config)
# - accept-encoding (from Vary header)

Server logs:
🔀 Vary header detected: accept-encoding
🔑 Cache key includes headers: accept-encoding, accept-language
```

**Note**: Responses with `Vary: *` are not cached (per HTTP specification).

## 🗂️ Project Structure

```
caching-proxy/
├── src/
│   ├── index.js          # Entry point & CLI setup
│   ├── cli.js            # Command handlers & validation
│   ├── server.js         # Proxy server & request forwarding
│   ├── cache.js          # Cache storage & retrieval (with LRU eviction)
│   ├── analytics.js      # Cache analytics & statistics
│   ├── logger.js         # Logging system (access, cache, error, performance)
│   └── config.js         # Configuration file loader & validator
├── cache/                # Cache storage directory
│   ├── cache-data.json   # Cached responses (auto-generated)
│   └── analytics.json    # Analytics data (auto-generated)
├── logs/                 # Log files directory
│   ├── access.log        # Request/response logs
│   ├── cache.log         # Cache hit/miss/eviction events
│   ├── error.log         # Error logs
│   └── performance.log   # Performance metrics
├── doc/                  # Documentation
│   ├── PROJECT_PLAN.md   # Development stages & progress
│   └── CONFIG_DOCUMENTATION.md  # Configuration guide
├── proxy.config.json     # Example configuration file
├── package.json          # Dependencies & scripts
├── README.md             # This file
└── .gitignore            # Git ignore rules
```

## 🛠️ Tech Stack

- **Runtime**: Node.js (v14+)
- **Language**: JavaScript (ES6+)
- **Dependencies**:
  - `commander` (v11.1.0) - CLI argument parsing
  - `http/https` (built-in) - HTTP client/server
  - `fs` (built-in) - File system operations
  - `path` (built-in) - Path manipulation

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

# Test different endpoints
curl http://localhost:3000/products/2
curl http://localhost:3000/users/1
curl "http://localhost:3000/products?limit=5"

# Clear cache
caching-proxy --clear-cache

# Verify cache cleared (should be MISS again)
curl -i http://localhost:3000/products/1
```

### Automated Tests

See [TESTING.md](TESTING.md) for comprehensive test documentation covering:
- CLI argument parsing (7 tests)
- HTTP server functionality (4 tests)
- Request forwarding (7 tests)
- Caching mechanism (58 tests)
- Cache headers (4 tests)
- Clear cache feature (5 tests)

**Total: 85+ tests documented**

## 🚨 Troubleshooting

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Option 1: Use a different port
caching-proxy --port 8080 --origin https://dummyjson.com

# Option 2: Find and kill the process using the port (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Option 2: Find and kill the process using the port (Linux/Mac)
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

### Cache Not Clearing

**Issue:** Cache doesn't clear when running `--clear-cache`

**Solution:** The cache is stored in `cache/cache-data.json`. If the file isn't being deleted:
```bash
# Manually delete cache file
rm cache/cache-data.json   # Linux/Mac
del cache\cache-data.json  # Windows

# Or delete entire cache directory
rm -rf cache/              # Linux/Mac
rmdir /s cache\            # Windows
```

### Requests Not Being Cached

**Possible Causes:**
1. **Non-2xx status code** - Only 200-299 responses are cached
2. **Different query parameters** - `?page=1` and `?page=2` are cached separately
3. **Different HTTP methods** - GET and POST to same URL are cached separately

**Check:** Look at server logs for `💾 Cached:` or `⏭️ NOT cached` messages

### Connection Errors

**Error:** `Bad Gateway: Unable to reach origin server`

**Possible Causes:**
1. Origin server is down
2. Network connectivity issues
3. Firewall blocking outbound connections
4. Invalid origin URL

**Solution:** Verify origin server is accessible:
```bash
curl https://dummyjson.com/products/1
```

## 📊 Performance Notes

### Cache Performance

- **Cache HIT**: ~1-5ms response time (instant, no network call)
- **Cache MISS**: Depends on origin server response time
- **Storage**: File-based, persists across server restarts
- **Memory**: Minimal - cache stored on disk

### Scalability

- **Concurrent Requests**: Node.js handles multiple simultaneous requests
- **Cache Size**: Limited only by disk space
- **File I/O**: Optimized for read/write operations

### Best Practices

1. **Use for Read-Heavy APIs** - Maximum benefit for GET requests
2. **Clear Cache Periodically** - Prevent stale data
3. **Monitor Cache Size** - Check `cache/cache-data.json` file size
4. **Choose Appropriate Port** - Avoid conflicts with other services

## 🤝 Contributing

Contributions are welcome! This project follows standard contribution guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📊 Project Statistics

- **Total Features**: 27 comprehensive stages implemented
- **Lines of Code**: ~7,000+ (excluding tests and documentation)
- **Development Time**: 3 months (part-time)
- **Test Coverage**: 85+ documented test cases
- **Documentation**: 4 comprehensive guides (README, PROJECT_PLAN, TESTING, CONFIG)
- **Architecture**: Modular design with 15+ separate modules
- **Production Ready**: Complete error handling, logging, and monitoring

## 📝 Development & Documentation

This project includes comprehensive documentation:

### [PROJECT_PLAN.md](doc/PROJECT_PLAN.md)
- 27 detailed implementation stages
- Complete development roadmap
- Technical decisions and architecture
- Progress tracking with test results

### [TESTING.md](docs/TESTING.md)
- 85+ documented test cases
- Manual and automated testing procedures
- Real-world usage examples
- Performance benchmarks

### [CONFIG_DOCUMENTATION.md](docs/CONFIG_DOCUMENTATION.md)
- Complete configuration reference
- Environment variable support
- Advanced configuration examples

### [PLUGIN_DEVELOPMENT.md](docs/PLUGIN_DEVELOPMENT.md)
- Plugin system architecture
- Lifecycle hooks documentation
- Example plugins with source code

## 💡 What I Learned

Building this project from scratch taught me:

- **HTTP Protocol Deep Dive**: Understanding HTTP methods, headers, status codes, caching headers (ETag, Cache-Control, Vary), and conditional requests
- **Proxy Architecture**: Request forwarding, header preservation, response streaming, and error handling
- **Caching Strategies**: LRU eviction, TTL management, cache invalidation patterns, and compression
- **Node.js Internals**: HTTP/HTTPS modules, streams, file I/O, and event-driven architecture
- **Production Practices**: Logging, monitoring, health checks, rate limiting, and graceful error handling
- **API Design**: RESTful API design for the dashboard, JSON data structures, and CORS handling
- **Web Development**: Real-time dashboard with vanilla JavaScript, CSS animations, and responsive design
- **Software Architecture**: Modular design, plugin systems, configuration management, and separation of concerns

## 🚀 Why This Project?

This caching proxy was built as a comprehensive learning project to understand:
- How CDNs and reverse proxies work under the hood
- HTTP caching mechanisms and best practices
- Building production-ready Node.js applications
- System design for scalable backend services

The project evolved from a simple proxy server to a feature-complete caching solution with 27 production-ready features, demonstrating progressive enhancement and iterative development.

## 📄 License

ISC

## 🔗 Related Resources

- [HTTP Caching - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [HTTP Proxy - Wikipedia](https://en.wikipedia.org/wiki/Proxy_server#Web_proxy_servers)
- [Node.js HTTP Module](https://nodejs.org/api/http.html)
- [RFC 7234 - HTTP Caching](https://tools.ietf.org/html/rfc7234)

---

**Built from scratch with Node.js** • Comprehensive features • Production-ready • Well-documented

