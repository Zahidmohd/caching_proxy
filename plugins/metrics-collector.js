/**
 * Metrics Collector Plugin
 * Collects and aggregates metrics about requests
 */

const metrics = {
  requests: {
    total: 0,
    byMethod: {},
    byStatus: {},
    byPath: {}
  },
  cache: {
    hits: 0,
    misses: 0,
    stores: 0
  },
  performance: {
    totalResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    responseTimes: []
  },
  errors: {
    total: 0,
    byStage: {}
  }
};

module.exports = {
  name: 'metrics-collector',
  version: '1.0.0',
  description: 'Collects detailed metrics about proxy usage',

  onServerStart: async (context, config) => {
    console.log('[MetricsCollector] Plugin started - collecting metrics');
    
    // Reset metrics on start if configured
    if (config.resetOnStart) {
      Object.assign(metrics, {
        requests: { total: 0, byMethod: {}, byStatus: {}, byPath: {} },
        cache: { hits: 0, misses: 0, stores: 0 },
        performance: { totalResponseTime: 0, minResponseTime: Infinity, maxResponseTime: 0, responseTimes: [] },
        errors: { total: 0, byStage: {} }
      });
    }
  },

  beforeRequest: async (context, config) => {
    const { request } = context;
    
    // Track request count
    metrics.requests.total++;
    
    // Track by method
    metrics.requests.byMethod[request.method] = 
      (metrics.requests.byMethod[request.method] || 0) + 1;
    
    // Track by path
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      metrics.requests.byPath[path] = 
        (metrics.requests.byPath[path] || 0) + 1;
    } catch (e) {
      // Invalid URL, skip path tracking
    }
  },

  afterRequest: async (context, config) => {
    const { response, responseTime } = context;
    
    // Track by status
    const statusCategory = `${Math.floor(response.statusCode / 100)}xx`;
    metrics.requests.byStatus[statusCategory] = 
      (metrics.requests.byStatus[statusCategory] || 0) + 1;
    
    // Track response times
    metrics.performance.totalResponseTime += responseTime;
    metrics.performance.minResponseTime = Math.min(
      metrics.performance.minResponseTime,
      responseTime
    );
    metrics.performance.maxResponseTime = Math.max(
      metrics.performance.maxResponseTime,
      responseTime
    );
    
    // Keep last N response times for percentile calculation
    metrics.performance.responseTimes.push(responseTime);
    if (metrics.performance.responseTimes.length > 1000) {
      metrics.performance.responseTimes.shift();
    }
  },

  onCacheHit: async (context, config) => {
    metrics.cache.hits++;
  },

  onCacheMiss: async (context, config) => {
    metrics.cache.misses++;
  },

  onCacheStore: async (context, config) => {
    metrics.cache.stores++;
  },

  onError: async (context, config) => {
    const { stage } = context;
    
    metrics.errors.total++;
    metrics.errors.byStage[stage] = 
      (metrics.errors.byStage[stage] || 0) + 1;
  },

  // Custom method to get metrics (can be called externally)
  getMetrics: () => {
    const avgResponseTime = metrics.requests.total > 0
      ? metrics.performance.totalResponseTime / metrics.requests.total
      : 0;
    
    // Calculate cache hit rate
    const totalCacheRequests = metrics.cache.hits + metrics.cache.misses;
    const cacheHitRate = totalCacheRequests > 0
      ? (metrics.cache.hits / totalCacheRequests * 100).toFixed(2)
      : 0;
    
    return {
      ...metrics,
      calculated: {
        avgResponseTime: Math.round(avgResponseTime),
        cacheHitRate: `${cacheHitRate}%`,
        errorRate: metrics.requests.total > 0
          ? ((metrics.errors.total / metrics.requests.total) * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }
};

