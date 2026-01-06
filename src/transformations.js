/**
 * Transformations Module
 * Handles loading and executing JavaScript transformation scripts
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Loaded transformation scripts
let beforeRequestTransform = null;
let afterResponseTransform = null;

/**
 * Load a transformation script from file
 * @param {string} scriptPath - Path to the JavaScript file
 * @returns {Function|null} - The transformation function or null if loading fails
 */
function loadTransformationScript(scriptPath) {
  if (!scriptPath) {
    return null;
  }

  try {
    const fullPath = path.resolve(process.cwd(), scriptPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Transformation script not found: ${scriptPath}`);
      return null;
    }

    // Read the script file
    const scriptCode = fs.readFileSync(fullPath, 'utf8');
    
    // Create a sandbox context with limited access
    const sandbox = {
      console: console,
      Buffer: Buffer,
      // Add safe globals if needed
    };
    
    // Create context
    const context = vm.createContext(sandbox);
    
    // Execute the script in the sandbox
    const script = new vm.Script(scriptCode, {
      filename: fullPath,
      displayErrors: true
    });
    
    script.runInContext(context);
    
    // The script should export a function
    if (typeof sandbox.transform === 'function') {
      console.log(`✅ Loaded transformation script: ${scriptPath}`);
      return sandbox.transform;
    } else if (typeof sandbox.module !== 'undefined' && typeof sandbox.module.exports === 'function') {
      console.log(`✅ Loaded transformation script: ${scriptPath}`);
      return sandbox.module.exports;
    } else {
      console.error(`❌ Transformation script must export a 'transform' function or use module.exports: ${scriptPath}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error loading transformation script ${scriptPath}:`, error.message);
    return null;
  }
}

/**
 * Configure transformation scripts
 * @param {Object} config - Transformation configuration
 * @param {string} config.beforeRequest - Path to beforeRequest script
 * @param {string} config.afterResponse - Path to afterResponse script
 */
function configureTransformations(config = {}) {
  if (!config || typeof config !== 'object') {
    return;
  }

  // Load beforeRequest transformation
  if (config.beforeRequest) {
    beforeRequestTransform = loadTransformationScript(config.beforeRequest);
    if (beforeRequestTransform) {
      console.log('🔧 beforeRequest transformation enabled');
    }
  }

  // Load afterResponse transformation
  if (config.afterResponse) {
    afterResponseTransform = loadTransformationScript(config.afterResponse);
    if (afterResponseTransform) {
      console.log('🔧 afterResponse transformation enabled');
    }
  }
}

/**
 * Apply beforeRequest transformation
 * @param {Object} request - Request object { method, url, headers, body }
 * @returns {Object} - Transformed request object
 */
async function applyBeforeRequest(request) {
  if (!beforeRequestTransform) {
    return request;
  }

  try {
    const result = await Promise.resolve(beforeRequestTransform(request));
    
    // Validate result
    if (!result || typeof result !== 'object') {
      console.warn('⚠️  beforeRequest transform returned invalid result, using original request');
      return request;
    }

    return result;
  } catch (error) {
    console.error('❌ Error in beforeRequest transformation:', error.message);
    return request; // Return original request on error
  }
}

/**
 * Apply afterResponse transformation
 * @param {Object} response - Response object { statusCode, headers, body }
 * @returns {Object} - Transformed response object
 */
async function applyAfterResponse(response) {
  if (!afterResponseTransform) {
    return response;
  }

  try {
    const result = await Promise.resolve(afterResponseTransform(response));
    
    // Validate result
    if (!result || typeof result !== 'object') {
      console.warn('⚠️  afterResponse transform returned invalid result, using original response');
      return response;
    }

    return result;
  } catch (error) {
    console.error('❌ Error in afterResponse transformation:', error.message);
    return response; // Return original response on error
  }
}

/**
 * Check if transformations are enabled
 * @returns {Object} - Status of transformations { beforeRequest: boolean, afterResponse: boolean }
 */
function isTransformationEnabled() {
  return {
    beforeRequest: beforeRequestTransform !== null,
    afterResponse: afterResponseTransform !== null
  };
}

module.exports = {
  configureTransformations,
  applyBeforeRequest,
  applyAfterResponse,
  isTransformationEnabled
};

