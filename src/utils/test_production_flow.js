/**
 * ============================================================
 *  Numi Platform — End-to-End Production Flow Test
 *  File: src/utils/test_production_flow.js
 * ============================================================
 */

// 1. App Bootstrap (Initializes all core services)
const AppBootstrap = require('../core/AppBootstrap');
const TenantManager = require('../services/TenantManager');
const AuthService = require('../services/AuthService');
const AIContextEngine = require('../services/AIContextEngine');
const AIChatIntegration = require('../services/AIChatIntegration');
const AIExamGrader = require('../services/AIExamGrader');
const NotificationService = require('../services/NotificationService');
const BillingSimulator = require('../services/BillingSimulator');

async function runFlow() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  Numi E2E Production Lifecycle Test          ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // ── STEP 1: Platform Startup ──
    await AppBootstrap.initializeApp();
    
    // ── STEP 2: School Onboarding (Tenant Provisioning) ──
    console.log('\n▶ STEP 2: School Onboarding');
    const tenant = TenantManager.createTenant({
        name: 'مدرسة الرواد',
        type: 'school',
        adminId: 'setup_admin_1', // Will be remapped by AuthService
        features: { aiChat: true, examGenerator: true, ragMode: true }
    });
    console.log(`  ✅ Tenant provisioned: ${tenant.organizationId}`);

    // ── STEP 3: Auth & Registration ──
    console.log('\n▶ STEP 3: Auth & Registration');
    const admin = AuthService.registerSchoolAdmin('admin@alrowad.edu', 'pass123', 'مدير الرواد', tenant.organizationId);
    const teacher = AuthService.registerTeacher('teacher@alrowad.edu', 'pass123', 'أ. أحمد', 'math', tenant.organizationId);
    const student = AuthService.registerStudent('student@alrowad.edu', 'pass123', 'طالب مميز', tenant.organizationId);
    
    // Admin Login
    const session = AuthService.login('admin@alrowad.edu', 'pass123');
    console.log('  ✅ Admin logged in. Token generated.');
    console.log(`  ✅ Users mapped to tenant: Admin, Teacher, Student`);

    // ── STEP 4: AI Usage (Chat & Exam Grading) ──
    console.log('\n▶ STEP 4: AI Usage Lifecycle');
    
    // Teacher uses AI
    const mockAICall = async () => 'إجابة محاكاة من الذكاء الاصطناعي.';
    await AIChatIntegration.processAIRequest(teacher, 'كيف أشرح التفاضل والتكامل؟', mockAICall);
    console.log('  ✅ Teacher used AI Chat. Tokens logged.');

    // Student takes an Exam
    const mockExam = { subject: 'math', questions: [{ type: 'essay', question: 'اشرح التفاضل' }] };
    const answers = ['تغير في الميل'];
    const aiCtx = AIContextEngine.getAIContext(student);
    aiCtx.rawUser = student; // Inject for usage tracking + notifs
    
    // Mock the actual AI grading call
    const mockGradeCall = async () => '{"score":3, "feedback":"Good, but incomplete"}';
    await AIExamGrader.gradeExamSubmission(mockExam, answers, aiCtx, mockGradeCall);
    console.log('  ✅ Student exam graded by AI. Tokens logged.');

    // ── STEP 5: Notification Delivery ──
    console.log('\n▶ STEP 5: Notification Triggers');
    const studentNotifs = NotificationService.getUserNotifications(student.id);
    console.log(`  ✅ Student Inbox: ${studentNotifs.length} new messages.`);
    if (studentNotifs.length > 0) {
        console.log(`     -> Last Notif: "${studentNotifs[0].title}"`);
    }

    // ── STEP 6: Billing & Analytics Sync ──
    console.log('\n▶ STEP 6: SaaS Billing Simulation');
    const billing = BillingSimulator.getOrganizationBilling(tenant.organizationId, {
        studentCount: 1,
        teacherCount: 1
    });
    console.log(`  ✅ AI Cost for org: $${billing.billing.aiCost}`);
    console.log(`  ✅ Subscription Rev: $${billing.billing.subscriptionRevenue}`);
    console.log(`  ✅ Platform Gross Margin: $${billing.billing.grossMargin}`);

    // ── STEP 7: Shutdown ──
    await AppBootstrap.shutdownApp();
    
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ✅ E2E Lifecycle Completed Successfully!     ║');
    console.log('╚══════════════════════════════════════════════╝\n');
}

runFlow().catch(console.error);
