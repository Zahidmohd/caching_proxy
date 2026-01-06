/**
 * Origin Health Check Module
 * Periodically checks origin server health and tracks status
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Health check configuration
let healthCheckConfig = {
  enabled: false,
  interval: 30000, // Default: 30 seconds
  timeout: 5000,   // Default: 5 seconds
  path: '/',       // Default path to check
  method: 'HEAD'   // Default method
};

// Origin health status
// { origin: { status: 'healthy'|'unhealthy'|'unknown', lastCheck: timestamp, consecutiveFailures: 0, lastError: string } }
let originHealth = {};

// Health check interval ID
let healthCheckInterval = null;

// Metrics file path
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const HEALTH_METRICS_FILE = path.join(CACHE_DIR, 'health-metrics.json');

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load health metrics from file
 */
function loadHealthMetrics() {
  try {
    ensureCacheDir();
    if (fs.existsSync(HEALTH_METRICS_FILE)) {
      const data = fs.readFileSync(HEALTH_METRICS_FILE, 'utf8');
      const metrics = JSON.parse(data);
      return metrics;
    }
  } catch (error) {
    console.error(`⚠️  Error loading health metrics: ${error.message}`);
  }
  return {};
}

/**
 * Save health metrics to file
 */
function saveHealthMetrics() {
  try {
    ensureCacheDir();
    fs.writeFileSync(HEALTH_METRICS_FILE, JSON.stringify(originHealth, null, 2), 'utf8');
  } catch (error) {
    console.error(`⚠️  Error saving health metrics: ${error.message}`);
  }
}

/**
 * Configure health check settings
 * @param {Object} config - Configuration object
 * @param {boolean} config.enabled - Enable health checks
 * @param {number} config.interval - Check interval in milliseconds
 * @param {number} config.timeout - Request timeout in milliseconds
 * @param {string} config.path - Path to check
 * @param {string} config.method - HTTP method (HEAD or GET)
 * @param {Array<string>} config.origins - List of origins to check
 */
function configureHealthCheck(config) {
  if (!config) return;
  
  healthCheckConfig = {
    enabled: config.enabled !== undefined ? config.enabled : healthCheckConfig.enabled,
    interval: config.interval || healthCheckConfig.interval,
    timeout: config.timeout || healthCheckConfig.timeout,
    path: config.path || healthCheckConfig.path,
    method: config.method || healthCheckConfig.method,
    origins: config.origins || []
  };
  
  // Initialize health status for all configured origins
  if (healthCheckConfig.origins && healthCheckConfig.origins.length > 0) {
    healthCheckConfig.origins.forEach(origin => {
      if (!originHealth[origin]) {
        originHealth[origin] = {
          status: 'unknown',
          lastCheck: null,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          totalChecks: 0,
          totalFailures: 0,
          lastError: null,
          uptime: 0,
          uptimePercentage: 0
        };
      }
    });
  }
  
  // Load previous health metrics if available
  const savedMetrics = loadHealthMetrics();
  if (Object.keys(savedMetrics).length > 0) {
    // Merge saved metrics with current origin health
    Object.keys(savedMetrics).forEach(origin => {
      if (originHealth[origin]) {
        originHealth[origin] = { ...originHealth[origin], ...savedMetrics[origin] };
      }
    });
  }
  
  if (healthCheckConfig.enabled) {
    console.log(`🏥 Health checks enabled:`);
    console.log(`   Interval:  ${healthCheckConfig.interval / 1000}s`);
    console.log(`   Timeout:   ${healthCheckConfig.timeout / 1000}s`);
    console.log(`   Path:      ${healthCheckConfig.path}`);
    console.log(`   Method:    ${healthCheckConfig.method}`);
    console.log(`   Origins:   ${healthCheckConfig.origins.length}`);
  }
}

/**
 * Check if an origin is healthy
 * @param {string} origin - Origin URL
 * @returns {Promise<Object>} - { healthy: boolean, responseTime: number, error: string|null }
 */
async function checkOriginHealth(origin) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    try {
      const originUrl = new URL(origin);
      const client = originUrl.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: originUrl.hostname,
        port: originUrl.port || (originUrl.protocol === 'https:' ? 443 : 80),
        path: healthCheckConfig.path,
        method: healthCheckConfig.method,
        timeout: healthCheckConfig.timeout
      };
      
      const req = client.request(options, (res) => {
        const responseTime = Date.now() - startTime;
        
        // Consider 2xx and 3xx as healthy
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({
            healthy: true,
            responseTime,
            error: null,
            statusCode: res.statusCode
          });
        } else {
          resolve({
            healthy: false,
            responseTime,
            error: `HTTP ${res.statusCode}`,
            statusCode: res.statusCode
          });
        }
        
        // Consume response data to free memory
        res.resume();
      });
      
      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        resolve({
          healthy: false,
          responseTime,
          error: error.message,
          statusCode: null
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        const responseTime = Date.now() - startTime;
        resolve({
          healthy: false,
          responseTime,
          error: 'Request timeout',
          statusCode: null
        });
      });
      
      req.end();
    } catch (error) {
      const responseTime = Date.now() - startTime;
      resolve({
        healthy: false,
        responseTime,
        error: error.message,
        statusCode: null
      });
    }
  });
}

