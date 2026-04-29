/**
 * ============================================================
 *  Numi Platform — Billing Simulator
 *  File: src/services/BillingSimulator.js
 *
 *  Simulates SaaS billing: per-token AI costs, subscription
 *  model, per-teacher cost breakdown, and monthly projections.
 * ============================================================
 */

const AIUsageTracker = (typeof window !== 'undefined' && window.AIUsageTracker)
    ? window.AIUsageTracker
    : require('./AIUsageTracker');

const TenantManager = (typeof window !== 'undefined' && window.TenantManager)
    ? window.TenantManager
    : require('./TenantManager');

// ─── 1. PRICING CONFIG ───────────────────────────────────────────────────────

const PRICING = {
    // API costs (passed through to school)
    costPer1KTokens:      0.002,   // $0.002 per 1k tokens (e.g. Gemini Flash)

    // Numi Platform Subscription (charged to school)
    subscription: {
        perStudentPerMonth: 3.00,  // $/student/month (base tier)
        perTeacherPerMonth: 8.00,  // $/teacher/month (pro features)
        platformFeePercent: 10     // 10% platform margin on AI cost
    },

    // Type multipliers — essay grading costs more
    typeMultiplier: {
        chat:           1.0,
        exam_generation: 1.2,
        exam_grading:   1.5,
        rag_query:      0.8,
        rag_upload:     0.5
    }
};

// ─── 2. COST CALCULATORS ─────────────────────────────────────────────────────

function calcTokenCost(tokens, type = 'chat') {
    const mult = PRICING.typeMultiplier[type] || 1.0;
    return (tokens / 1000) * PRICING.costPer1KTokens * mult;
}

function calcSubscriptionCost({ studentCount, teacherCount }) {
    return (
        (studentCount  * PRICING.subscription.perStudentPerMonth) +
        (teacherCount  * PRICING.subscription.perTeacherPerMonth)
    );
}

// ─── 3. PER-ORG BILLING REPORT ───────────────────────────────────────────────

/**
 * Generates a full billing report for a school/academy.
 *
 * @param {string} organizationId
 * @param {Object} opts
 * @param {number} opts.studentCount
 * @param {number} opts.teacherCount
 * @param {number} [opts.periodDays=30]
 */
function getOrganizationBilling(organizationId, { studentCount = 0, teacherCount = 0, periodDays = 30 } = {}) {
    const { logsDB } = AIUsageTracker._getDbState();

    // Filter logs for this org
    const orgLogs = logsDB.filter(l => l.orgId === organizationId);

    // Aggregate AI costs by type
    let totalTokens = 0;
    const costByType = { chat: 0, exam_generation: 0, exam_grading: 0, rag_query: 0, rag_upload: 0 };

    orgLogs.forEach(log => {
        totalTokens += log.tokens;
        const type = log.type || 'chat';
        costByType[type] = (costByType[type] || 0) + calcTokenCost(log.tokens, type);
    });

    const totalAICost = Object.values(costByType).reduce((a, b) => a + b, 0);
    const platformFee = totalAICost * (PRICING.subscription.platformFeePercent / 100);
    const subscriptionRevenue = calcSubscriptionCost({ studentCount, teacherCount });
    const totalDue = totalAICost + platformFee + subscriptionRevenue;
    const grossMargin = subscriptionRevenue - totalAICost;
    const roi = totalAICost > 0 ? ((subscriptionRevenue - totalAICost) / totalAICost) * 100 : Infinity;

    return {
        organizationId,
        period: `${periodDays} days`,
        usage: {
            totalRequests: orgLogs.length,
            totalTokens,
            costByType: Object.fromEntries(
                Object.entries(costByType).map(([k, v]) => [k, `$${v.toFixed(4)}`])
            )
        },
        billing: {
            aiCost:              Number(totalAICost.toFixed(4)),
            platformFee:         Number(platformFee.toFixed(4)),
            subscriptionRevenue: Number(subscriptionRevenue.toFixed(2)),
            totalDue:            Number(totalDue.toFixed(2)),
            grossMargin:         Number(grossMargin.toFixed(2)),
            roiPercent:          Number(roi.toFixed(1))
        },
        perHead: {
            costPerStudent: studentCount > 0
                ? Number((totalAICost / studentCount).toFixed(4))
                : 0,
            costPerTeacher: teacherCount > 0
                ? Number((totalAICost / teacherCount).toFixed(4))
                : 0
        }
    };
}

// ─── 4. PER-TEACHER BREAKDOWN ────────────────────────────────────────────────

function getTeacherBilling(teacherId) {
    const { logsDB } = AIUsageTracker._getDbState();
    const teacherLogs = logsDB.filter(l => l.userId === teacherId);

    let totalCost = 0;
    const breakdown = {};

    teacherLogs.forEach(log => {
        const cost = calcTokenCost(log.tokens, log.type);
        totalCost += cost;
        breakdown[log.type] = (breakdown[log.type] || 0) + cost;
    });

    return {
        teacherId,
        totalRequests: teacherLogs.length,
        totalCost: Number(totalCost.toFixed(4)),
        breakdown: Object.fromEntries(
            Object.entries(breakdown).map(([k, v]) => [k, `$${v.toFixed(4)}`])
        ),
        monthlyProjection: Number((totalCost * (30 / Math.max(1, 1))).toFixed(2))
    };
}

// ─── 5. PLATFORM-WIDE BILLING SUMMARY ────────────────────────────────────────

/**
 * Returns billing summary across all tenants — for the investor/owner view.
 */
function getPlatformBillingSummary() {
    const tenants = TenantManager.getAllTenants();
    const { usageDB } = AIUsageTracker._getDbState();

    let totalRevenue = 0;
    let totalCost    = 0;
    const perTenant  = [];

    tenants.forEach(t => {
        const orgUsage = usageDB.organizations[t.organizationId];
        if (!orgUsage) return;

        const aiCost = (orgUsage.totalTokens / 1000) * PRICING.costPer1KTokens;
        const rev    = calcSubscriptionCost({
            studentCount:  (TenantManager.getTenant(t.organizationId)?.organization?.students?.length || 0),
            teacherCount:  (TenantManager.getTenant(t.organizationId)?.organization?.teachers?.length || 0)
        });

        totalCost    += aiCost;
        totalRevenue += rev;
        perTenant.push({ name: t.name, aiCost: aiCost.toFixed(4), revenue: rev.toFixed(2) });
    });

    return {
        tenantCount:     tenants.length,
        totalRevenue:    Number(totalRevenue.toFixed(2)),
        totalCost:       Number(totalCost.toFixed(4)),
        grossProfit:     Number((totalRevenue - totalCost).toFixed(2)),
        marginPercent:   totalRevenue > 0
            ? Number(((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1))
            : 0,
        perTenant
    };
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

const BillingSimulator = {
    PRICING,
    getOrganizationBilling,
    getTeacherBilling,
    getPlatformBillingSummary,
    calcTokenCost,
    calcSubscriptionCost
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BillingSimulator;
}
if (typeof window !== 'undefined') {
    window.BillingSimulator = BillingSimulator;
}
