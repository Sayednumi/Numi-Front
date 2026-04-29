/**
 * SaaS Layer Full Test
 * Run with: node src/utils/test_saas_layer.js
 */

// Bootstrap globals
const PermissionService   = require('../services/PermissionService');
global.PermissionService  = PermissionService;

const AIUsageTracker      = require('../services/AIUsageTracker');
global.AIUsageTracker     = AIUsageTracker;

const { OrganizationManager } = require('../models/Organization');
global.OrganizationManager = OrganizationManager;

const { TeacherProfileManager } = require('../models/TeacherProfile');
global.TeacherProfileManager = TeacherProfileManager;

const TenantManager      = require('../services/TenantManager');
global.TenantManager     = TenantManager;

const BillingSimulator   = require('../services/BillingSimulator');

function ok(label, val)  { console.log(`  ${val ? '✅' : '❌'}  ${label}`); if (!val) process.exitCode = 1; }
function sec(t)          { console.log(`\n── ${t} ${'─'.repeat(45 - t.length)}`); }

async function run() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║    Numi SaaS Layer — Full Test Suite          ║');
    console.log('╚══════════════════════════════════════════════╝');

    // ── 1. Create two isolated tenants ──────────────────────────────────────
    sec('1. Tenant Provisioning');
    const t1 = TenantManager.createTenant({ name: 'أكاديمية النجاح', type: 'academy', adminId: 'admin_A' });
    const t2 = TenantManager.createTenant({ name: 'مدرسة المستقبل',  type: 'school',  adminId: 'admin_B' });
    ok('Tenant 1 created', !!t1?.organizationId);
    ok('Tenant 2 created', !!t2?.organizationId);
    ok('getAllTenants returns 2', TenantManager.getAllTenants().length === 2);

    // ── 2. Assign users ──────────────────────────────────────────────────────
    sec('2. User ↔ Organization Assignment');
    TenantManager.assignUserToOrganization('teacher_A1', t1.organizationId);
    TenantManager.assignUserToOrganization('student_A1', t1.organizationId);
    TenantManager.assignUserToOrganization('teacher_B1', t2.organizationId);

    ok('teacher_A1 context is t1', TenantManager.getOrganizationContext('teacher_A1')?.organizationId === t1.organizationId);
    ok('teacher_B1 context is t2', TenantManager.getOrganizationContext('teacher_B1')?.organizationId === t2.organizationId);

    // ── 3. Cross-tenant isolation guard ─────────────────────────────────────
    sec('3. Cross-Tenant Isolation (assertSameOrg)');
    let crossBlocked = false;
    try {
        TenantManager.assertSameOrg('teacher_A1', t2.organizationId);
    } catch (e) {
        crossBlocked = true;
    }
    ok('Cross-org access blocked', crossBlocked);

    let sameOrgOk = false;
    try {
        TenantManager.assertSameOrg('teacher_A1', t1.organizationId);
        sameOrgOk = true;
    } catch (e) {}
    ok('Same-org access allowed', sameOrgOk);

    // ── 4. PermissionService org guard ───────────────────────────────────────
    sec('4. PermissionService hasOrgPermission');
    const teacherA = { role: 'teacher', organizationId: t1.organizationId };
    const adminNoOrg = { role: 'admin' };

    const r1 = PermissionService.hasOrgPermission(teacherA, t1.organizationId, 'generate_ai');
    ok('Teacher in own org: allowed', r1.allowed === true);

    const r2 = PermissionService.hasOrgPermission(teacherA, t2.organizationId, 'generate_ai');
    ok('Teacher in foreign org: denied', r2.allowed === false);

    const r3 = PermissionService.hasOrgPermission(adminNoOrg, t2.organizationId, 'generate_ai');
    ok('System admin (no org): allowed', r3.allowed === true);

    // ── 5. Feature flags ─────────────────────────────────────────────────────
    sec('5. Feature Flag Management');
    ok('ragMode enabled by default', t1.isFeatureEnabled('ragMode') === true);
    TenantManager.updateFeatureFlags(t1.organizationId, { ragMode: false });
    ok('ragMode disabled after toggle', t1.isFeatureEnabled('ragMode') === false);

    // ── 6. Billing simulator ─────────────────────────────────────────────────
    sec('6. Billing Simulator');

    // Seed usage logs
    AIUsageTracker.logAIUsage({ user: { id: 'teacher_A1', role: 'teacher', organizationId: t1.organizationId }, type: 'exam_generation', tokensUsed: 2000, metadata: {} });
    AIUsageTracker.logAIUsage({ user: { id: 'student_A1', role: 'student', organizationId: t1.organizationId }, type: 'chat',            tokensUsed: 800,  metadata: {} });
    AIUsageTracker.logAIUsage({ user: { id: 'teacher_B1', role: 'teacher', organizationId: t2.organizationId }, type: 'exam_grading',    tokensUsed: 1500, metadata: {} });

    const bill1 = BillingSimulator.getOrganizationBilling(t1.organizationId, { studentCount: 30, teacherCount: 3 });
    ok('Org billing has aiCost',            bill1.billing.aiCost > 0);
    ok('Org billing has subscriptionRev',   bill1.billing.subscriptionRevenue > 0);
    ok('Org billing has grossMargin',       typeof bill1.billing.grossMargin === 'number');
    ok('perHead costPerStudent computed',   bill1.perHead.costPerStudent >= 0);

    const teacherBill = BillingSimulator.getTeacherBilling('teacher_A1');
    ok('Teacher billing computed',          teacherBill.totalCost > 0);
    ok('Teacher breakdown has exam_gen',    !!teacherBill.breakdown.exam_generation);

    const platform = BillingSimulator.getPlatformBillingSummary();
    ok('Platform summary has 2 tenants',    platform.tenantCount === 2);
    ok('Platform gross profit computed',    typeof platform.grossProfit === 'number');

    // ── 7. isolateDataByOrganization ────────────────────────────────────────
    sec('7. Data Isolation Utility');
    const mixedData = [
        { id: 1, organizationId: t1.organizationId },
        { id: 2, organizationId: t2.organizationId },
        { id: 3 } // no org (passes through)
    ];
    const isolated = TenantManager.isolateDataByOrganization(mixedData, t1.organizationId);
    ok('Data isolated to t1 (2 records)',   isolated.length === 2);
    ok('Foreign record excluded',           isolated.every(d => d.organizationId !== t2.organizationId));

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log(process.exitCode === 1
        ? '║  ❌  Some Tests FAILED                         ║'
        : '║  ✅  All SaaS Layer Tests Passed!              ║');
    console.log('╚══════════════════════════════════════════════╝\n');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
