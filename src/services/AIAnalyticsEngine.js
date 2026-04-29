/**
 * ============================================================
 *  Numi Platform — AI Analytics Engine
 *  File: src/services/AIAnalyticsEngine.js
 *
 *  Aggregates AI usage, educational metrics, and revenue estimates
 *  into a structured format for the Investor & Admin Dashboard.
 * ============================================================
 */

const AIUsageTracker = (typeof window !== 'undefined' && window.AIUsageTracker) 
    ? window.AIUsageTracker 
    : require('./AIUsageTracker');

const OrganizationManager = (typeof window !== 'undefined' && window.OrganizationManager)
    ? window.OrganizationManager
    : require('../models/Organization').OrganizationManager;

const TeacherProfileManager = (typeof window !== 'undefined' && window.TeacherProfileManager)
    ? window.TeacherProfileManager
    : require('../models/TeacherProfile').TeacherProfileManager;

// Revenue & Cost Simulation Constants
const COST_PER_1K_TOKENS = 0.002;
const AVERAGE_BILLING_PER_ACTIVE_USER = 5.00; // Expected monthly billing per active user in USD

// ─── 1. PLATFORM OVERVIEW ────────────────────────────────────────────────────

/**
 * Generates high-level metrics for the entire platform.
 */
function getPlatformOverview() {
    const { usageDB } = AIUsageTracker._getDbState();
    const orgs = OrganizationManager ? Object.keys(OrganizationManager._db).length : 0;
    const teachers = TeacherProfileManager ? Object.keys(TeacherProfileManager._db).length : 0;
    
    // In a real system, we'd query the DB for total users. 
    // Here we count unique users in the usageDB + teachers
    const totalUsers = Object.keys(usageDB.users).length + teachers;

    let totalAIRequests = 0;
    let totalTokensUsed = 0;

    for (const uId in usageDB.users) {
        totalAIRequests += usageDB.users[uId].totalRequests;
        totalTokensUsed += usageDB.users[uId].totalTokens;
    }

    const estimatedCost = (totalTokensUsed / 1000) * COST_PER_1K_TOKENS;
    const estimatedRevenue = totalUsers * AVERAGE_BILLING_PER_ACTIVE_USER;

    return {
        totalUsers,
        totalSchools: orgs,
        totalTeachers: teachers,
        totalAIRequests,
        totalTokensUsed,
        financials: {
            estimatedCost: Number(estimatedCost.toFixed(4)),
            estimatedRevenue: Number(estimatedRevenue.toFixed(2)),
            grossMargin: Number((estimatedRevenue - estimatedCost).toFixed(2))
        }
    };
}

// ─── 2. ORGANIZATION ANALYTICS ───────────────────────────────────────────────

/**
 * Generates a detailed analytics report for a specific school or academy.
 */
function getOrganizationReport(organizationId) {
    let orgData = null;
    if (OrganizationManager && OrganizationManager._db[organizationId]) {
        orgData = OrganizationManager._db[organizationId].toJSON();
    } else {
        // Fallback for tests if OrganizationManager is bypassed
        orgData = { teachers: [], students: [], name: 'Unknown Organization' };
    }

    const aiUsageReport = AIUsageTracker.getAIUsageReport(organizationId);

    const totalTeachers = orgData.teachers.length;
    const totalStudents = orgData.students.length;
    
    // Active users rate simulation
    const totalUsers = totalTeachers + totalStudents;
    const activeUsers = aiUsageReport.topUsers.length; // From logs
    const activeUsersRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    return {
        organizationId,
        name: orgData.name,
        totalTeachers,
        totalStudents,
        totalUsers,
        activeUsersRate: `${activeUsersRate.toFixed(1)}%`,
        aiUsageBreakdown: aiUsageReport.breakdown,
        costPerOrganization: aiUsageReport.overview.estimatedCostUsd,
        estimatedBilling: totalUsers * AVERAGE_BILLING_PER_ACTIVE_USER
    };
}

// ─── 3. TEACHER ANALYTICS ────────────────────────────────────────────────────

/**
 * Tracks AI and educational performance for a specific teacher.
 */
