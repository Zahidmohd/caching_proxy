# Caching Proxy Server

A high-performance CLI tool that creates a caching proxy server to speed up your API requests. It intelligently forwards requests to an origin server, caches successful responses, and serves subsequent requests instantly from cache.

## 🚀 Features at a Glance

- ⚡ **Fast Response Times** - Serve cached responses instantly
- 💾 **Smart Caching** - Only cache successful (2xx) responses
- 🔄 **Cache Indicators** - Clear `X-Cache: HIT/MISS` headers
- 🧹 **Easy Management** - Simple `--clear-cache` command
- 📦 **File-Based Storage** - Persistent cache across restarts
- 🌐 **Full HTTP Support** - Works with all HTTP methods
- 🔒 **Header Preservation** - All original headers maintained

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
  - File-based persistent storage (`cache/cache-data.json`)
  - Method and URL specific caching
  - Query parameter aware
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
| `--clear-cache` | Clear all cached entries | No | `--clear-cache` |
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

## 🗂️ Project Structure

```
caching-proxy/
├── src/
│   ├── index.js          # Entry point & CLI setup
│   ├── cli.js            # Command handlers & validation
│   ├── server.js         # Proxy server & request forwarding
│   ├── cache.js          # Cache storage & retrieval
├── cache/                # Cache storage directory
│   └── cache-data.json   # Cached responses (auto-generated)
├── package.json          # Dependencies & scripts
├── README.md             # This file
├── TESTING.md            # Test documentation
├── PROJECT_PLAN.md       # Development stages
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

## 📝 Development

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for:
- Detailed development stages (7 stages)
- Implementation roadmap
- Progress tracking
- Technical decisions

See [TESTING.md](TESTING.md) for:
- Comprehensive test documentation
- 85+ test cases
- Manual testing procedures
- Test results

## 📄 License

ISC

## 🙏 Acknowledgments

- Built as a learning project for understanding HTTP proxies and caching
- Inspired by real-world CDN and caching solutions
- Tested with [DummyJSON](https://dummyjson.com/) API

## 🔗 Related Resources

- [HTTP Caching - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [HTTP Proxy - Wikipedia](https://en.wikipedia.org/wiki/Proxy_server#Web_proxy_servers)
- [Node.js HTTP Module](https://nodejs.org/api/http.html)

---

**Made with ❤️ for learning and understanding HTTP caching**

