/**
 * ============================================================
 *  Numi Platform — Teacher Profile Model
 *  File: src/models/TeacherProfile.js
 *
 *  Represents a Teacher's complete profile with optional fields
 *  and strict AI behaviour alignment.
 * ============================================================
 */

const PermissionService = (typeof window !== 'undefined' && window.PermissionService) 
    ? window.PermissionService 
    : require('../services/PermissionService');

class TeacherProfile {
    /**
     * @param {Object} data - Raw data for the teacher profile
     */
    constructor(data = {}) {
        // Required Fields
        if (!data.fullName) throw new Error("TeacherProfile requires a 'fullName'.");

        this.id = data.id || `teacher_${Date.now()}`;
        this.fullName = data.fullName;

        // Subject Assignment Logic:
        // We defer to the PermissionService to resolve the subject safely.
        // It priorities explicit 'subject' then 'managerSubject' then 'default'.
        const resolved = PermissionService.resolveSubject(data);
        this.subject = resolved.subject;
        this.subjectSource = resolved.source;

        // Optional Fields (Safe Fallbacks)
        this.phone = data.phone || "";
        this.email = data.email || "";
        this.profileImage = data.profileImage || "";
        this.bio = data.bio || "";
        this.academicDegree = data.academicDegree || "";

        // Organization Linkage
        this.schoolId = data.schoolId || null;
        this.academyId = data.academyId || null;

        // RAG Mode: when true, AI answers ONLY from uploaded materials
        this.ragEnabled = data.ragEnabled === true ? true : false;

        // Meta
        this.createdBy = data.createdBy || "system";
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    /**
     * Converts the profile into a clean JSON object.
     */
    toJSON() {
        return {
            id: this.id,
            fullName: this.fullName,
            subject: this.subject,
            subjectSource: this.subjectSource,
            phone: this.phone,
            email: this.email,
            profileImage: this.profileImage,
            bio: this.bio,
            academicDegree: this.academicDegree,
            schoolId: this.schoolId,
            academyId: this.academyId,
            ragEnabled: this.ragEnabled,
            createdBy: this.createdBy,
            createdAt: this.createdAt
        };
    }

    /**
     * Extracts AI-relevant context to inject into AIContextEngine.
     * Keeps the prompt clean and focused.
     */
    getAIContextData() {
        return {
            name: this.fullName,
            subject: this.subject,
            bio: this.bio,
            academicDegree: this.academicDegree,
            schoolId: this.schoolId,
            academyId: this.academyId
        };
    }
}

// ─── ADMIN CONTROL PANEL HOOKS ───────────────────────────────────────────────

const TeacherProfileManager = {
    _db: {}, // Mock DB

    createTeacherProfile(data) {
        const profile = new TeacherProfile(data);
        this._db[profile.id] = profile;
        return profile;
    },

    updateTeacherProfile(id, updates) {
        if (!this._db[id]) throw new Error("Teacher not found");
        const existing = this._db[id].toJSON();
        const updated = new TeacherProfile({ ...existing, ...updates });
        this._db[id] = updated;
        return updated;
    },

    assignTeacherToSchool(teacherId, schoolId) {
        return this.updateTeacherProfile(teacherId, { schoolId });
    },

    assignTeacherToAcademy(teacherId, academyId) {
        return this.updateTeacherProfile(teacherId, { academyId });
    },

    changeTeacherSubject(teacherId, newSubject) {
        // Admin overrides subject via managerSubject property
        return this.updateTeacherProfile(teacherId, { managerSubject: newSubject, subject: null });
    },

    setRAGMode(teacherId, enabled) {
        return this.updateTeacherProfile(teacherId, { ragEnabled: enabled });
    },

    getProfile(id) {
        return this._db[id];
    }
};

// Exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TeacherProfile, TeacherProfileManager };
}
if (typeof window !== 'undefined') {
    window.TeacherProfile = TeacherProfile;
    window.TeacherProfileManager = TeacherProfileManager;
}
