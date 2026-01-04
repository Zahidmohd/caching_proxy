# Caching Proxy Server

A CLI tool that starts a caching proxy server. It forwards requests to an actual server and caches the responses. Subsequent identical requests return the cached response instead of forwarding to the server.

## Status
🚧 **Under Development** - See [PROJECT_PLAN.md](PROJECT_PLAN.md) for implementation stages

### Current Progress
- ✅ Stage 1: Project setup complete
- ✅ Stage 2: CLI argument parsing implemented
- ✅ Stage 3: Proxy server with request/response forwarding
- ✅ Stage 4: Caching mechanism complete
  - ✅ Cache key generation strategy (METHOD:URL)
  - ✅ File-based persistent storage
  - ✅ Response data storage (status code, headers, body)
  - ✅ Cache policy (only 2xx responses)
  - ✅ Cache retrieval logic
- ✅ Stage 5: Cache integration with proxy complete
  - ✅ Check cache before forwarding requests
  - ✅ X-Cache: HIT header when serving from cache
  - ✅ X-Cache: MISS header when fetching from origin
  - ✅ Response caching after origin fetch
- ✅ Stage 6: Clear cache feature complete
  - ✅ File-based cache storage (cache/cache-data.json)
  - ✅ --clear-cache command
  - ✅ User-friendly output and confirmation
- ⏳ Stage 7: Testing & Documentation (Next)

## Features

- ✅ Forward HTTP requests to origin server (HTTP & HTTPS)
- ✅ Support all HTTP methods (GET, POST, PUT, PATCH, DELETE, etc.)
- ✅ **Complete Request Preservation:**
  - Query parameters (e.g., `?limit=10&skip=5`)
  - All request headers (Content-Type, Authorization, custom headers)
  - Request body (JSON, form data, binary, etc.) via streaming
  - HTTP method and status codes
- ✅ **Smart Caching:**
  - Cache successful responses (2xx status codes)
  - In-memory storage using Map
  - Separate caching per HTTP method and URL
  - Query parameter aware
- ✅ **Cache Indicators:**
  - `X-Cache: HIT` - Response served from cache
  - `X-Cache: MISS` - Response fetched from origin
- ✅ **Clear Cache Command:**
  - `--clear-cache` to remove all cached entries
  - File-based persistent storage
  - User-friendly confirmation messages

## Installation (Coming Soon)

```bash
npm install
npm link
```

## Usage (Coming Soon)

### Start the proxy server
```bash
caching-proxy --port <number> --origin <url>
```

Example:
```bash
caching-proxy --port 3000 --origin http://dummyjson.com
```

### Clear cache
```bash
caching-proxy --clear-cache
```

## Tech Stack

- **Runtime**: Node.js (v14+)
- **Language**: JavaScript
- **Dependencies**:
  - `commander` - CLI argument parsing

## Project Structure

```
caching-proxy/
├── src/
│   ├── index.js          # Entry point
│   ├── cli.js            # CLI interface (Stage 2)
│   ├── server.js         # Proxy server (Stage 3)
│   ├── cache.js          # Caching logic (Stage 4)
│   └── utils.js          # Helper functions
├── package.json
├── README.md
├── PROJECT_PLAN.md       # Development stages
└── .gitignore
```

## Development

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for detailed development stages and progress.

## License

ISC

