// Dashboard State
let autoRefreshInterval = null;
let allCacheEntries = [];

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initialized');
    loadDashboard();
    startAutoRefresh();
});

// Load all dashboard data
async function loadDashboard() {
    try {
        await Promise.all([
            loadStats(),
            loadCacheList()
        ]);
        updateLastUpdated();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        // Update stats cards
        document.getElementById('totalRequests').textContent = formatNumber(data.requests.total);
        document.getElementById('hitRate').textContent = formatPercent(data.requests.hitRate);
        document.getElementById('cacheSize').textContent = formatBytes(data.cache.size);
        document.getElementById('avgResponse').textContent = formatMs(data.performance.avgResponseTime);
        
        // Update performance
        document.getElementById('cacheHits').textContent = formatNumber(data.requests.cacheHits);
        document.getElementById('cacheMisses').textContent = formatNumber(data.requests.cacheMisses);
        document.getElementById('speedup').textContent = formatSpeedup(data.performance.cacheSpeedup);
        document.getElementById('hitTime').textContent = formatMs(data.performance.avgHitTime);
        document.getElementById('missTime').textContent = formatMs(data.performance.avgMissTime);
        
        // Update bandwidth
        document.getElementById('bandwidthOrigin').textContent = formatBytes(data.bandwidth.totalFromOrigin);
        document.getElementById('bandwidthServed').textContent = formatBytes(data.bandwidth.totalServed);
        document.getElementById('bandwidthSaved').textContent = formatBytes(data.bandwidth.saved);
        document.getElementById('bandwidthEfficiency').textContent = formatPercent(data.bandwidth.efficiency);
        
        // Update server info
        document.getElementById('serverPort').textContent = data.server.port;
        const originElement = document.getElementById('serverOrigin');
        originElement.textContent = truncateUrl(data.server.origin, 35);
        originElement.title = data.server.origin; // Full URL on hover
        document.getElementById('serverUptime').textContent = formatUptime(data.server.uptime);
        
        // Update top URLs
        updateTopUrls(data.topUrls || []);
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load cache list
async function loadCacheList() {
    try {
        const response = await fetch('/api/cache');
        const data = await response.json();
        
        allCacheEntries = data.entries || [];
        document.getElementById('entryCount').textContent = `${allCacheEntries.length} entries`;
        
        renderCacheList(allCacheEntries);
        
    } catch (error) {
        console.error('Error loading cache list:', error);
    }
}

// Render cache list
function renderCacheList(entries) {
    const cacheList = document.getElementById('cacheList');
    
    if (entries.length === 0) {
        cacheList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-text">No cached entries yet</div>
                <div class="empty-subtext">Make requests through the proxy to see them here</div>
            </div>
        `;
        return;
    }
    
    cacheList.innerHTML = entries.map(entry => `
        <div class="cache-item" data-key="${escapeHtml(entry.key)}">
            <div class="cache-item-header">
                <div>
                    <span class="cache-method">${entry.method}</span>
                    <span class="cache-url" title="${escapeHtml(entry.url)}">${truncateUrl(entry.url)}</span>
                </div>
                <button class="cache-delete" onclick="deleteCacheEntry('${escapeHtml(entry.key)}')">
                    Delete
                </button>
            </div>
            <div class="cache-meta">
                <span>📦 ${formatBytes(entry.size)}</span>
                <span>⏱️ TTL: ${formatDuration(entry.ttl)}</span>
                <span>📅 ${formatAge(entry.age)} ago</span>
                <span>✅ ${entry.statusCode}</span>
            </div>
        </div>
    `).join('');
}

// Update top URLs
function updateTopUrls(urls) {
    const topUrls = document.getElementById('topUrls');
    
    if (urls.length === 0) {
        topUrls.innerHTML = `
            <div class="empty-state-small">
                <span>No data yet</span>
            </div>
        `;
        return;
    }
    
    topUrls.innerHTML = urls.slice(0, 5).map((item, index) => `
        <div class="top-url-item">
            <div class="top-url-count">${item.count}</div>
            <div class="top-url-text" title="${escapeHtml(item.url)}">${truncateUrl(item.url)}</div>
        </div>
    `).join('');
}

// Delete cache entry
async function deleteCacheEntry(cacheKey) {
    if (!confirm('Delete this cache entry?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/cache/entry?key=${encodeURIComponent(cacheKey)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadDashboard();
        } else {
            alert('Failed to delete cache entry');
        }
    } catch (error) {
        console.error('Error deleting cache entry:', error);
        alert('Error deleting cache entry');
    }
}

// Clear all cache
async function confirmClearCache() {
    if (!confirm(`Clear ALL cache entries (${allCacheEntries.length} entries)?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/cache', {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Cache cleared! ${data.entriesRemoved} entries removed.`);
            await loadDashboard();
        } else {
            alert('Failed to clear cache');
        }
    } catch (error) {
        console.error('Error clearing cache:', error);
        alert('Error clearing cache');
    }
}

// Filter cache list
function filterCache() {
    const searchTerm = document.getElementById('searchCache').value.toLowerCase();
    
    const filtered = allCacheEntries.filter(entry => 
        entry.url.toLowerCase().includes(searchTerm) ||
        entry.key.toLowerCase().includes(searchTerm)
    );
    
    renderCacheList(filtered);
}

// Refresh dashboard
async function refreshDashboard() {
    await loadDashboard();
}

// Start auto-refresh
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
        loadDashboard();
    }, 5000); // Refresh every 5 seconds
    
    document.getElementById('autoRefresh').textContent = 'ON';
    document.getElementById('autoRefresh').className = 'status-active';
}

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('lastUpdated').textContent = timeString;
}

// Formatting helpers
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
}

function formatPercent(num) {
    if (num === undefined || num === null) return '0%';
    return num.toFixed(1) + '%';
}

function formatBytes(bytes) {
    if (bytes === undefined || bytes === null || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    
    return value.toFixed(2) + ' ' + units[i];
}

function formatMs(ms) {
    if (ms === undefined || ms === null) return '0ms';
    return Math.round(ms) + 'ms';
}

function formatSpeedup(speedup) {
    if (speedup === undefined || speedup === null || speedup === 0) return '0x';
    return speedup.toFixed(1) + 'x';
}

function formatDuration(ms) {
    if (ms === undefined || ms === null || ms <= 0) return 'expired';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function formatAge(ms) {
    return formatDuration(ms);
}

function formatUptime(ms) {
    if (ms === undefined || ms === null) return '0s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

function truncateUrl(url, maxLength = 60) {
    if (!url) return '-';
    if (url.length <= maxLength) return url;
    
    const start = url.substring(0, maxLength - 20);
    const end = url.substring(url.length - 17);
    return start + '...' + end;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

