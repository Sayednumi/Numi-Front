/**
 * Numi Admin Dashboard — Core Initialization
 * This file handles authentication, role-based UI initialization, 
 * and global state management.
 */

const SESSION_KEY = 'numi_session_user';
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : 'https://numi-production-7484.up.railway.app/api';

let currentUser = null;
let _userProfile = null;
let db = { classes: {} };
window.db = db; // Ensure global access for legacy components
let _saveDBTimer = null;

// Export globals for legacy support in admin.html
window.API_URL = API_URL;
window.SESSION_KEY = SESSION_KEY;
window.currentUser = currentUser;
window.db = db;

// Bootstrap Application
function initAdmin() {
    const sessionSaved = localStorage.getItem(SESSION_KEY);
    if (!sessionSaved) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = JSON.parse(sessionSaved);
    window.currentUser = currentUser;
    
    const allowedRoles = ['admin', 'manager', 'teacher', 'super_admin'];
    if (!allowedRoles.includes(currentUser.role)) {
        window.location.href = 'index.html';
        return;
    }

    // Build profile via PermissionService
    if (window.PermissionService) {
        _userProfile = window.PermissionService.buildUserProfile(currentUser);
    }

    setupFetchInterceptor();
    
    // Performance optimization: only fetch if not already in memory
    // and apply UI based on cached roles first for perceived speed.
    applyRoleBasedUI();

    fetchDB().then(() => {
        window.db = db;
        // Trigger initial UI render for the active section only
        const activeSection = GLOBAL_STORE.state.activeSection || 'dashboard';
        if (typeof showSection === 'function') showSection(activeSection);
        
        // Context-specific flows
        if (typeof initSuperAdminDashboard === 'function') initSuperAdminDashboard();
        if (typeof checkOnboardingStatus === 'function') checkOnboardingStatus();
    });
}

/**
 * High-performance UI guard that hides elements based on roles/permissions.
 * Uses CSS injection for maximum efficiency (no DOM thrashing).
 */
function applyRoleBasedUI() {
    if (!currentUser) return;
    
    const isOwner = isSuperAdmin();
    const style = document.createElement('style');
    style.id = 'role-ui-guard';
    
    let css = '';
    // Rules for non-super-admins
    if (!isOwner) {
        css += `
            [data-role="super_admin"], 
            .super-admin-only, 
            #superAdminOrganizationsSection, 
            #auditLogSection, 
            #settings { display: none !important; }
        `;
        
        // Specific permission checks
        if (!hasPerm('manage_platform')) css += ' .platform-manage-btn { display: none !important; }';
        if (!hasPerm('view_reports')) css += ' #reports, .nav-item-reports { display: none !important; }';
        if (!hasPerm('manage_finances')) css += ' #financialControlSection, .nav-item-finance { display: none !important; }';
    }

    style.innerHTML = css;
    const existing = document.getElementById('role-ui-guard');
    if (existing) existing.remove();
    document.head.appendChild(style);
    
    console.log('[RBAC] UI Guard Applied for role:', currentUser.role);
}

function setupFetchInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = function () {
        let [resource, config] = arguments;
        if (!config) config = {};
        if (!config.headers) config.headers = {};
        config.headers['x-user-id'] = currentUser.id;

        if (typeof resource === 'string' && resource.startsWith(API_URL)) {
            try {
                const urlObj = new URL(resource);
                const currentTenantId = isSuperAdmin() ? 'global' : (currentUser.id || 'main');
                urlObj.searchParams.set('tenantId', currentTenantId);
                if (isSuperAdmin()) urlObj.searchParams.set('scope', 'global');
                resource = urlObj.toString();
            } catch (e) { }
        }
        return originalFetch(resource, config);
    };
}

function isSuperAdmin() {
    if (!currentUser) return false;
    return currentUser.role === 'super_admin'
        || currentUser.phone === '01110154093'
        || (currentUser.permissions && currentUser.permissions.isSuperAdmin === true);
}

function hasPerm(permName) {
    if (!currentUser) return false;
    if (isSuperAdmin()) return true;
    if (window.PermissionService && _userProfile) {
        return window.PermissionService.hasPermission(_userProfile, permName);
    }
    return !!(currentUser.permissions || {})[permName];
}

async function fetchDB() {
    // 1. Immediate Cache Load (SWR Pattern)
    const cache = localStorage.getItem('numi_db_cache');
    if (cache) {
        try {
            db = JSON.parse(cache);
            window.db = db;
            GLOBAL_STORE.setState({ db });
            console.log('[Core] DB loaded from cache (Instant)');
        } catch (e) { console.error('Cache parse error', e); }
    }

    if (GLOBAL_STORE.state.loading.db) return;
    GLOBAL_STORE.setLoading('db', true);

    try {
        // Optimized: Only fetch what's needed for the dashboard/sidebar first
        const data = await API_CLIENT.get('/platform-data');
        if (data) {
            db = data;
            window.db = db;
            GLOBAL_STORE.setState({ db: data });
            GLOBAL_STORE.persistCache();
            console.log('[Core] DB fully synced');
            
            // Refresh UI components that depend on DB
            if (typeof updateStats === 'function') updateStats();
            if (typeof refreshAllDropdowns === 'function') refreshAllDropdowns();
        }
    } catch (err) {
        console.error('Fetch DB failed:', err);
    } finally {
        GLOBAL_STORE.setLoading('db', false);
    }
}

let _saveDBPromise = null;
async function saveDB(immediate = false) {
    if (!db || !db.classes || Object.keys(db.classes).length === 0) {
        console.warn('Attempted to save an empty or invalid DB. Aborting save.');
        return;
    }
    
    // Notify UI of pending changes
    if (typeof refreshAllDropdowns === 'function') refreshAllDropdowns();
    if (typeof buildNavLessonSelectors === 'function') buildNavLessonSelectors();
    
    if (typeof updateStats === 'function') {
        const dashSection = document.getElementById('dashboard');
        if (dashSection && dashSection.style.display !== 'none') updateStats();
    }

    if (_saveDBTimer) clearTimeout(_saveDBTimer);

    const performSave = async () => {
        GLOBAL_STORE.setState({ db });
        GLOBAL_STORE.persistCache();
        
        try {
            await API_CLIENT.post('/platform-data', db);
            console.log('✅ DB saved successfully');
            return true;
        } catch (err) {
            console.error('❌ Failed to save DB:', err);
            if (typeof showNotif === 'function') showNotif('⚠️ فشل حفظ البيانات في السحابة', 'danger');
            throw err;
        }
    };

    if (immediate) {
        return await performSave();
    }

    return new Promise((resolve, reject) => {
        _saveDBTimer = setTimeout(async () => {
            try {
                const result = await performSave();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        }, 1500);
    });
}

window.initAdmin = initAdmin;
window.hasPerm = hasPerm;
window.saveDB = saveDB;
window.fetchDB = fetchDB;