/**
 * Perform health check for all configured origins
 */
async function performHealthChecks() {
  if (!healthCheckConfig.enabled || !healthCheckConfig.origins || healthCheckConfig.origins.length === 0) {
    return;
  }
  
  const checkPromises = healthCheckConfig.origins.map(async (origin) => {
    const result = await checkOriginHealth(origin);
    
    // Update health status
    if (!originHealth[origin]) {
      originHealth[origin] = {
        status: 'unknown',
        lastCheck: null,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        totalChecks: 0,
        totalFailures: 0,
        lastError: null,
        uptime: 0,
        uptimePercentage: 0
      };
    }
    
    originHealth[origin].lastCheck = Date.now();
    originHealth[origin].totalChecks++;
    originHealth[origin].responseTime = result.responseTime;
    
    if (result.healthy) {
      originHealth[origin].status = 'healthy';
      originHealth[origin].consecutiveFailures = 0;
      originHealth[origin].consecutiveSuccesses++;
      originHealth[origin].lastError = null;
      originHealth[origin].uptime++;
      console.log(`✅ Health check: ${origin} - healthy (${result.responseTime}ms)`);
    } else {
      originHealth[origin].consecutiveFailures++;
      originHealth[origin].consecutiveSuccesses = 0;
      originHealth[origin].totalFailures++;
      originHealth[origin].lastError = result.error;
      
      // Mark as unhealthy after 3 consecutive failures
      if (originHealth[origin].consecutiveFailures >= 3) {
        originHealth[origin].status = 'unhealthy';
        console.log(`❌ Health check: ${origin} - UNHEALTHY (${result.error})`);
      } else {
        console.log(`⚠️  Health check: ${origin} - degraded (${result.error}) [${originHealth[origin].consecutiveFailures}/3]`);
      }
    }
    
    // Calculate uptime percentage
    if (originHealth[origin].totalChecks > 0) {
      originHealth[origin].uptimePercentage = (
        ((originHealth[origin].totalChecks - originHealth[origin].totalFailures) / originHealth[origin].totalChecks) * 100
      ).toFixed(2);
    }
  });
  
  await Promise.all(checkPromises);
  
  // Save metrics to file
  saveHealthMetrics();
}

/**
 * Start periodic health checks
 */
function startHealthChecks() {
  if (!healthCheckConfig.enabled || healthCheckInterval !== null) {
    return;
  }
  
  // Perform initial check
  performHealthChecks().catch(err => {
    console.error(`⚠️  Health check error: ${err.message}`);
  });
  
  // Schedule periodic checks
  healthCheckInterval = setInterval(() => {
    performHealthChecks().catch(err => {
      console.error(`⚠️  Health check error: ${err.message}`);
    });
  }, healthCheckConfig.interval);
  
  console.log(`🏥 Health checks started (every ${healthCheckConfig.interval / 1000}s)`);
}

/**
 * Stop periodic health checks
 */
function stopHealthChecks() {
  if (healthCheckInterval !== null) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log(`🏥 Health checks stopped`);
  }
}

/**
 * Get health status for a specific origin
 * @param {string} origin - Origin URL
 * @returns {Object} - Health status object
 */
function getOriginHealthStatus(origin) {
  return originHealth[origin] || {
    status: 'unknown',
    lastCheck: null,
    consecutiveFailures: 0,
    lastError: null
  };
}

/**
 * Get health status for all origins
 * @returns {Object} - All origin health statuses
 */
function getAllHealthStatuses() {
  return { ...originHealth };
}

/**
 * Check if health checks are enabled
 * @returns {boolean}
 */
function isHealthCheckEnabled() {
  return healthCheckConfig.enabled;
}

/**
 * Get health check configuration
 * @returns {Object}
 */
function getHealthCheckConfig() {
  return { ...healthCheckConfig };
}

module.exports = {
  configureHealthCheck,
  startHealthChecks,
  stopHealthChecks,
  checkOriginHealth,
  getOriginHealthStatus,
  getAllHealthStatuses,
  isHealthCheckEnabled,
  getHealthCheckConfig
};

