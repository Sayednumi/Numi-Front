/**
 * Quick test: AI Investor Dashboard System
 * Run with: node src/utils/test_investor_dashboard.js
 */

const { TeacherProfileManager } = require('../models/TeacherProfile');
const { OrganizationManager } = require('../models/Organization');
const AIUsageTracker = require('../services/AIUsageTracker');
global.AIUsageTracker = AIUsageTracker;

const AIAnalyticsEngine = require('../services/AIAnalyticsEngine');

function runTests() {
    console.log('─── Simulating Investor Dashboard Data ───\n');

    // 1. Seed some mock data into OrganizationManager and TeacherProfileManager
    const org = OrganizationManager.createOrganization({
        name: "مدرسة المستقبل",
        type: "school",
        adminId: "admin_1",
        teachers: ["teacher_1", "teacher_2"],
        students: ["student_1", "student_2", "student_3"]
    });

    TeacherProfileManager.createTeacherProfile({
        id: "teacher_1",
        fullName: "معلم العلوم",
        subject: "science",
        schoolId: org.id
    });

    // 2. Seed some mock AI Usage logs to simulate real traffic
    AIUsageTracker.logAIUsage({
        user: { id: 'teacher_1', role: 'teacher', organizationId: org.id },
        type: 'exam_generation',
        tokensUsed: 1500,
        metadata: { subject: 'science' }
    });

    AIUsageTracker.logAIUsage({
        user: { id: 'teacher_1', role: 'teacher', organizationId: org.id },
        type: 'exam_grading',
        tokensUsed: 800,
        metadata: { subject: 'science', weakTopicsDetected: true }
    });

    AIUsageTracker.logAIUsage({
        user: { id: 'student_1', role: 'student', organizationId: org.id },
        type: 'chat',
        tokensUsed: 400,
        metadata: { subject: 'science' }
    });

    // Log a grading record under student's name (simulating student taking exam)
    AIUsageTracker.logAIUsage({
        user: { id: 'student_1', role: 'student', organizationId: org.id },
        type: 'exam_grading',
        tokensUsed: 200,
        metadata: { weakTopicsDetected: true, subject: 'science' }
    });

    // 3. Fetch Platform Overview
    console.log('[Platform Overview]');
    const overview = AIAnalyticsEngine.getPlatformOverview();
    console.dir(overview, { depth: null });

    // 4. Fetch Organization Analytics
    console.log('\n[Organization Analytics - مدرسة المستقبل]');
    const orgReport = AIAnalyticsEngine.getOrganizationReport(org.id);
    console.dir(orgReport, { depth: null });

    // 5. Fetch Teacher Analytics
    console.log('\n[Teacher Performance - teacher_1]');
    const teacherReport = AIAnalyticsEngine.getTeacherReport('teacher_1');
    console.dir(teacherReport, { depth: null });

    // 6. Fetch Student Engagement
    console.log('\n[Student Engagement - student_1]');
    const studentReport = AIAnalyticsEngine.getStudentEngagement('student_1');
    console.dir(studentReport, { depth: null });

    // 7. Time Series Trends
    console.log('\n[Time Series Usage Trends]');
    const trends = AIAnalyticsEngine.getUsageTrends('day');
    console.dir(trends, { depth: null });

    console.log('\n─── Tests Complete ───');
}

runTests();
