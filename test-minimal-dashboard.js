#!/usr/bin/env node

const { exec } = require('child_process');
const http = require('http');

console.log('═══════════════════════════════════════════════════════════════');
console.log('🎯 Testing Minimal Professional Dashboard');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Design Philosophy:');
console.log('  • GitHub-inspired minimal dark theme');
console.log('  • Flat surfaces, no gradients');
console.log('  • Data density over decoration');
console.log('  • Table layout for cache entries');
console.log('  • Strong typography hierarchy');
console.log('  • Infrastructure-grade professional look\n');

console.log('Starting server...\n');

const server = exec('node src/index.js --port 3000 --origin https://dummyjson.com --dashboard 4000', {
  cwd: __dirname
});

let serverReady = false;
let dashboardReady = false;

server.stdout.on('data', (data) => {
  console.log(data.toString());
  
  if (data.toString().includes('Proxy server is running')) {
    serverReady = true;
  }
  if (data.toString().includes('Dashboard is running')) {
    dashboardReady = true;
  }
  
  if (serverReady && dashboardReady) {
    setTimeout(() => generateTestData(), 2000);
  }
});

server.stderr.on('data', (data) => {
  console.error(data.toString());
});

async function generateTestData() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Generating test data...');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    await makeProxyRequest('/products/1');
    await makeProxyRequest('/products/2');
    await makeProxyRequest('/products/3');
    await makeProxyRequest('/users/1');
    await makeProxyRequest('/products/1'); // HIT
    await makeProxyRequest('/users/2');
    await makeProxyRequest('/products/2'); // HIT
    console.log('✅ Test data generated\n');
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✨ MINIMAL DASHBOARD READY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('URL: http://localhost:4000\n');
  console.log('New Design Features:');
  console.log('  ✅ GitHub-style color palette (#0d1117)');
  console.log('  ✅ Single-line top bar (no cards)');
  console.log('  ✅ Flat metrics row (4 columns)');
  console.log('  ✅ Professional TABLE layout (not cards)');
  console.log('  ✅ Clean typography (Inter font)');
  console.log('  ✅ Minimal borders, no gradients');
  console.log('  ✅ Data density focused');
  console.log('  ✅ Production-grade appearance\n');
  console.log('Compare to:');
  console.log('  • GitHub Actions dashboard');
  console.log('  • Vercel Analytics');
  console.log('  • Grafana panels\n');
  console.log('Press Ctrl+C to stop\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.end();
  });
}

function makeProxyRequest(path) {
  return makeRequest(`http://localhost:3000${path}`, 'GET');
}

process.on('SIGINT', () => {
  console.log('\n\nStopping server...');
  server.kill();
  process.exit(0);
});

