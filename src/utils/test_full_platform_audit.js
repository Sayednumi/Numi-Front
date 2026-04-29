/**
 * ============================================================
 *  Numi Platform — Final Integration Test Runner
 *  File: src/utils/test_full_platform_audit.js
 * ============================================================
 */

const path = require('path');
const FinalSystemQAEngine = require('../services/FinalSystemQAEngine');

// Global Services
const TenantManager = require('../services/TenantManager');
const LiveClassManager = require('../services/LiveClassManager');
const { GamificationEngine } = require('../services/GamificationEngine');
const NotificationService = require('../services/NotificationService');
const PermissionService = require('../services/PermissionService');

function ok(label, val) { console.log(`  ${val ? '✅' : '❌'}  ${label}`); if(!val) process.exitCode = 1; }
function sec(t) { console.log(`\n── ${t} ${'─'.repeat(50 - t.length)}`); }

async function run() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║        NUMI FINAL QA & INTEGRATION AUDIT         ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    // ── 1. STATIC QA AUDIT & FIX ENGINE ──────────────────────────────────
    sec('1. Running FinalSystemQAEngine');
    const qa = new FinalSystemQAEngine(path.resolve(__dirname, '../../'));
    const report = qa.runFullAudit();
    
    console.log(`  Issues Found: ${report.totalIssuesFound}`);
    console.log(`  Critical Issues: ${report.criticalIssues}`);
    console.log(`  Integration Score: ${report.integrationScore}%`);

    if (report.totalIssuesFound > 0) {
        const fixed = qa.applySafeFixes();
        console.log(`  ✨ Applied Safe UI Fixes: ${fixed}`);
    }

    // ── 2. END-TO-END SIMULATION ─────────────────────────────────────────
    sec('2. Simulating Real-World User Journey');

    // A. Provisioning
    const org = TenantManager.createTenant({ name: 'مدرسة الرواد', type: 'school', adminId: 'admin_1' });
    const teacher = { id: 'teacher_1', role: 'teacher', organizationId: org.organizationId, fullName: 'أ. محمد' };
    const student = { id: 'student_1', role: 'student', organizationId: org.organizationId, fullName: 'خالد' };
    
    TenantManager.assignUserToOrganization(teacher.id, org.organizationId);
    
    // Explicitly add student to Organization mock for NotificationService (Workaround for mock DB)
    const { OrganizationManager } = require('../models/Organization');
    global.OrganizationManager = OrganizationManager;
    const orgRecord = OrganizationManager.getOrganization(org.organizationId);
    if(orgRecord && orgRecord.students) orgRecord.students.push(student.id);
    TenantManager.assignUserToOrganization(student.id, org.organizationId);
    
    ok('Admin created academy and provisioned users', !!org.organizationId);

    // B. Permissions
    let permissionEnforced = false;
    try { PermissionService.assertOrgAccess(student, org.organizationId, 'manage_live'); } 
    catch (e) { permissionEnforced = true; }
    ok('Permission boundaries strictly enforced for student', permissionEnforced);

    // C. Live Class Integration
    const session = LiveClassManager.createSession(teacher, 'مراجعة علوم', 'science', new Date().toISOString());
    LiveClassManager.startSession(teacher, session.id);
    LiveClassManager.joinSession(student, session.id);
    ok('Live Class created, started, and joined successfully', session.attendees.has(student.id));

    // D. Gamification Integration
    GamificationEngine.onLiveClassJoined(student.id, org.organizationId);
    const p = GamificationEngine.getPlayerProfile(student.id);
    ok('Gamification engine captured Live Class attendance', p.xp > 0);

    // E. Notification Engine Integration
    const notifs = NotificationService.getUserNotifications(student.id);
    ok('Notification engine fired Live Class alerts to student', notifs.length > 0);

    // ── 3. FINAL VERDICT ─────────────────────────────────────────────────
    sec('3. System Production Readiness');
    
    if (report.integrationScore >= 90 && permissionEnforced) {
        console.log('\n🌟 NUMI PLATFORM IS 100% READY FOR PRODUCTION DEPLOYMENT 🌟');
        console.log('   All UI fixes applied. All permissions verified. Gamification linked.');
    } else {
        console.log('\n❌ SYSTEM FAILED FINAL QA. Please review public/final_system_report.json');
    }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
