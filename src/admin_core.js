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
    applyRoleBasedUI();
    fetchDB().then(() => {
        window.db = db;
        // Trigger initial UI render
        if (typeof syncCMSUI === 'function') syncCMSUI();
    });
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
    try {
        const res = await fetch(`${API_URL}/platform-data`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.classes) {
                db = data;
                localStorage.setItem('numi_db_cache', JSON.stringify(db));
            }
        }
    } catch (err) {
        const cache = localStorage.getItem('numi_db_cache');
        if (cache) db = JSON.parse(cache);
    }
}

async function saveDB() {
    if (typeof refreshAllDropdowns === 'function') refreshAllDropdowns();
    if (typeof buildNavLessonSelectors === 'function') buildNavLessonSelectors();
    
    if (typeof updateStats === 'function') {
        const dashSection = document.getElementById('dashboard');
        if (dashSection && dashSection.style.display !== 'none') updateStats();
    }

    clearTimeout(_saveDBTimer);
    _saveDBTimer = setTimeout(async () => {
        localStorage.setItem('numi_db_cache', JSON.stringify(db));
        try {
            await fetch(`${API_URL}/platform-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(db)
            });
        } catch (err) { console.error('Failed to save DB', err); }
    }, 1500);
}

window.initAdmin = initAdmin;
window.hasPerm = hasPerm;
window.saveDB = saveDB;
window.fetchDB = fetchDB;
