/**
 * Multi-Origin Router Module
 * Routes requests to different origins based on path patterns
 */

/**
 * Router configuration
 */
let routingTable = [];
let defaultOrigin = null;

/**
 * Configure the router with origin mappings
 * @param {Object} originsConfig - Origins configuration object
 * Example:
 * {
 *   "/api/": "https://api.example.com",
 *   "/images/": "https://cdn.example.com",
 *   "default": "https://example.com"
 * }
 */
function configureRouter(originsConfig) {
  if (!originsConfig || typeof originsConfig !== 'object') {
    console.error('⚠️  Invalid origins configuration');
    return;
  }

  // Reset routing table
  routingTable = [];
  defaultOrigin = null;

  // Build routing table from config
  for (const [pattern, origin] of Object.entries(originsConfig)) {
    if (pattern === 'default') {
      defaultOrigin = origin;
      continue;
    }

    // Add to routing table with pattern and origin
    routingTable.push({
      pattern: pattern,
      origin: origin,
      regex: pathPatternToRegex(pattern)
    });
  }

  // Sort by specificity (longer patterns first)
  routingTable.sort((a, b) => b.pattern.length - a.pattern.length);

  // Display configured routes
  console.log('🗺️  Multi-origin routing configured:');
  routingTable.forEach(route => {
    console.log(`   ${route.pattern} → ${route.origin}`);
  });
  if (defaultOrigin) {
    console.log(`   [default] → ${defaultOrigin}`);
  }
}

/**
 * Convert path pattern to regex
 * Supports wildcards:
 * - /api/* matches /api/users, /api/products, etc.
 * - /api/** matches /api/users/1, /api/products/123/details, etc.
 * 
 * @param {string} pattern - Path pattern
 * @returns {RegExp} - Regular expression
 */
function pathPatternToRegex(pattern) {
  // Escape special regex characters except * and /
  let regexStr = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  
  // Replace ** with wildcard that matches everything
  regexStr = regexStr.replace(/\*\*/g, '.*');
  
  // Replace single * with wildcard that matches one segment
  regexStr = regexStr.replace(/\*/g, '[^/]*');
  
  // Anchor to start of string
  regexStr = '^' + regexStr;
  
  return new RegExp(regexStr);
}

/**
 * Match a request path to an origin
 * @param {string} path - Request path (e.g., "/api/users")
 * @returns {Object} - { origin: string, matched: boolean, pattern: string }
 */
function matchOrigin(path) {
  // Try to match against routing table
  for (const route of routingTable) {
    if (route.regex.test(path)) {
      return {
        origin: route.origin,
        matched: true,
        pattern: route.pattern
      };
    }
  }

  // Return default origin if no match
  if (defaultOrigin) {
    return {
      origin: defaultOrigin,
      matched: false,
      pattern: 'default'
    };
  }

  // No match and no default
  return {
    origin: null,
    matched: false,
    pattern: null
  };
}

/**
 * Get the routing table for inspection
 * @returns {Array} - Current routing table
 */
function getRoutingTable() {
  return {
    routes: routingTable.map(r => ({
      pattern: r.pattern,
      origin: r.origin
    })),
    defaultOrigin: defaultOrigin
  };
}

/**
 * Check if multi-origin routing is enabled
 * @returns {boolean} - True if routing table has entries
 */
function isMultiOriginEnabled() {
  return routingTable.length > 0 || defaultOrigin !== null;
}

module.exports = {
  configureRouter,
  matchOrigin,
  getRoutingTable,
  isMultiOriginEnabled
};

