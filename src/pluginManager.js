/**
 * Plugin Manager Module
 * Manages loading and execution of plugins with lifecycle hooks
 */

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

/**
 * Plugin Manager Class
 * Handles plugin loading, validation, and lifecycle hook execution
 */
class PluginManager {
  constructor() {
    this.plugins = [];
    this.hooks = {
      onServerStart: [],
      beforeRequest: [],
      afterRequest: [],
      onCacheHit: [],
      onCacheMiss: [],
      onCacheStore: [],
      onError: [],
      onServerStop: []
    };
    this.enabled = false;
  }

  /**
   * Load plugins from configuration
   * @param {Array} pluginConfigs - Array of plugin configurations
   * @returns {Object} Loading statistics
   */
  loadPlugins(pluginConfigs) {
    if (!pluginConfigs || !Array.isArray(pluginConfigs)) {
      return { loaded: 0, failed: 0, plugins: [] };
    }

    const stats = {
      loaded: 0,
      failed: 0,
      plugins: [],
      errors: []
    };

    for (const config of pluginConfigs) {
      try {
        const plugin = this.loadPlugin(config);
        if (plugin) {
          this.plugins.push(plugin);
          this.registerHooks(plugin);
          stats.loaded++;
          stats.plugins.push(plugin.name);
          console.log(`✅ Plugin loaded: ${plugin.name}`);
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          name: config.name || config.path,
          error: error.message
        });
        console.error(`❌ Failed to load plugin: ${config.name || config.path}`);
        console.error(`   Error: ${error.message}`);
      }
    }

    if (stats.loaded > 0) {
      this.enabled = true;
    }

