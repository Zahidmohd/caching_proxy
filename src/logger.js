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

// Rotation settings
const ROTATION_CONFIG = {
  enabled: true,
  maxSizeBytes: 10 * 1024 * 1024, // 10MB default
  maxFiles: 7, // Keep last 7 rotated files
  checkDaily: true // Also rotate daily
};

// Track last rotation date for each file
const lastRotationDate = {};

/**
 * Ensure logs directory exists
 */
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Get current date string (YYYY-MM-DD)
 * @returns {string} - Date string
 */
function getCurrentDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Check if file needs rotation based on size
 * @param {string} filePath - Path to log file
 * @returns {boolean} - True if needs rotation
 */
function needsSizeRotation(filePath) {
  if (!ROTATION_CONFIG.enabled) return false;
  
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      return stats.size >= ROTATION_CONFIG.maxSizeBytes;
    }
  } catch (error) {
    console.error(`Error checking file size: ${error.message}`);
  }
  return false;
}

/**
 * Check if file needs daily rotation
 * @param {string} filename - Log file name
 * @returns {boolean} - True if needs rotation
 */
function needsDailyRotation(filename) {
  if (!ROTATION_CONFIG.enabled || !ROTATION_CONFIG.checkDaily) return false;
  
  const currentDate = getCurrentDate();
  const lastDate = lastRotationDate[filename];
  
  if (!lastDate) {
    lastRotationDate[filename] = currentDate;
    return false;
  }
  
  if (lastDate !== currentDate) {
    lastRotationDate[filename] = currentDate;
    return true;
  }
  
  return false;
}

/**
 * Rotate log file
 * @param {string} filename - Log file name (e.g., 'access', 'cache')
 */
function rotateLogFile(filename) {
  try {
    const filePath = LOG_FILES[filename];
    if (!filePath || !fs.existsSync(filePath)) return;
    
    // Generate rotated filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedName = `${filename}-${timestamp}.log`;
    const rotatedPath = path.join(LOG_DIR, rotatedName);
    
    // Rename current file
    fs.renameSync(filePath, rotatedPath);
    
    // Clean up old rotated files
    cleanupOldRotatedFiles(filename);
    
    info(`Log file rotated: ${filename}.log -> ${rotatedName}`);
  } catch (error) {
    console.error(`Error rotating log file ${filename}: ${error.message}`);
  }
}

/**
 * Clean up old rotated log files
 * @param {string} filename - Log file name
 */
function cleanupOldRotatedFiles(filename) {
  try {
    // Get all rotated files for this log type
    const files = fs.readdirSync(LOG_DIR);
    const pattern = new RegExp(`^${filename}-.*\\.log$`);
    const rotatedFiles = files
      .filter(f => pattern.test(f))
      .map(f => ({
        name: f,
        path: path.join(LOG_DIR, f),
        time: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort by time, newest first
    
    // Delete old files beyond maxFiles limit
    if (rotatedFiles.length > ROTATION_CONFIG.maxFiles) {
      const filesToDelete = rotatedFiles.slice(ROTATION_CONFIG.maxFiles);
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          debug(`Deleted old log file: ${file.name}`);
        } catch (error) {
          console.error(`Error deleting old log file: ${error.message}`);
        }
      });
    }
  } catch (error) {
    console.error(`Error cleaning up old log files: ${error.message}`);
  }
}

/**
 * Check and rotate log file if needed
 * @param {string} filename - Log file name
 */
function checkAndRotate(filename) {
  const filePath = LOG_FILES[filename];
  if (!filePath) return;
  
  const needsSize = needsSizeRotation(filePath);
  const needsDaily = needsDailyRotation(filename);
  
  if (needsSize || needsDaily) {
    rotateLogFile(filename);
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
    
    // Check if rotation is needed before writing
    checkAndRotate(filename);
    
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

/**
 * Configure log rotation
 * @param {Object} config - Rotation configuration
 * @param {boolean} config.enabled - Enable/disable rotation
 * @param {number} config.maxSizeMB - Max file size in MB
 * @param {number} config.maxFiles - Max number of rotated files to keep
 * @param {boolean} config.checkDaily - Enable daily rotation
 */
function configureRotation(config = {}) {
  if (config.enabled !== undefined) {
    ROTATION_CONFIG.enabled = config.enabled;
  }
  if (config.maxSizeMB !== undefined) {
    ROTATION_CONFIG.maxSizeBytes = config.maxSizeMB * 1024 * 1024;
  }
  if (config.maxFiles !== undefined) {
    ROTATION_CONFIG.maxFiles = config.maxFiles;
  }
  if (config.checkDaily !== undefined) {
    ROTATION_CONFIG.checkDaily = config.checkDaily;
  }
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
  configureRotation,
  LOG_LEVELS
};

