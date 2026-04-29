/**
 * ============================================================
 *  Numi Platform — Tenant Manager
 *  File: src/services/TenantManager.js
 *
 *  Multi-tenant architecture core. Every AI operation,
 *  notification, exam, and analytics call is isolated per tenant.
 * ============================================================
 */

const { OrganizationManager } = (typeof window !== 'undefined' && window.OrganizationManager)
    ? { OrganizationManager: window.OrganizationManager }
    : require('../models/Organization');

const { TeacherProfileManager } = (typeof window !== 'undefined' && window.TeacherProfileManager)
    ? { TeacherProfileManager: window.TeacherProfileManager }
    : require('../models/TeacherProfile');

const PermissionService = (typeof window !== 'undefined' && window.PermissionService)
    ? window.PermissionService
    : require('./PermissionService');

// ─── 1. TENANT REGISTRY ──────────────────────────────────────────────────────

const _tenants = {};        // { orgId: TenantContext }
const _userOrgMap = {};     // { userId: orgId }

// ─── 2. TENANT CONTEXT ───────────────────────────────────────────────────────

class TenantContext {
    constructor({ organization, adminId, features = {} }) {
        this.organizationId = organization.id;
        this.organization   = organization;
        this.adminId        = adminId;
        this.createdAt      = new Date().toISOString();

        // Feature flags (toggleable per school)
        this.features = {
            aiChat:        features.aiChat        ?? true,
            examGenerator: features.examGenerator ?? true,
            ragMode:       features.ragMode       ?? true,
            notifications: features.notifications ?? true,
            analytics:     features.analytics     ?? true,
            billing:       features.billing       ?? true
        };
    }

    isFeatureEnabled(feature) {
        return this.features[feature] === true;
    }

    toJSON() {
        return {
            organizationId: this.organizationId,
            name:           this.organization.name,
            type:           this.organization.type,
            adminId:        this.adminId,
            createdAt:      this.createdAt,
            features:       { ...this.features }
        };
    }
}

// ─── 3. PUBLIC API ────────────────────────────────────────────────────────────

/**
 * Provisions a new tenant (school or academy).
 * Creates the organization AND the TenantContext.
 */
function createTenant({ name, type, adminId, address = '', features = {}, aiUsageLimit = null }) {
    if (!name) throw new Error("Tenant name is required.");
    if (!['school', 'academy'].includes(type)) throw new Error("Tenant type must be 'school' or 'academy'.");
    if (!adminId) throw new Error("Tenant adminId is required.");

    // Create underlying organization record
    const org = OrganizationManager.createOrganization({ name, type, adminId, address, aiUsageLimit });

    // Map admin to org
    _userOrgMap[adminId] = org.id;

    const tenant = new TenantContext({ organization: org, adminId, features });
    _tenants[org.id] = tenant;

    console.log(`[TenantManager] ✅ Tenant created: "${name}" (${type}) → ID: ${org.id}`);
    return tenant;
}

/**
 * Assigns an existing user to an organization.
 * Prevents cross-tenant data access by locking userId → orgId.
 */
function assignUserToOrganization(user, organizationId) {
    const userId = typeof user === 'object' ? user.id : user;

    if (typeof user === 'object' && PermissionService.isSuperAdmin(user)) {
        return true; // Super Admin bypass
    }

    if (!_tenants[organizationId]) {
        throw new Error(`Organization "${organizationId}" is not a registered tenant.`);
    }
    if (_userOrgMap[userId] && _userOrgMap[userId] !== organizationId) {
        throw new Error(`User "${userId}" already belongs to org "${_userOrgMap[userId]}". Cross-tenant assignment denied.`);
    }
    _userOrgMap[userId] = organizationId;

    // Add to org member lists
    const org = OrganizationManager.getOrganization(organizationId);
    if (org) {
        OrganizationManager.addTeacher(organizationId, userId); // Works for both teachers and students
    }

    return true;
}

/**
 * Returns the TenantContext for a given user, enforcing isolation.
 */
function getOrganizationContext(user) {
    if (typeof user === 'object' && PermissionService.isSuperAdmin(user)) {
        // Return a global proxy or the first tenant if needed, 
        // but typically Super Admin bypasses isolation anyway.
        return { isGlobal: true }; 
    }
    const userId = typeof user === 'object' ? user.id : user;
    const orgId = _userOrgMap[userId];
    if (!orgId) return null;
    return _tenants[orgId] || null;
}

/**
 * Validates that a user belongs to a given org. Throws if not.
 * Used as a guard in every cross-service call.
 */
function assertSameOrg(user, organizationId) {
    if (typeof user === 'object' && PermissionService.isSuperAdmin(user)) {
        return true; // Super Admin absolute bypass
    }
    
    const userId = typeof user === 'object' ? user.id : user;
    const userOrg = _userOrgMap[userId];
    if (!userOrg) throw new Error(`User "${userId}" has no assigned organization.`);
    if (userOrg !== organizationId) {
        throw new Error(`Access Denied: User "${userId}" belongs to org "${userOrg}", not "${organizationId}".`);
    }
    return true;
}

/**
 * Isolates a data array (e.g. notifications, exams) to a specific org.
 * Filters any records that have an organizationId field.
 */
function isolateDataByOrganization(dataArray, organizationId) {
    return dataArray.filter(item => !item.organizationId || item.organizationId === organizationId);
}

/**
 * Updates feature flags for a tenant (e.g. enable RAG, disable billing).
 */
function updateFeatureFlags(organizationId, flags = {}) {
    const tenant = _tenants[organizationId];
    if (!tenant) throw new Error(`Tenant "${organizationId}" not found.`);
    Object.assign(tenant.features, flags);
    return tenant;
}

/**
 * Returns all registered tenants (global admin / investor view).
 */
function getAllTenants() {
    return Object.values(_tenants).map(t => t.toJSON());
}

function getTenant(organizationId) {
    return _tenants[organizationId] || null;
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

const TenantManager = {
    createTenant,
    assignUserToOrganization,
    getOrganizationContext,
    assertSameOrg,
    isolateDataByOrganization,
    updateFeatureFlags,
    getAllTenants,
    getTenant,
    _getState: () => ({ _tenants, _userOrgMap })
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TenantManager;
}
if (typeof window !== 'undefined') {
    window.TenantManager = TenantManager;
}
