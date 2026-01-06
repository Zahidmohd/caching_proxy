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
        
        // Update primary metrics
        document.getElementById('totalRequests').textContent = formatNumber(data.requests.total);
        document.getElementById('hitRate').textContent = formatPercent(data.requests.hitRate);
        document.getElementById('avgLatency').textContent = formatMs(data.performance.avgResponseTime);
        document.getElementById('cacheSize').textContent = formatBytes(data.cache.size);
        
        // Update performance stats
        document.getElementById('cacheHits').textContent = formatNumber(data.requests.cacheHits);
        document.getElementById('cacheMisses').textContent = formatNumber(data.requests.cacheMisses);
        document.getElementById('speedup').textContent = formatSpeedup(data.performance.cacheSpeedup);
        document.getElementById('savedBW').textContent = formatBytes(data.bandwidth.saved);
        
        // Update bandwidth stats
        document.getElementById('bandwidthOrigin').textContent = formatBytes(data.bandwidth.totalFromOrigin);
        document.getElementById('bandwidthServed').textContent = formatBytes(data.bandwidth.totalServed);
        document.getElementById('bandwidthEfficiency').textContent = formatPercent(data.bandwidth.efficiency);
        
        // Update server info
        document.getElementById('serverPort').textContent = data.server.port;
        const originElement = document.getElementById('serverOrigin');
        originElement.textContent = data.server.origin;
        originElement.title = data.server.origin;
        originElement.style.fontSize = '12px';
        originElement.style.maxWidth = '300px';
        originElement.style.overflow = 'hidden';
        originElement.style.textOverflow = 'ellipsis';
        originElement.style.whiteSpace = 'nowrap';
        originElement.style.display = 'inline-block';
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

// Render cache list as table
function renderCacheList(entries) {
    const container = document.getElementById('cacheTableContainer');
    
    if (entries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">No cached entries</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table class="cache-table">
            <thead>
                <tr>
                    <th>Path</th>
                    <th>Status</th>
                    <th>Size</th>
                    <th>TTL</th>
                    <th>Last Hit</th>
                </tr>
            </thead>
            <tbody>
                ${entries.map(entry => `
                    <tr data-key="${escapeHtml(entry.key)}">
                        <td class="path-cell" title="${escapeHtml(entry.url)}">${extractPath(entry.url)}</td>
                        <td><span class="status-badge ${entry.ttl > 0 ? 'hit' : 'miss'}">${entry.ttl > 0 ? 'HIT' : 'MISS'}</span></td>
                        <td class="size-cell">${formatBytes(entry.size)}</td>
                        <td class="ttl-cell">${formatDuration(entry.ttl)}</td>
                        <td class="time-cell">${formatAge(entry.age)} ago</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Extract path from URL for cleaner display
function extractPath(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname + urlObj.search;
    } catch {
        return url;
    }
}

// Update top URLs - simpler format
function updateTopUrls(urls) {
    const topUrls = document.getElementById('topUrls');
    
    if (urls.length === 0) {
        topUrls.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">No data</div>
            </div>
        `;
        return;
    }
    
    topUrls.innerHTML = urls.slice(0, 5).map(item => `
        <div class="stat-row">
            <span class="stat-label" style="font-size: 12px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.url)}">${extractPath(item.url)}</span>
            <span class="stat-value">${item.count}</span>
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
    if (ms === undefined || ms === null || ms <= 0) return '—';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

function formatAge(ms) {
    if (ms === undefined || ms === null || ms <= 0) return '—';
    
    const seconds = Math.floor(ms / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
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