function getTeacherReport(teacherId) {
    const { usageDB, logsDB } = AIUsageTracker._getDbState();
    const teacherUsage = usageDB.teachers[teacherId] || { breakdown: { chat: 0, exam_generation: 0, exam_grading: 0 }, totalTokens: 0 };

    const cost = (teacherUsage.totalTokens / 1000) * COST_PER_1K_TOKENS;

    // Simulate student engagement score based on AI usage (e.g. grading activity means engagement)
    const engagementScore = Math.min(100, (teacherUsage.breakdown.exam_grading * 5) + (teacherUsage.breakdown.exam_generation * 10));

    return {
        teacherId,
        examsCreated: teacherUsage.breakdown.exam_generation,
        aiChats: teacherUsage.breakdown.chat,
        gradingActivity: teacherUsage.breakdown.exam_grading,
        aiUsageCost: Number(cost.toFixed(4)),
        studentEngagementScore: engagementScore
    };
}

// ─── 4. STUDENT ENGAGEMENT ───────────────────────────────────────────────────

/**
 * Evaluates student engagement, progress, and weak topics.
 * Aggregates data from AI logs.
 */
function getStudentEngagement(studentId) {
    const { usageDB, logsDB } = AIUsageTracker._getDbState();
    
    const studentLogs = logsDB.filter(l => l.userId === studentId);
    
    let chatFrequency = 0;
    let examAttempts = 0;
    const weakTopics = new Set();
    
    studentLogs.forEach(log => {
        if (log.type === 'chat') chatFrequency++;
        if (log.type === 'exam_grading') {
            examAttempts++;
            if (log.metadata && log.metadata.weakTopicsDetected) {
                weakTopics.add(log.metadata.subject);
            }
        }
    });

    // Mock scores for simulation
    const averageScore = examAttempts > 0 ? 85 : 0;
    const improvementRate = examAttempts > 1 ? 5.2 : 0; // percentage

    return {
        studentId,
        examAttempts,
        averageScore: `${averageScore}%`,
        improvementRate: `+${improvementRate}%`,
        weakTopics: Array.from(weakTopics),
        aiChatUsageFrequency: chatFrequency
    };
}

// ─── 5. TIME SERIES TRENDS ───────────────────────────────────────────────────

/**
 * Returns aggregated platform-wide time series data ready for charting.
 */
function getUsageTrends(timeRange = 'day') {
    const { logsDB } = AIUsageTracker._getDbState();
    
    const trends = {
        labels: [], // e.g. ['2026-04-28', '2026-04-29'] or hours ['10:00', '11:00']
        requests: [],
        tokens: []
    };

    const aggregated = {};
    const hourAggregated = {};

    logsDB.forEach(log => {
        const datePart = log.timestamp.split('T')[0];
        const hourPart = log.timestamp.split('T')[1].substring(0, 2) + ':00';
        
        // Aggregate by date
        if (!aggregated[datePart]) aggregated[datePart] = { requests: 0, tokens: 0 };
        aggregated[datePart].requests += 1;
        aggregated[datePart].tokens += log.tokens;

        // Aggregate by hour (peak usage detection)
        if (!hourAggregated[hourPart]) hourAggregated[hourPart] = 0;
        hourAggregated[hourPart] += 1;
    });

    if (timeRange === 'day' || timeRange === 'week' || timeRange === 'month') {
        Object.entries(aggregated).forEach(([date, data]) => {
            trends.labels.push(date);
            trends.requests.push(data.requests);
            trends.tokens.push(data.tokens);
        });
    }

    // Determine Peak Usage Hour
    let peakHour = "N/A";
    let maxReq = 0;
    Object.entries(hourAggregated).forEach(([hour, count]) => {
        if (count > maxReq) {
            maxReq = count;
            peakHour = hour;
        }
    });

    return {
        trends,
        peakUsageHour: peakHour
    };
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

const AIAnalyticsEngine = {
    getPlatformOverview,
    getOrganizationReport,
    getTeacherReport,
    getStudentEngagement,
    getUsageTrends
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIAnalyticsEngine;
}
if (typeof window !== 'undefined') {
    window.AIAnalyticsEngine = AIAnalyticsEngine;
}
