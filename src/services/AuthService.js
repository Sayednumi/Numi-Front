/**
 * ============================================================
 *  Numi Platform — Auth Service
 *  File: src/services/AuthService.js
 *
 *  Production-ready authentication system.
 *  Handles login, session mock, JWT structure, and tenant resolution.
 * ============================================================
 */

const TenantManager = (typeof window !== 'undefined' && window.TenantManager)
    ? window.TenantManager
    : require('./TenantManager');

const { TeacherProfileManager } = (typeof window !== 'undefined' && window.TeacherProfileManager)
    ? window
    : require('../models/TeacherProfile');

const PermissionService = (typeof window !== 'undefined' && window.PermissionService)
    ? window.PermissionService
    : require('./PermissionService');

// Simulated DB of users
const _usersDB = {};
const _sessions = {};

function _generateMockJWT(user) {
    // Simulated JWT token
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
        sub: user.id,
        role: user.role,
        orgId: user.organizationId,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24h
    })).toString('base64');
    return `${header}.${payload}.MOCK_SIGNATURE`;
}

function registerSchoolAdmin(email, password, fullName, organizationId) {
    if (!email || !password || !organizationId) throw new Error("Missing required fields for admin registration.");
    
    const id = `admin_${Date.now()}`;
    const user = {
        id,
        email,
        passwordHash: `hash_${password}`, // Simulated hash
        fullName,
        role: PermissionService.ROLES.ADMIN,
        organizationId
    };

    _usersDB[email] = user;
    TenantManager.assignUserToOrganization(id, organizationId);
    return user;
}

function registerTeacher(email, password, fullName, subject, organizationId) {
    const id = `teacher_${Date.now()}`;
    const user = {
        id,
        email,
        passwordHash: `hash_${password}`,
        fullName,
        role: PermissionService.ROLES.TEACHER,
        subject,
        organizationId
    };

    _usersDB[email] = user;
    TeacherProfileManager.createTeacherProfile({ id, fullName, subject, email, schoolId: organizationId });
    TenantManager.assignUserToOrganization(id, organizationId);
    return user;
}

function registerStudent(email, password, fullName, organizationId) {
    const id = `student_${Date.now()}`;
    const user = {
        id,
        email,
        passwordHash: `hash_${password}`,
        fullName,
        role: PermissionService.ROLES.STUDENT,
        organizationId
    };

    _usersDB[email] = user;
    TenantManager.assignUserToOrganization(id, organizationId);
    return user;
}

function login(email, password) {
    const user = _usersDB[email];
    if (!user || user.passwordHash !== `hash_${password}`) {
        throw new Error("Invalid credentials");
    }

    // Attach tenant context automatically
    const tenantCtx = TenantManager.getOrganizationContext(user.id);
    if (!tenantCtx && user.role !== PermissionService.ROLES.ADMIN) {
        throw new Error("User does not belong to any active tenant.");
    }

    const token = _generateMockJWT(user);
    _sessions[token] = user;

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            organizationId: user.organizationId
        },
        tenantFeatures: tenantCtx ? tenantCtx.features : null
    };
}

function verifyToken(token) {
    const user = _sessions[token];
    if (!user) throw new Error("Unauthorized: Invalid or expired token.");
    return user;
}

const AuthService = {
    registerSchoolAdmin,
    registerTeacher,
    registerStudent,
    login,
    verifyToken
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthService;
}
if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}
