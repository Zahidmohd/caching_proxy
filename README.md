# Caching Proxy Server

A CLI tool that starts a caching proxy server. It forwards requests to an actual server and caches the responses. Subsequent identical requests return the cached response instead of forwarding to the server.

## Status
🚧 **Under Development** - See [PROJECT_PLAN.md](PROJECT_PLAN.md) for implementation stages

### Current Progress
- ✅ Stage 1: Project setup complete
- ✅ Stage 2: CLI argument parsing implemented
- ⏳ Stage 3: Proxy server (Next)

## Features

- ✅ Forward HTTP requests to origin server (HTTP & HTTPS)
- ✅ Support all HTTP methods (GET, POST, PUT, PATCH, DELETE, etc.)
- ✅ **Complete Request Preservation:**
  - Query parameters (e.g., `?limit=10&skip=5`)
  - All request headers (Content-Type, Authorization, custom headers)
  - Request body (JSON, form data, binary, etc.) via streaming
  - HTTP method and status codes
- ⏳ Cache responses for faster subsequent requests (In Progress)
- ⏳ Add `X-Cache` headers to indicate cache hits/misses (In Progress)
- ⏳ Clear cache functionality (Coming Soon)

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

