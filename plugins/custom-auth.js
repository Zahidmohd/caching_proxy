/**
 * Custom Authentication Plugin
 * Adds custom authentication to requests
 */

module.exports = {
  name: 'custom-auth',
  version: '1.0.0',
  description: 'Adds custom authentication headers to outgoing requests',

  onServerStart: async (context, config) => {
    const hasApiKey = config.apiKey && config.apiKey.length > 0;
    const hasToken = config.token && config.token.length > 0;
    
    console.log('[CustomAuth] Plugin started');
    if (hasApiKey) {
      console.log('[CustomAuth] API Key authentication enabled');
    }
    if (hasToken) {
      console.log('[CustomAuth] Token authentication enabled');
    }
    if (!hasApiKey && !hasToken) {
      console.warn('[CustomAuth] ⚠️  No authentication credentials configured');
    }
  },

  beforeRequest: async (context, config) => {
    const { request } = context;
    const modifiedHeaders = { ...request.headers };
    
    // Add API key if configured
    if (config.apiKey) {
      const headerName = config.apiKeyHeader || 'X-API-Key';
      modifiedHeaders[headerName.toLowerCase()] = config.apiKey;
    }
    
    // Add bearer token if configured
    if (config.token) {
      modifiedHeaders['authorization'] = `Bearer ${config.token}`;
    }
    
    // Add custom headers if configured
    if (config.customHeaders) {
      Object.assign(modifiedHeaders, config.customHeaders);
    }
    
    return {
      request: {
        ...request,
        headers: modifiedHeaders
      }
    };
  },

  afterRequest: async (context, config) => {
    // Remove authentication headers from response if configured
    if (config.removeAuthFromResponse) {
      const { response } = context;
      const headers = { ...response.headers };
      
      delete headers['authorization'];
      delete headers['x-api-key'];
      
      return {
        response: {
          ...response,
          headers
        }
      };
    }
  }
};

