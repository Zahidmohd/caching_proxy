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
 * @param {Object} options - { autoClear: boolean, maxVersions: number }
 * @returns {Object} - { changed: boolean, oldVersion: string|null, cleared: boolean }
 */
function checkVersionChange(currentVersion, clearCacheCallback, options = {}) {
  const { autoClear = true, maxVersions = null } = options;
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
  
  // Version has changed
  console.log(`\n🔄 Version changed: ${storedVersion.version} → ${currentVersion || 'none'}`);
  
  let cleared = false;
  let clearedCount = 0;
  
  // Only auto-clear if enabled
  if (autoClear) {
    console.log(`🗑️  Auto-clearing old cache entries...`);
    
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
  } else {
    console.log(`ℹ️  Auto-clear disabled - keeping old cache entries`);
    console.log(`💡 Multiple versions will coexist in cache`);
  }
  
  // Check version count limit if specified
  if (maxVersions && maxVersions > 0 && !autoClear) {
    try {
      const versionCount = countCacheVersions();
      if (versionCount > maxVersions) {
        console.log(`⚠️  Cache has ${versionCount} versions, limit is ${maxVersions}`);
        console.log(`🗑️  Removing oldest versions...`);
        const removed = removeOldestVersions(maxVersions);
        console.log(`✅ Removed ${removed.count} entries from ${removed.versions.length} old version(s)`);
      }
    } catch (error) {
      console.error(`❌ Error checking version limit: ${error.message}`);
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

/**
 * Count how many different versions exist in cache
 * @returns {number} - Number of unique versions
 */
function countCacheVersions() {
  try {
    const fs = require('fs');
    const CACHE_FILE = path.join(CACHE_DIR, 'cache-data.json');
    
    if (!fs.existsSync(CACHE_FILE)) {
      return 0;
    }
    
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    const cache = JSON.parse(data);
    
    const versions = new Set();
    
    for (const key of Object.keys(cache)) {
      // Extract version from key (format: VERSION:ORIGIN_HASH:METHOD:URL)
      const versionMatch = key.match(/^([^:]+):/);
      if (versionMatch) {
        versions.add(versionMatch[1]);
      }
    }
    
    return versions.size;
  } catch (error) {
    console.error(`❌ Error counting cache versions: ${error.message}`);
    return 0;
  }
}

/**
 * Get all versions in cache with their entry counts
 * @returns {Array} - Array of { version, count, oldestEntry, newestEntry }
 */
function getCacheVersions() {
  try {
    const fs = require('fs');
    const CACHE_FILE = path.join(CACHE_DIR, 'cache-data.json');
    
    if (!fs.existsSync(CACHE_FILE)) {
      return [];
    }
    
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    const cache = JSON.parse(data);
    
    const versionMap = new Map();
    
    for (const [key, entry] of Object.entries(cache)) {
      // Extract version from key
      const versionMatch = key.match(/^([^:]+):/);
      if (versionMatch) {
        const version = versionMatch[1];
        
        if (!versionMap.has(version)) {
          versionMap.set(version, {
            version: version,
            count: 0,
            oldestEntry: entry.cachedAt,
            newestEntry: entry.cachedAt
          });
        }
        
        const versionInfo = versionMap.get(version);
        versionInfo.count++;
        versionInfo.oldestEntry = Math.min(versionInfo.oldestEntry, entry.cachedAt);
        versionInfo.newestEntry = Math.max(versionInfo.newestEntry, entry.cachedAt);
      }
    }
    
    // Sort by oldest entry (oldest versions first)
    return Array.from(versionMap.values()).sort((a, b) => a.oldestEntry - b.oldestEntry);
  } catch (error) {
    console.error(`❌ Error getting cache versions: ${error.message}`);
    return [];
  }
}

/**
 * Remove oldest versions to stay within limit
 * @param {number} maxVersions - Maximum number of versions to keep
 * @returns {Object} - { count: number, versions: Array<string> }
 */
function removeOldestVersions(maxVersions) {
  try {
    const versions = getCacheVersions();
    
    if (versions.length <= maxVersions) {
      return { count: 0, versions: [] };
    }
    
    // Calculate how many versions to remove
    const versionsToRemove = versions.slice(0, versions.length - maxVersions);
    
    let totalRemoved = 0;
    const removedVersions = [];
    
    for (const versionInfo of versionsToRemove) {
      const result = clearVersionCache(versionInfo.version);
      totalRemoved += result.cleared;
      removedVersions.push(versionInfo.version);
    }
    
    return {
      count: totalRemoved,
      versions: removedVersions
    };
  } catch (error) {
    console.error(`❌ Error removing oldest versions: ${error.message}`);
    return { count: 0, versions: [] };
  }
}

module.exports = {
  checkVersionChange,
  clearVersionCache,
  getCurrentVersionInfo,
  saveVersion,
  loadStoredVersion,
  countCacheVersions,
  getCacheVersions,
  removeOldestVersions
};

