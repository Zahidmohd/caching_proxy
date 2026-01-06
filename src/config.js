/**
 * Configuration Module
 * Handles loading, parsing, and validating configuration files
 */

const fs = require('fs');
const path = require('path');

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  server: {
    port: 3000,
    host: 'localhost'
  },
  cache: {
    enabled: true,
    defaultTTL: 300,
    maxEntries: 1000,
    maxSizeMB: 100,
    strategy: 'lru',
    storageDir: './cache',
    version: null,
    versioning: {
      enabled: false,
      autoClear: true,
      maxVersions: 3,
      allowVersionHeader: false,
      versionHeader: 'X-API-Version'
    }
  },
  security: {
    excludeAuthenticatedRequests: true,
    maxRequestSize: '10mb'
  },
  logging: {
    enabled: true,
    level: 'info',
    format: 'text',
    console: {
      enabled: true,
      colorize: true
    }
  },
  analytics: {
    enabled: true,
    file: './cache/analytics.json',
    trackPerformance: true,
    trackBandwidth: true
  }
};

/**
 * Load environment variables from .env file
 */
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      lines.forEach(line => {
        // Skip empty lines and comments
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        
        // Parse KEY=VALUE
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          // Don't override existing env vars
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      
      console.log('✅ Loaded environment variables from .env file');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not load .env file: ${error.message}`);
    }
  }
}

/**
 * Substitute environment variables in a string
 * Supports ${VAR_NAME} syntax
 * @param {string} value - String that may contain ${VAR_NAME}
 * @returns {string} - String with variables substituted
 */
function substituteEnvVars(value) {
  if (typeof value !== 'string') return value;
  
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      console.warn(`⚠️  Warning: Environment variable ${varName} not set`);
      return match; // Keep ${VAR_NAME} if not found
    }
    return envValue;
  });
}

/**
 * Recursively substitute environment variables in an object
 * @param {*} obj - Object to process
 * @returns {*} - Object with variables substituted
 */
function substituteEnvVarsRecursive(obj) {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => substituteEnvVarsRecursive(item));
  }
  
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      result[key] = substituteEnvVarsRecursive(obj[key]);
    }
    return result;
  }
  
  return obj;
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Validate configuration
 * @param {Object} config - Configuration object
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateConfig(config) {
  const errors = [];
  
  // Required: server.origin OR origins (multi-origin routing)
  if (!config.origins && (!config.server || !config.server.origin)) {
    errors.push('Either server.origin or origins configuration is required');
  }
  
  // Validate: server.port
  if (config.server && config.server.port) {
    const port = parseInt(config.server.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('server.port must be a number between 1 and 65535');
    }
  }
  
  // Validate: cache.defaultTTL
  if (config.cache && config.cache.defaultTTL !== undefined) {
    const ttl = parseInt(config.cache.defaultTTL, 10);
    if (isNaN(ttl) || ttl < 0) {
      errors.push('cache.defaultTTL must be a non-negative number');
    }
  }
  
  // Validate: cache.maxEntries
  if (config.cache && config.cache.maxEntries !== undefined) {
    const maxEntries = parseInt(config.cache.maxEntries, 10);
    if (isNaN(maxEntries) || maxEntries < 1) {
      errors.push('cache.maxEntries must be a positive number');
    }
  }
  
  // Validate: logging.level
  if (config.logging && config.logging.level) {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(config.logging.level)) {
      errors.push(`logging.level must be one of: ${validLevels.join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Load configuration from file
 * @param {string} configPath - Path to configuration file
 * @returns {Object} - Parsed configuration object
 */
function loadConfigFile(configPath) {
  // Resolve relative paths
  const fullPath = path.resolve(process.cwd(), configPath);
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }
  
  try {
    // Read file
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Parse JSON
    const config = JSON.parse(content);
    
    console.log(`✅ Loaded configuration from: ${configPath}`);
    
    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Load and merge configuration
 * @param {Object} options - Options object
 * @param {string} options.configPath - Path to config file
 * @param {Object} options.cliArgs - Command-line arguments
 * @returns {Object} - Final merged configuration
 */
function loadConfig(options = {}) {
  const { configPath, cliArgs = {} } = options;
  
  // Load .env file first
  loadEnvFile();
  
  let config = { ...DEFAULT_CONFIG };
  
  // Load config file if provided
  if (configPath) {
    try {
      const fileConfig = loadConfigFile(configPath);
      config = deepMerge(config, fileConfig);
    } catch (error) {
      console.error(`❌ Error loading configuration file: ${error.message}`);
      process.exit(1);
    }
  }
  
  // Substitute environment variables
  config = substituteEnvVarsRecursive(config);
  
  // Merge CLI arguments (highest priority)
  if (cliArgs.port) {
    config.server.port = parseInt(cliArgs.port, 10);
  }
  if (cliArgs.origin) {
    config.server.origin = cliArgs.origin;
  }
  if (cliArgs.logLevel) {
    config.logging.level = cliArgs.logLevel;
  }
  if (cliArgs.versionTag) {
    config.cache.version = cliArgs.versionTag;
  }
  
  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.error('\n❌ Configuration validation failed:\n');
    validation.errors.forEach(error => {
      console.error(`   - ${error}`);
    });
    console.error();
    process.exit(1);
  }
  
  return config;
}

/**
 * Display configuration summary
 * @param {Object} config - Configuration object
 */
function displayConfigSummary(config) {
  console.log('\n⚙️  Configuration Summary:');
  console.log(`   Server:    ${config.server.host}:${config.server.port}`);
  console.log(`   Origin:    ${config.server.origin}`);
  console.log(`   Cache TTL: ${config.cache.defaultTTL}s`);
  if (config.cache.version) {
    console.log(`   Cache Version: ${config.cache.version} 🏷️`);
  }
  if (config.cache.customTTL) {
    const customCount = Object.keys(config.cache.customTTL).length;
    if (customCount > 0) {
      console.log(`   Custom TTL: ${customCount} pattern(s) configured`);
    }
  }
  if (config.logging) {
    console.log(`   Log Level: ${config.logging.level || 'info'}`);
    console.log(`   Log Format: ${config.logging.format || 'text'}`);
  }
  console.log();
}

module.exports = {
  loadConfig,
  validateConfig,
  displayConfigSummary,
  DEFAULT_CONFIG
};

