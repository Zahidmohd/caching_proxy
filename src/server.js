/**
 * Proxy Server Module
 * Handles HTTP server creation and request handling
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * Forward request to origin server
 * Preserves: headers, query parameters, request body, and HTTP method
 * @param {http.IncomingMessage} req - Incoming request
 * @param {http.ServerResponse} res - Response object
 * @param {string} origin - Origin server URL
 */
function forwardRequest(req, res, origin) {
  const originUrl = new URL(origin);
  const targetUrl = new URL(req.url, origin); // Preserves path and query params
  
  // Choose http or https based on origin protocol
  const client = originUrl.protocol === 'https:' ? https : http;
  
  // Prepare request options
  // Supports ALL HTTP methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, etc.
  const options = {
    hostname: originUrl.hostname,
    port: originUrl.port || (originUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search, // ✅ Preserves query parameters
    method: req.method, // ✅ Preserves HTTP method (GET, POST, etc.)
    headers: {
      ...req.headers, // ✅ Preserves all original headers (Content-Type, Authorization, custom headers, etc.)
      host: originUrl.hostname // Override host header to match origin
    }
  };
  
  console.log(`📤 ${req.method} ${targetUrl.pathname}${targetUrl.search}`);
  
  // Forward the request to origin server
  const proxyReq = client.request(options, (proxyRes) => {
    console.log(`📥 ${proxyRes.statusCode} ${req.method} ${targetUrl.pathname}${targetUrl.search}`);
    
    // Forward status code and headers from origin
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Pipe the response from origin to client
    proxyRes.pipe(res);
  });
  
  // Handle errors
  proxyReq.on('error', (error) => {
    console.error(`❌ Error forwarding request: ${error.message}`);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway: Unable to reach origin server');
  });
  
  // ✅ Preserves request body using streaming (handles JSON, form data, binary, etc.)
  // This works for all content types and efficiently handles large payloads
  req.pipe(proxyReq);
}

/**
 * Create and start the proxy server
 * @param {number} port - Port to listen on
 * @param {string} origin - Origin server URL
 * @returns {http.Server} - HTTP server instance
 */
function createProxyServer(port, origin) {
  const server = http.createServer((req, res) => {
    forwardRequest(req, res, origin);
  });

  server.listen(port, () => {
    console.log(`✅ Proxy server is running on http://localhost:${port}`);
    console.log(`📡 Forwarding requests to: ${origin}`);
    console.log(`\n🎯 Try: curl http://localhost:${port}/test\n`);
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${port} is already in use`);
      console.error('   Please choose a different port or stop the process using this port.\n');
    } else {
      console.error(`\n❌ Server Error: ${error.message}\n`);
    }
    process.exit(1);
  });

  return server;
}

module.exports = {
  createProxyServer
};

