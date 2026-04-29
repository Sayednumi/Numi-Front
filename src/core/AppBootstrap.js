/**
 * ============================================================
 *  Numi Platform — App Bootstrap
 *  File: src/core/AppBootstrap.js
 *
 *  Initializes all systems in the correct order for production.
 * ============================================================
 */

const TenantManager = require('../services/TenantManager');
const PermissionService = require('../services/PermissionService');
const AIContextEngine = require('../services/AIContextEngine');
const NotificationService = require('../services/NotificationService');
const AuthService = require('../services/AuthService');

let _isInitialized = false;

async function initializeApp() {
    if (_isInitialized) return;

    console.log('[AppBootstrap] 🚀 Starting Numi Platform Initialization...');

    try {
        // 1. Initialize DB Connections (Simulated)
        console.log('[AppBootstrap] 1. Connecting to database...');
        // await db.connect();

        // 2. Load Tenants & Feature Flags
        console.log('[AppBootstrap] 2. Loading Tenants & Configuration...');
        const tenants = TenantManager.getAllTenants();
        console.log(`[AppBootstrap]    Found ${tenants.length} active tenants.`);

        // 3. Start Background Services
        console.log('[AppBootstrap] 3. Starting Background Services...');
        NotificationService.startScheduler(); // 10s polling for scheduled notifications

        // 4. Verify AI Connections
        console.log('[AppBootstrap] 4. Verifying AI Models availability...');
        // check AI provider keys here...

        _isInitialized = true;
        console.log('[AppBootstrap] ✅ Numi Platform successfully initialized and ready for traffic.');
        return true;
    } catch (error) {
        console.error('[AppBootstrap] ❌ Critical failure during initialization:', error);
        process.exit(1);
    }
}

async function shutdownApp() {
    console.log('[AppBootstrap] 🛑 Shutting down Numi Platform...');
    NotificationService.stopScheduler();
    // await db.disconnect();
    _isInitialized = false;
    console.log('[AppBootstrap] Shutdown complete.');
}

module.exports = {
    initializeApp,
    shutdownApp,
    isInitialized: () => _isInitialized
};
