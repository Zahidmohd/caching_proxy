/**
 * Proxy Server Module
 * Handles HTTP server creation and request handling
 */

const http = require('http');

/**
 * Create and start the proxy server
 * @param {number} port - Port to listen on
 * @param {string} origin - Origin server URL
 * @returns {http.Server} - HTTP server instance
 */
function createProxyServer(port, origin) {
  const server = http.createServer((req, res) => {
    // For now, just acknowledge the request
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Proxy server received: ${req.method} ${req.url}\nOrigin: ${origin}`);
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

