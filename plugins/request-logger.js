/**
 * Request Logger Plugin
 * Logs all requests with detailed information
 */

module.exports = {
  name: 'request-logger',
  version: '1.0.0',
  description: 'Logs all incoming requests and responses',

  /**
   * Called when server starts
   */
  onServerStart: async (context, config) => {
    const logLevel = config.logLevel || 'info';
    console.log(`[RequestLogger] Plugin started with log level: ${logLevel}`);
    console.log(`[RequestLogger] Monitoring server on port ${context.port}`);
  },

  /**
   * Called before processing each request
   */
  beforeRequest: async (context, config) => {
    const { request, requestId, clientIP } = context;
    
    if (config.logLevel === 'debug') {
      console.log(`[RequestLogger] ${requestId} - ${request.method} ${request.url}`);
      console.log(`[RequestLogger] Client IP: ${clientIP}`);
      console.log(`[RequestLogger] Headers: ${JSON.stringify(request.headers, null, 2)}`);
    } else {
      console.log(`[RequestLogger] ${requestId} - ${clientIP} → ${request.method} ${request.url}`);
    }

    // Add custom header to track plugin
    return {
      request: {
        ...request,
        headers: {
          ...request.headers,
          'x-logged-by': 'request-logger-plugin'
        }
      }
    };
  },

  /**
   * Called after request completes
   */
  afterRequest: async (context, config) => {
    const { request, response, requestId, responseTime, cacheStatus } = context;
    
    const logMessage = [
      `[RequestLogger] ${requestId}`,
      `${request.method} ${request.url}`,
      `→ ${response.statusCode}`,
      `[${cacheStatus}]`,
      `(${responseTime}ms)`
    ].join(' ');
    
    console.log(logMessage);

    if (config.logLevel === 'debug') {
      console.log(`[RequestLogger] Response headers: ${JSON.stringify(response.headers, null, 2)}`);
    }
  },

  /**
   * Called when cache hit occurs
   */
  onCacheHit: async (context, config) => {
    if (config.logCacheEvents) {
      console.log(`[RequestLogger] ✅ Cache HIT: ${context.cacheKey}`);
    }
  },

  /**
   * Called when cache miss occurs
   */
  onCacheMiss: async (context, config) => {
    if (config.logCacheEvents) {
      console.log(`[RequestLogger] ❌ Cache MISS: ${context.cacheKey}`);
    }
  },

  /**
   * Called when error occurs
   */
  onError: async (context, config) => {
    const { error, request, requestId, stage } = context;
    console.error(`[RequestLogger] ⚠️  ERROR in ${stage}: ${error.message}`);
    console.error(`[RequestLogger] Request: ${request.method} ${request.url} (${requestId})`);
  }
};

