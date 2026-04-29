/**
 * ============================================================
 *  Numi Platform — Analytics Routes
 *  File: src/api/analytics.routes.js
 * ============================================================
 */
const AIAnalyticsEngine = require('../services/AIAnalyticsEngine');
const BillingSimulator = require('../services/BillingSimulator');
const PermissionService = require('../services/PermissionService');

// GET /api/v1/analytics/org
function getOrgAnalyticsHandler(req, res) {
    try {
        const user = req.user;
        PermissionService.assertOrgAccess(user, user.organizationId, 'view_reports');

        const report = AIAnalyticsEngine.getOrganizationReport(user.organizationId);
        const billing = BillingSimulator.getOrganizationBilling(user.organizationId);

        res.status(200).json({ report, billing });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
}

// GET /api/v1/analytics/platform
function getPlatformAnalyticsHandler(req, res) {
    try {
        const user = req.user;
        // MUST be a global admin (no orgId) to view platform analytics
        if (user.role !== PermissionService.ROLES.ADMIN || user.organizationId) {
            throw new Error("Only global admins can view platform analytics.");
        }

        const overview = AIAnalyticsEngine.getPlatformOverview();
        const billingSummary = BillingSimulator.getPlatformBillingSummary();

        res.status(200).json({ overview, billingSummary });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
}

module.exports = { getOrgAnalyticsHandler, getPlatformAnalyticsHandler };
