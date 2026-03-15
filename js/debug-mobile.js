// ── DEBUG.JS v1.0.3 MOBILE — Comprehensive Error Detection for Mobile ──

const DebugSystem = {
    enabled: true,  // Set to false to disable in production
    logs: [],
    maxLogs: 100,
    errorCount: 0,
    warningCount: 0,

    init() {
        if (!this.enabled) return;
        
        this.createFloatingButton();
        this.createDebugPanel();
        this.hookGlobalErrors();
        this.hookConsole();
        this.hookPromiseRejections();
        this.monitorStateChanges();
        this.monitorDOMChanges();
        this.validateCriticalElements();
        
        console.log('🔍 Mobile Debug System Active - Tap floating 🐛 button');
    },

    // ══════════════════════════════════════
    // FLOATING DEBUG BUTTON (Mobile-friendly)
    // ══════════════════════════════════════

    createFloatingButton() {
        const button = document.createElement('div');
        button.id = 'debugFloatingBtn';
        button.innerHTML = '🐛';
        button.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: #ff1744;
            color: #fff;
            font-size: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            z-index: 999999;
            cursor: pointer;
            user-select: none;
            transition: transform 0.2s;
        `;
        
        // Badge for error count
        const badge = document.createElement('div');
        badge.id = 'debugBadge';
        badge.style.cssText = `
            position: absolute;
            top: -4px;
            right: -4px;
            background: #00ff41;
            color: #000;
            font-size: 12px;
            font-weight: bold;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            font-family: monospace;
        `;
        button.appendChild(badge);
        
        button.addEventListener('touchstart', () => {
            button.style.transform = 'scale(0.9)';
        });
        
        button.addEventListener('touchend', () => {
            button.style.transform = 'scale(1)';
            this.togglePanel();
        });
        
        document.body.appendChild(button);
    },

    updateFloatingButton() {
        const badge = document.getElementById('debugBadge');
        if (!badge) return;
        
        const totalIssues = this.errorCount + this.warningCount;
        if (totalIssues > 0) {
            badge.style.display = 'flex';
            badge.textContent = totalIssues > 99 ? '99+' : totalIssues;
        } else {
            badge.style.display = 'none';
        }
        
        // Change button color based on errors
        const btn = document.getElementById('debugFloatingBtn');
        if (this.errorCount > 0) {
            btn.style.background = '#ff1744'; // Red for errors
        } else if (this.warningCount > 0) {
            btn.style.background = '#ffb300'; // Orange for warnings
        } else {
            btn.style.background = '#00e5ff'; // Cyan for all clear
        }
    },

    // ══════════════════════════════════════
    // ERROR CATCHING
    // ══════════════════════════════════════

    hookGlobalErrors() {
        window.onerror = (msg, source, lineno, colno, error) => {
            this.logError('JAVASCRIPT ERROR', {
                message: msg,
                source: source?.split('/').pop(),
                line: lineno,
                column: colno,
                stack: error?.stack
            });
            return false;
        };
    },

    hookPromiseRejections() {
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('UNHANDLED PROMISE', {
                reason: event.reason,
                promise: event.promise
            });
        });
    },

    hookConsole() {
        const original = {
            error: console.error,
            warn: console.warn,
            log: console.log
        };

        console.error = (...args) => {
            this.logError('CONSOLE ERROR', args);
            original.error.apply(console, args);
        };

        console.warn = (...args) => {
            this.logWarning('CONSOLE WARNING', args);
            original.warn.apply(console, args);
        };
    },

    // ══════════════════════════════════════
    // STATE & DOM MONITORING
    // ══════════════════════════════════════

    monitorStateChanges() {
        // Monitor important state properties
        window.addEventListener('load', () => {
            if (typeof State === 'undefined') return;
            
            // Watch for font size changes
            const originalSetSettings = UI?.setSettingsFontSize;
            if (originalSetSettings) {
                UI.setSettingsFontSize = (v) => {
                    this.logInfo('FONT SIZE CHANGE', {
                        section: 'Settings',
                        oldValue: State.settingsFontSize,
                        newValue: v
                    });
                    originalSetSettings.call(UI, v);
                    
                    // Check if it actually applied
                    setTimeout(() => {
                        const menu = document.getElementById('sideMenu');
                        this.logInfo('DOM CHECK', {
                            element: 'sideMenu',
                            fontSize: menu?.style.fontSize || 'not set',
                            computedSize: menu ? getComputedStyle(menu).fontSize : 'N/A'
                        });
                    }, 100);
                };
            }
            
            // Similar for scope and info
            const originalSetScope = UI?.setScopeFontSize;
            if (originalSetScope) {
                UI.setScopeFontSize = (v) => {
                    this.logInfo('FONT SIZE CHANGE', {
                        section: 'Scope',
                        oldValue: State.scopeFontSize,
                        newValue: v
                    });
                    originalSetScope.call(UI, v);
                    
                    setTimeout(() => {
                        this.logInfo('DOM CHECK', {
                            element: 'body',
                            fontSize: document.body.style.fontSize || 'not set',
                            computedSize: getComputedStyle(document.body).fontSize
                        });
                    }, 100);
                };
            }
        });
    },

    monitorDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const el = mutation.target;
                    const id = el.id || el.className;
                    if (id.includes('sideMenu') || id === 'body') {
                        this.logInfo('DOM STYLE CHANGE', {
                            element: id,
                            style: el.getAttribute('style')
                        });
                    }
                }
            });
        });

        setTimeout(() => {
            const sideMenu = document.getElementById('sideMenu');
            if (sideMenu) observer.observe(sideMenu, { attributes: true, attributeFilter: ['style'] });
            observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
        }, 1000);
    },

    validateCriticalElements() {
        setTimeout(() => {
            const critical = [
                'header', 'tabs', 'measurements', 'scopeArea', 
                'scopeCanvas', 'controls', 'sideMenu'
            ];
            
            const missing = critical.filter(id => !document.getElementById(id));
            
            if (missing.length > 0) {
                this.logError('MISSING ELEMENTS', {
                    missing: missing.join(', ')
                });
            } else {
                this.logInfo('VALIDATION', 'All critical elements present ✓');
            }
        }, 500);
    },

    // ══════════════════════════════════════
    // LOGGING SYSTEM
    // ══════════════════════════════════════

    logError(type, data) {
        this.errorCount++;
        this.addLog('ERROR', type, data);
        this.updatePanel();
        this.updateFloatingButton();
    },

    logWarning(type, data) {
        this.warningCount++;
        this.addLog('WARNING', type, data);
        this.updatePanel();
        this.updateFloatingButton();
    },

    logInfo(type, data) {
        this.addLog('INFO', type, data);
        this.updatePanel();
    },

    addLog(level, type, data) {
        this.logs.unshift({
            timestamp: new Date().toLocaleTimeString(),
            level,
            type,
            data
        });
        
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
    },

    // ══════════════════════════════════════
    // DEBUG PANEL UI (Mobile-optimized)
    // ══════════════════════════════════════

    createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'debugPanel';
        panel.innerHTML = `
            <div class="debug-header">
                <span class="debug-title">🔍 DEBUG</span>
                <span class="debug-stats">
                    <span class="debug-error-count">0</span>E · 
                    <span class="debug-warning-count">0</span>W
                </span>
                <div class="debug-controls">
                    <button onclick="DebugSystem.clearLogs()">CLEAR</button>
                    <button onclick="DebugSystem.exportLogs()">SAVE</button>
                    <button onclick="DebugSystem.togglePanel()">✕</button>
                </div>
            </div>
            <div class="debug-filters">
                <button class="debug-filter active" data-filter="all">ALL</button>
                <button class="debug-filter" data-filter="ERROR">ERR</button>
                <button class="debug-filter" data-filter="WARNING">WARN</button>
                <button class="debug-filter" data-filter="INFO">INFO</button>
            </div>
            <div class="debug-logs" id="debugLogs"></div>
        `;
        
        // Mobile-optimized styles
        const style = document.createElement('style');
        style.textContent = `
            #debugPanel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 50vh;
                background: #0a0a0a;
                border-top: 3px solid #00ff41;
                z-index: 99998;
                display: none;
                flex-direction: column;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 11px;
                color: #00ff41;
                transform: translateY(100%);
                transition: transform 0.3s ease-out;
            }
            #debugPanel.active { 
                display: flex; 
                transform: translateY(0);
            }
            
            .debug-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 14px;
                background: #000;
                border-bottom: 1px solid #333;
                min-height: 48px;
            }
            .debug-title { 
                font-weight: bold; 
                color: #00ff41; 
                font-size: 14px;
            }
            .debug-stats { 
                font-size: 12px; 
                color: #888; 
            }
            .debug-error-count { color: #ff1744; font-weight: bold; }
            .debug-warning-count { color: #ffb300; font-weight: bold; }
            
            .debug-controls { 
                display: flex; 
                gap: 6px; 
            }
            .debug-controls button {
                background: transparent;
                border: 1px solid #333;
                color: #00ff41;
                padding: 8px 12px;
                cursor: pointer;
                font-size: 11px;
                font-family: monospace;
                min-height: 36px;
                min-width: 44px;
                border-radius: 4px;
            }
            .debug-controls button:active { 
                background: #00ff4133; 
                transform: scale(0.95);
            }
            
            .debug-filters {
                display: flex;
                gap: 6px;
                padding: 8px 12px;
                background: #0f0f0f;
                border-bottom: 1px solid #333;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            .debug-filter {
                background: transparent;
                border: 1px solid #333;
                color: #888;
                padding: 8px 14px;
                cursor: pointer;
                font-size: 11px;
                font-family: monospace;
                white-space: nowrap;
                min-height: 36px;
                border-radius: 4px;
            }
            .debug-filter.active { 
                background: #00ff41; 
                color: #000; 
                border-color: #00ff41;
                font-weight: bold;
            }
            .debug-filter:active { 
                transform: scale(0.95); 
            }
            
            .debug-logs {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                background: #000;
                -webkit-overflow-scrolling: touch;
            }
            
            .debug-log {
                margin-bottom: 8px;
                padding: 10px;
                border-left: 4px solid #666;
                background: #0a0a0a;
                font-size: 10px;
                line-height: 1.6;
                border-radius: 4px;
            }
            .debug-log.ERROR { border-left-color: #ff1744; background: #1a0505; }
            .debug-log.WARNING { border-left-color: #ffb300; background: #1a1205; }
            .debug-log.INFO { border-left-color: #00e5ff; background: #05121a; }
            
            .debug-log-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                font-size: 11px;
            }
            .debug-log-time { color: #666; }
            .debug-log-level { font-weight: bold; }
            .debug-log-level.ERROR { color: #ff1744; }
            .debug-log-level.WARNING { color: #ffb300; }
            .debug-log-level.INFO { color: #00e5ff; }
            
            .debug-log-type { 
                color: #00ff41; 
                font-weight: bold; 
                margin-bottom: 6px;
                font-size: 11px;
            }
            .debug-log-data { 
                color: #aaa; 
                white-space: pre-wrap; 
                font-size: 10px;
                word-break: break-word;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);
        
        // Filter buttons
        panel.querySelectorAll('.debug-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                panel.querySelectorAll('.debug-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterLogs(btn.dataset.filter);
            });
        });
    },

    updatePanel() {
        const panel = document.getElementById('debugPanel');
        if (!panel) return;
        
        panel.querySelector('.debug-error-count').textContent = this.errorCount;
        panel.querySelector('.debug-warning-count').textContent = this.warningCount;
        
        const logsContainer = document.getElementById('debugLogs');
        const activeFilter = panel.querySelector('.debug-filter.active')?.dataset.filter || 'all';
        
        logsContainer.innerHTML = this.logs
            .filter(log => activeFilter === 'all' || log.level === activeFilter)
            .map(log => this.formatLog(log))
            .join('');
    },

    formatLog(log) {
        const dataStr = typeof log.data === 'object' 
            ? JSON.stringify(log.data, null, 2)
            : String(log.data);
        
        return `
            <div class="debug-log ${log.level}">
                <div class="debug-log-header">
                    <span class="debug-log-level ${log.level}">${log.level}</span>
                    <span class="debug-log-time">${log.timestamp}</span>
                </div>
                <div class="debug-log-type">${log.type}</div>
                <div class="debug-log-data">${dataStr}</div>
            </div>
        `;
    },

    filterLogs(filter) {
        this.updatePanel();
    },

    togglePanel() {
        const panel = document.getElementById('debugPanel');
        if (panel) panel.classList.toggle('active');
    },

    clearLogs() {
        if (confirm('Clear all debug logs?')) {
            this.logs = [];
            this.errorCount = 0;
            this.warningCount = 0;
            this.updatePanel();
            this.updateFloatingButton();
        }
    },

    exportLogs() {
        const data = JSON.stringify(this.logs, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DebugSystem.init());
} else {
    DebugSystem.init();
}
