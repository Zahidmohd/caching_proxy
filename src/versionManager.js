/**
 * Version Manager Module
 * Handles cache version tracking and auto-clearing on version changes
 */

const fs = require('fs');
const path = require('path');

// Version tracking file path
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const VERSION_FILE = path.join(CACHE_DIR, 'version.json');

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load stored version information
 * @returns {Object} - { version: string, timestamp: number, cacheCleared: boolean }
 */
function loadStoredVersion() {
  try {
    ensureCacheDir();
    if (fs.existsSync(VERSION_FILE)) {
      const data = fs.readFileSync(VERSION_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not load version file: ${error.message}`);
  }
  
  return null;
}

/**
 * Save version information
 * @param {string} version - Current version
 * @param {boolean} cacheCleared - Whether cache was cleared
 */
function saveVersion(version, cacheCleared = false) {
  try {
    ensureCacheDir();
    const versionInfo = {
      version: version || 'none',
      timestamp: Date.now(),
      cacheCleared: cacheCleared,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionInfo, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Error saving version file: ${error.message}`);
  }
}

/**
 * Check if version has changed and handle cache clearing
 * @param {string} currentVersion - Current cache version
 * @param {Function} clearCacheCallback - Function to call to clear cache
 * @returns {Object} - { changed: boolean, oldVersion: string|null, cleared: boolean }
 */
function checkVersionChange(currentVersion, clearCacheCallback) {
  const storedVersion = loadStoredVersion();
  
  // If no stored version, this is the first run
  if (!storedVersion) {
    console.log(`🏷️  First run with version: ${currentVersion || 'none'}`);
    saveVersion(currentVersion, false);
    return {
      changed: false,
      oldVersion: null,
      cleared: false,
      firstRun: true
    };
  }
  
  // If versions are the same, no action needed
  if (storedVersion.version === (currentVersion || 'none')) {
    console.log(`🏷️  Version unchanged: ${currentVersion || 'none'}`);
    return {
      changed: false,
      oldVersion: storedVersion.version,
      cleared: false,
      firstRun: false
    };
  }
  
  // Version has changed - clear cache
  console.log(`\n🔄 Version changed: ${storedVersion.version} → ${currentVersion || 'none'}`);
  console.log(`🗑️  Auto-clearing old cache entries...`);
  
  let cleared = false;
  let clearedCount = 0;
  
  if (clearCacheCallback && typeof clearCacheCallback === 'function') {
    try {
      const result = clearCacheCallback(storedVersion.version);
      cleared = true;
      clearedCount = result.cleared || 0;
      console.log(`✅ Cleared ${clearedCount} cache entries from version ${storedVersion.version}`);
    } catch (error) {
      console.error(`❌ Error clearing cache: ${error.message}`);
    }
  }
  
  // Save new version
  saveVersion(currentVersion, cleared);
  console.log(`🏷️  Cache version updated to: ${currentVersion || 'none'}\n`);
  
  return {
    changed: true,
    oldVersion: storedVersion.version,
    newVersion: currentVersion || 'none',
    cleared: cleared,
    clearedCount: clearedCount,
    firstRun: false
  };
}

/**
 * Clear cache entries for a specific version
 * @param {string} version - Version to clear
 * @returns {Object} - { cleared: number, keys: Array<string> }
 */
function clearVersionCache(version) {
  try {
    const fs = require('fs');
    const CACHE_FILE = path.join(CACHE_DIR, 'cache-data.json');
    
    if (!fs.existsSync(CACHE_FILE)) {
      return { cleared: 0, keys: [] };
    }
    
    // Load cache data
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    const cache = JSON.parse(data);
    
    const keysToRemove = [];
    const versionPrefix = version ? `${version}:` : '';
    
    // Find all keys with this version prefix
    for (const key of Object.keys(cache)) {
      if (version === 'none') {
        // Clear keys without version prefix (old entries before versioning)
        if (!key.includes(':') || !key.match(/^[^:]+:[a-f0-9]{8}:/)) {
          keysToRemove.push(key);
        }
      } else if (versionPrefix && key.startsWith(versionPrefix)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove matched entries
    keysToRemove.forEach(key => delete cache[key]);
    
    // Save cache if we removed entries
    if (keysToRemove.length > 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    }
    
    return {
      cleared: keysToRemove.length,
      keys: keysToRemove
    };
  } catch (error) {
    console.error(`❌ Error clearing version cache: ${error.message}`);
    return {
      cleared: 0,
      keys: []
    };
  }
}

/**
 * Get current version information
 * @returns {Object|null} - Current version info or null
 */
function getCurrentVersionInfo() {
  return loadStoredVersion();
}

module.exports = {
  checkVersionChange,
  clearVersionCache,
  getCurrentVersionInfo,
  saveVersion,
  loadStoredVersion
};

