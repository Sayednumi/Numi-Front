/**
 * ============================================================
 *  Numi Platform — Organization Model
 *  File: src/models/Organization.js
 *
 *  Represents a School or Academy that groups teachers and students,
 *  and holds specific AI usage limits.
 * ============================================================
 */

class Organization {
    /**
     * @param {Object} data - Raw organization data
     */
    constructor(data = {}) {
        if (!data.name) throw new Error("Organization requires a 'name'.");
        if (!['school', 'academy'].includes(data.type)) {
            throw new Error("Organization 'type' must be 'school' or 'academy'.");
        }
        if (!data.adminId) throw new Error("Organization requires an 'adminId'.");

        this.id = data.id || `${data.type}_${Date.now()}`;
        this.name = data.name;
        this.type = data.type; // "school" | "academy"
        this.adminId = data.adminId;
        
        // Optional Info
        this.address = data.address || "";

        // Relationships
        this.teachers = Array.isArray(data.teachers) ? data.teachers : [];
        this.students = Array.isArray(data.students) ? data.students : [];

        // AI Limit Override
        this.aiUsageLimit = typeof data.aiUsageLimit === 'number' ? data.aiUsageLimit : null;

        // Meta
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            address: this.address,
            adminId: this.adminId,
            teachers: this.teachers,
            students: this.students,
            aiUsageLimit: this.aiUsageLimit,
            createdAt: this.createdAt
        };
    }
}

// ─── ADMIN CONTROL PANEL HOOKS ───────────────────────────────────────────────

const OrganizationManager = {
    _db: {},

    createOrganization(data) {
        const org = new Organization(data);
        this._db[org.id] = org;
        return org;
    },

    updateOrganization(id, updates) {
        if (!this._db[id]) throw new Error("Organization not found");
        const existing = this._db[id].toJSON();
        const updated = new Organization({ ...existing, ...updates });
        this._db[id] = updated;
        return updated;
    },

    addTeacher(orgId, teacherId) {
        const org = this._db[orgId];
        if (!org) throw new Error("Organization not found");
        if (!org.teachers.includes(teacherId)) {
            org.teachers.push(teacherId);
        }
        return org;
    },

    setAILimit(orgId, limit) {
        return this.updateOrganization(orgId, { aiUsageLimit: limit });
    },

    getOrganization(id) {
        return this._db[id];
    }
};

// Exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Organization, OrganizationManager };
}
if (typeof window !== 'undefined') {
    window.Organization = Organization;
    window.OrganizationManager = OrganizationManager;
}
