/**
 * ============================================================
 *  Numi Platform — AI Usage Tracker (Analytics & Billing)
 *  File: src/services/AIUsageTracker.js
 *
 *  Tracks AI usage across users, teachers, and organizations.
 *  Implements usage limits and provides investor-grade analytics.
 * ============================================================
 */

// ─── 1. IN-MEMORY DB (For Demonstration/Tracking) ────────────────────────────

// Schema for usage: { totalRequests, totalTokens, breakdown: { chat, exam_generation, exam_grading } }
const usageDB = {
    users: {},
    teachers: {},
    organizations: {}
};

// Logs detailing each request for time-series charts
const logsDB = []; 

// Soft limits config
const LIMITS = {
    user: 50,       // requests per day
    teacher: 500,   // requests per day
    organization: 5000 // requests per day
};

// Cost per 1000 tokens (e.g., $0.002)
const COST_PER_1K_TOKENS = 0.002;

// ─── 2. LIMIT CHECKER ────────────────────────────────────────────────────────

/**
 * Checks if a user or their organization has exceeded their AI usage limit.
 * 
 * @param {Object} user 
 * @throws {Error} if limit is exceeded
 */
function checkUsageLimits(user) {
    if (!user) return;

    const uId = user.id || user._id || 'anonymous';
    const orgId = user.academyId || user.organizationId || 'default_org';

    // Initialize if empty
    if (!usageDB.users[uId]) usageDB.users[uId] = { totalRequests: 0, totalTokens: 0, breakdown: { chat: 0, exam_generation: 0, exam_grading: 0 } };
    if (!usageDB.organizations[orgId]) usageDB.organizations[orgId] = { totalRequests: 0, totalTokens: 0, breakdown: { chat: 0, exam_generation: 0, exam_grading: 0 } };

    if (usageDB.users[uId].totalRequests >= LIMITS.user) {
        throw new Error("تم الوصول للحد المسموح من استخدام الذكاء الاصطناعي");
    }

    if (usageDB.organizations[orgId].totalRequests >= LIMITS.organization) {
        throw new Error("تجاوزت المؤسسة الحد المسموح للاستخدام");
    }
}


// ─── 3. CENTRAL USAGE LOGGER ─────────────────────────────────────────────────

/**
 * Logs AI usage centrally.
 * 
 * @param {Object} payload 
 * @param {Object} payload.user - The user initiating the request
 * @param {string} payload.type - 'chat' | 'exam_generation' | 'exam_grading'
 * @param {number} payload.tokensUsed - Estimated tokens
 * @param {Object} payload.metadata - Optional extra data (e.g. subject, latency)
 */
function logAIUsage({ user, type, tokensUsed, metadata = {} }) {
    if (!user) return;

    const uId = user.id || user._id || 'anonymous';
    const role = user.role || 'student';
    const orgId = user.academyId || user.organizationId || 'default_org';

    // 1. Log Time Series Data (for charts)
    logsDB.push({
        timestamp: new Date().toISOString(),
        userId: uId,
        role: role,
        orgId: orgId,
        type: type,
        tokens: tokensUsed,
        metadata: metadata
    });

    // Helper to increment aggregated stats
    const incrementStats = (entityDict, entityId) => {
        if (!entityDict[entityId]) {
            entityDict[entityId] = { totalRequests: 0, totalTokens: 0, breakdown: { chat: 0, exam_generation: 0, exam_grading: 0 } };
        }
        entityDict[entityId].totalRequests += 1;
        entityDict[entityId].totalTokens += tokensUsed;
        
        if (!entityDict[entityId].breakdown[type]) entityDict[entityId].breakdown[type] = 0;
        entityDict[entityId].breakdown[type] += 1;
    };

    // 2. Increment User Stats
    incrementStats(usageDB.users, uId);

    // 3. Increment Teacher Stats (if applicable)
    if (role === 'teacher') {
        incrementStats(usageDB.teachers, uId);
    } else if (user.teacherId) {
        incrementStats(usageDB.teachers, user.teacherId);
    }

    // 4. Increment Organization Stats
    incrementStats(usageDB.organizations, orgId);
}


// ─── 4. ANALYTICS OUTPUT API ─────────────────────────────────────────────────

/**
 * Returns a comprehensive usage report for an organization.
 * Formatted cleanly for UI dashboards.
 * 
 * @param {string} organizationId 
 */
function getAIUsageReport(organizationId) {
    const orgData = usageDB.organizations[organizationId] || { totalRequests: 0, totalTokens: 0, breakdown: {} };

    // Calculate cost
    const estimatedCostUsd = (orgData.totalTokens / 1000) * COST_PER_1K_TOKENS;

    // Filter Top Users
    const orgUsers = Object.entries(usageDB.users).filter(([userId, data]) => {
        // In a real DB, we'd query by orgId. Since our mock is simple, we check the logs for this orgId.
        const userLogs = logsDB.filter(l => l.userId === userId && l.orgId === organizationId);
        return userLogs.length > 0;
    }).map(([userId, data]) => ({
        userId,
        totalRequests: data.totalRequests,
        totalTokens: data.totalTokens
    })).sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 5); // Top 5

    // Build Time Series (per-day usage for charts)
    const dailyUsage = {};
    logsDB.forEach(log => {
        if (log.orgId !== organizationId) return;
        const day = log.timestamp.split('T')[0];
        if (!dailyUsage[day]) dailyUsage[day] = { requests: 0, tokens: 0 };
        dailyUsage[day].requests += 1;
        dailyUsage[day].tokens += log.tokens;
    });

    return {
        organizationId,
        overview: {
            totalRequests: orgData.totalRequests,
            totalTokens: orgData.totalTokens,
            estimatedCostUsd: Number(estimatedCostUsd.toFixed(4))
        },
        breakdown: orgData.breakdown,
        topUsers: orgUsers,
        chartsData: {
            dailyUsage
        }
    };
}


// ─── EXPORTS ─────────────────────────────────────────────────────────────────

const AIUsageTracker = {
    checkUsageLimits,
    logAIUsage,
    getAIUsageReport,
    _getDbState: () => ({ usageDB, logsDB }) // For testing purposes
};

// Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIUsageTracker;
}

// Browser global
if (typeof window !== 'undefined') {
    window.AIUsageTracker = AIUsageTracker;
}
