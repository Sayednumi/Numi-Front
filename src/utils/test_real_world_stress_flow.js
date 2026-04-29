/**
 * ============================================================
 *  Numi Platform — Real-World Stress Flow
 *  File: src/utils/test_real_world_stress_flow.js
 * ============================================================
 */

const path = require('path');
const ProductionHardeningEngine = require('../services/ProductionHardeningEngine');
const TenantManager = require('../services/TenantManager');
const { OrganizationManager } = require('../models/Organization');
global.OrganizationManager = OrganizationManager;

function sec(t) { console.log(`\n── ${t} ${'─'.repeat(50 - t.length)}`); }

async function run() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║    NUMI REAL-WORLD STRESS & HARDENING TEST       ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    sec('1. Provisioning 26 Concurrent Users');
    
    const org = TenantManager.createTenant({ name: 'مدرسة النخبة', type: 'school', adminId: 'admin_master' });
    const orgId = org.organizationId;
    
    const teachers = Array.from({ length: 5 }).map((_, i) => ({
        id: `t_${i}`, role: 'teacher', organizationId: orgId, fullName: `Teacher ${i}`
    }));
    
    const students = Array.from({ length: 20 }).map((_, i) => ({
        id: `s_${i}`, role: 'student', organizationId: orgId, fullName: `Student ${i}`
    }));

    // Register all
    teachers.forEach(t => TenantManager.assignUserToOrganization(t.id, orgId));
    students.forEach(s => {
        const o = OrganizationManager.getOrganization(orgId);
        if(o && o.students) o.students.push(s.id);
        TenantManager.assignUserToOrganization(s.id, orgId);
    });

    console.log(`  ✅ Provisioned 1 Admin, 5 Teachers, 20 Students in ${orgId}`);

    sec('2. Executing Production Hardening Engine');
    
    const engine = new ProductionHardeningEngine(path.resolve(__dirname, '../../'));
    const metrics = await engine.runFullStressTest({ orgId, teachers, students });

    sec('3. Hardening Report Results');
    
    console.log(`  Total Users Simulated:  ${metrics.totalUsersSimulated}`);
    console.log(`  Total Requests:         ${metrics.totalRequests}`);
    console.log(`  AI Calls Initiated:     ${metrics.aiCallsCount}`);
    console.log(`  Avg Response Time:      ${metrics.avgResponseTime}ms`);
    console.log(`  Max Response Time:      ${metrics.maxResponseTime}ms`);
    console.log(`  Recovered Failures:     ${metrics.recoveredFailures} (Graceful Fallback)`);
    console.log(`  Critical Failures:      ${metrics.failureCount}`);
    console.log(`  Stability Score:        ${metrics.systemStabilityScore}%`);

    console.log('\n╔══════════════════════════════════════════════════╗');
    if (metrics.productionReady) {
        console.log('║ NUMI IS PRODUCTION READY — NO CRITICAL FAILURES  ║');
        console.log('╚══════════════════════════════════════════════════╝\n');
        console.log('🌟 The system handled concurrent AI requests, live class joining, and failure injection without data leakage or crashes.');
    } else {
        console.log('║ NUMI REQUIRES STABILITY FIXES BEFORE DEPLOYMENT  ║');
        console.log('╚══════════════════════════════════════════════════╝\n');
        process.exitCode = 1;
    }
}

run().catch(e => { console.error('Fatal Error:', e); process.exit(1); });
