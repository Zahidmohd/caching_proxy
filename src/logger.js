/**
 * Logging Module
 * Simple logging system with multiple levels and file support
 */

const fs = require('fs');
const path = require('path');

// Log levels (in order of severity)
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Current log level (default: info)
let currentLevel = 'info';

// Log directory
const LOG_DIR = path.join(__dirname, '..', 'logs');

// Log file paths
const LOG_FILES = {
  access: path.join(LOG_DIR, 'access.log'),
  cache: path.join(LOG_DIR, 'cache.log'),
  error: path.join(LOG_DIR, 'error.log'),
  performance: path.join(LOG_DIR, 'performance.log')
};

/**
 * Ensure logs directory exists
 */
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Write to a log file
 * @param {string} filename - Log file name (e.g., 'access', 'cache', 'error', 'performance')
 * @param {string} message - Message to write
 */
function writeToFile(filename, message) {
  try {
    ensureLogDir();
    const filePath = LOG_FILES[filename];
    if (!filePath) {
      console.error(`Unknown log file: ${filename}`);
      return;
    }
    
    const logLine = message + '\n';
    fs.appendFileSync(filePath, logLine, 'utf8');
  } catch (error) {
    console.error(`Error writing to log file ${filename}:`, error.message);
  }
}

/**
 * Set the log level
 * @param {string} level - Log level: 'debug', 'info', 'warn', 'error'
 */
function setLogLevel(level) {
  if (LOG_LEVELS[level] === undefined) {
    console.error(`Invalid log level: ${level}. Using 'info' instead.`);
    currentLevel = 'info';
    return;
  }
  currentLevel = level;
}

/**
 * Get current log level
 * @returns {string} - Current log level
 */
function getLogLevel() {
  return currentLevel;
}

/**
 * Check if a message should be logged based on current level
 * @param {string} level - Level of the message
 * @returns {boolean} - True if should log
 */
function shouldLog(level) {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Format timestamp
 * @returns {string} - Formatted timestamp
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString();
}

/**
 * Log a debug message
 * @param {string} message - Message to log
 * @param {Object} meta - Optional metadata
 */
function debug(message, meta = null) {
  if (!shouldLog('debug')) return;
  
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] [DEBUG] ${message}`);
  if (meta) {
    console.log('  Meta:', meta);
  }
}

/**
 * Log an info message
 * @param {string} message - Message to log
 * @param {Object} meta - Optional metadata
 */
function info(message, meta = null) {
  if (!shouldLog('info')) return;
  
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] [INFO] ${message}`);
  if (meta) {
    console.log('  Meta:', meta);
  }
}

/**
 * Log a warning message
 * @param {string} message - Message to log
 * @param {Object} meta - Optional metadata
 */
function warn(message, meta = null) {
  if (!shouldLog('warn')) return;
  
  const timestamp = getTimestamp();
  console.warn(`[${timestamp}] [WARN] ${message}`);
  if (meta) {
    console.warn('  Meta:', meta);
  }
}

/**
 * Log an error message
 * @param {string} message - Message to log
 * @param {Object} meta - Optional metadata
 */
function error(message, meta = null) {
  if (!shouldLog('error')) return;
  
  const timestamp = getTimestamp();
  console.error(`[${timestamp}] [ERROR] ${message}`);
  if (meta) {
    console.error('  Meta:', meta);
  }
}

/**
 * Log an access event (request/response)
 * @param {Object} data - Access data
 * @param {string} data.method - HTTP method
 * @param {string} data.url - Request URL
 * @param {number} data.statusCode - Response status code
 * @param {string} data.cacheStatus - Cache status (HIT/MISS)
 * @param {number} data.responseTime - Response time in ms
 */
function logAccess(data) {
  const timestamp = getTimestamp();
  const { method, url, statusCode, cacheStatus, responseTime } = data;
  
  const message = `[${timestamp}] ${method} ${url} - ${statusCode} - ${cacheStatus} - ${responseTime}ms`;
  
  // Write to access.log
  writeToFile('access', message);
  
  // Also log to console if level allows
  info(`${method} ${url} - ${statusCode} - ${cacheStatus} - ${responseTime}ms`);
}

/**
 * Log a cache event (HIT/MISS)
 * @param {Object} data - Cache data
 * @param {string} data.status - HIT, MISS, or EXPIRED
 * @param {string} data.key - Cache key
 * @param {number} data.size - Size in bytes (optional)
 */
function logCache(data) {
  const timestamp = getTimestamp();
  const { status, key, size } = data;
  
  let message = `[${timestamp}] ${status}: ${key}`;
  if (size) {
    message += ` (${size} bytes)`;
  }
  
  // Write to cache.log
  writeToFile('cache', message);
  
  // Also log to console as debug
  debug(`Cache ${status}: ${key}`);
}

/**
 * Log an error to error.log
 * @param {string} message - Error message
 * @param {Object} meta - Error metadata
 */
function logError(message, meta = null) {
  const timestamp = getTimestamp();
  
  let logMessage = `[${timestamp}] ERROR: ${message}`;
  if (meta) {
    logMessage += ` | Meta: ${JSON.stringify(meta)}`;
  }
  
  // Write to error.log
  writeToFile('error', logMessage);
  
  // Also log to console
  error(message, meta);
}

/**
 * Log performance metrics
 * @param {Object} data - Performance data
 * @param {string} data.operation - Operation name (e.g., 'cache-hit', 'cache-miss')
 * @param {number} data.duration - Duration in ms
 * @param {string} data.url - URL (optional)
 * @param {Object} data.meta - Additional metadata (optional)
 */
function logPerformance(data) {
  const timestamp = getTimestamp();
  const { operation, duration, url, meta } = data;
  
  let message = `[${timestamp}] ${operation} - ${duration}ms`;
  if (url) {
    message += ` - ${url}`;
  }
  if (meta) {
    message += ` | ${JSON.stringify(meta)}`;
  }
  
  // Write to performance.log
  writeToFile('performance', message);
  
  // Also log to console as debug
  debug(`Performance: ${operation} - ${duration}ms`);
}

module.exports = {
  setLogLevel,
  getLogLevel,
  debug,
  info,
  warn,
  error,
  logAccess,
  logCache,
  logError,
  logPerformance,
  LOG_LEVELS
};