    return stats;
  }

  /**
   * Load a single plugin
   * @param {Object} config - Plugin configuration
   * @returns {Object} Loaded plugin
   */
  loadPlugin(config) {
    // Validate configuration
    if (!config.path) {
      throw new Error('Plugin path is required');
    }

    // Resolve plugin path
    const pluginPath = path.resolve(config.path);

    // Check if file exists
    if (!fs.existsSync(pluginPath)) {
      throw new Error(`Plugin file not found: ${pluginPath}`);
    }

    // Load plugin module
    let pluginModule;
    try {
      // Clear require cache for hot reload support
      delete require.cache[require.resolve(pluginPath)];
      pluginModule = require(pluginPath);
    } catch (error) {
      throw new Error(`Failed to require plugin: ${error.message}`);
    }

    // Validate plugin structure
    if (typeof pluginModule !== 'object') {
      throw new Error('Plugin must export an object');
    }

    // Create plugin object
    const plugin = {
      name: config.name || path.basename(pluginPath, path.extname(pluginPath)),
      version: pluginModule.version || '1.0.0',
      description: pluginModule.description || '',
      enabled: config.enabled !== false,
      config: config.config || {},
      hooks: {},
      module: pluginModule
    };

    // Register hook functions
    const hookNames = Object.keys(this.hooks);
    for (const hookName of hookNames) {
      if (typeof pluginModule[hookName] === 'function') {
        plugin.hooks[hookName] = pluginModule[hookName];
      }
    }

    return plugin;
  }

  /**
   * Register plugin hooks
   * @param {Object} plugin - Plugin object
   */
  registerHooks(plugin) {
    if (!plugin.enabled) {
      return;
    }

    for (const [hookName, hookFn] of Object.entries(plugin.hooks)) {
      if (this.hooks[hookName]) {
        this.hooks[hookName].push({
          pluginName: plugin.name,
          fn: hookFn,
          config: plugin.config
        });
      }
    }
  }

  /**
   * Execute a lifecycle hook
   * @param {string} hookName - Name of the hook
   * @param {Object} context - Hook context data
   * @returns {Promise<Object>} Modified context
   */
  async executeHook(hookName, context) {
    if (!this.enabled || !this.hooks[hookName]) {
      return context;
    }

    const hooks = this.hooks[hookName];
    let currentContext = { ...context };

    for (const hook of hooks) {
      try {
        const result = await Promise.resolve(
          hook.fn(currentContext, hook.config)
        );

        // If hook returns an object, merge it with context
        if (result && typeof result === 'object') {
          currentContext = { ...currentContext, ...result };
        }
      } catch (error) {
        console.error(`❌ Plugin error in ${hook.pluginName}.${hookName}:`);
        console.error(`   ${error.message}`);
        
        // Don't break the chain, continue with other plugins
        // But track the error
        if (!currentContext.pluginErrors) {
          currentContext.pluginErrors = [];
        }
        currentContext.pluginErrors.push({
          plugin: hook.pluginName,
          hook: hookName,
          error: error.message
        });
      }
    }

    return currentContext;
  }

  /**
   * Get plugin statistics
   * @returns {Object} Plugin statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      totalPlugins: this.plugins.length,
      enabledPlugins: this.plugins.filter(p => p.enabled).length,
      plugins: this.plugins.map(p => ({
        name: p.name,
        version: p.version,
        description: p.description,
        enabled: p.enabled,
        hooks: Object.keys(p.hooks)
      })),
      hookCounts: Object.fromEntries(
        Object.entries(this.hooks).map(([name, hooks]) => [name, hooks.length])
      )
    };
  }

  /**
   * Reload a plugin by name
   * @param {string} pluginName - Name of plugin to reload
   * @returns {boolean} Success status
   */
  reloadPlugin(pluginName) {
    const pluginIndex = this.plugins.findIndex(p => p.name === pluginName);
    if (pluginIndex === -1) {
      return false;
    }

    const plugin = this.plugins[pluginIndex];
    
    // Remove old hooks
    for (const hookName of Object.keys(this.hooks)) {
      this.hooks[hookName] = this.hooks[hookName].filter(
        h => h.pluginName !== pluginName
      );
    }

    // Reload plugin
    try {
      const pluginPath = path.resolve(plugin.module.__filename || plugin.path);
      delete require.cache[require.resolve(pluginPath)];
      
      const newPlugin = this.loadPlugin({
        name: plugin.name,
        path: pluginPath,
        config: plugin.config,
        enabled: plugin.enabled
      });

      this.plugins[pluginIndex] = newPlugin;
      this.registerHooks(newPlugin);
      
      console.log(`🔄 Plugin reloaded: ${pluginName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to reload plugin ${pluginName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Enable or disable a plugin
   * @param {string} pluginName - Name of plugin
   * @param {boolean} enabled - Enable or disable
   */
  setPluginEnabled(pluginName, enabled) {
    const plugin = this.plugins.find(p => p.name === pluginName);
    if (!plugin) {
      return false;
    }

    plugin.enabled = enabled;

    // Re-register hooks
    for (const hookName of Object.keys(this.hooks)) {
      this.hooks[hookName] = this.hooks[hookName].filter(
        h => h.pluginName !== pluginName
      );
    }

    if (enabled) {
      this.registerHooks(plugin);
    }

    return true;
  }

  /**
   * Get a specific plugin by name
   * @param {string} pluginName - Plugin name
   * @returns {Object|null} Plugin object
   */
  getPlugin(pluginName) {
    return this.plugins.find(p => p.name === pluginName) || null;
  }

  /**
   * Clear all plugins
   */
  clear() {
    this.plugins = [];
    for (const hookName of Object.keys(this.hooks)) {
      this.hooks[hookName] = [];
    }
    this.enabled = false;
  }
}

// Singleton instance
const pluginManager = new PluginManager();

/**
 * Initialize plugin system
 * @param {Object} config - Plugin configuration
 * @returns {Object} Loading statistics
 */
function initializePlugins(config) {
  if (!config || !config.plugins) {
    return { loaded: 0, failed: 0, plugins: [] };
  }

  console.log('');
  console.log('🔌 Loading plugins...');
  const stats = pluginManager.loadPlugins(config.plugins);
  
  if (stats.loaded > 0) {
    console.log(`✅ ${stats.loaded} plugin(s) loaded successfully`);
  }
  
  if (stats.failed > 0) {
    console.log(`❌ ${stats.failed} plugin(s) failed to load`);
  }
  
  console.log('');
  
  return stats;
}

/**
 * Execute a lifecycle hook
 * @param {string} hookName - Hook name
 * @param {Object} context - Hook context
 * @returns {Promise<Object>} Modified context
 */
async function executeHook(hookName, context = {}) {
  return pluginManager.executeHook(hookName, context);
}

/**
 * Check if plugins are enabled
 * @returns {boolean} Enabled status
 */
function isPluginSystemEnabled() {
  return pluginManager.enabled;
}

/**
 * Get plugin statistics
 * @returns {Object} Plugin stats
 */
function getPluginStats() {
  return pluginManager.getStats();
}

/**
 * Get the plugin manager instance
 * @returns {PluginManager} Plugin manager
 */
function getPluginManager() {
  return pluginManager;
}

module.exports = {
  initializePlugins,
  executeHook,
  isPluginSystemEnabled,
  getPluginStats,
  getPluginManager,
  PluginManager
};

