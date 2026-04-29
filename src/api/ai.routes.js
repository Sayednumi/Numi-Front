/**
 * ============================================================
 *  Numi Platform — AI Routes
 *  File: src/api/ai.routes.js
 * ============================================================
 */
const AIChatIntegration = require('../services/AIChatIntegration');
const PermissionService = require('../services/PermissionService');

// Express middleware mock
function requireAuthAndOrg(req, res, next) {
    if (!req.user || !req.user.organizationId) {
        return res.status(401).json({ error: "Unauthorized or missing organization" });
    }
    next();
}

// POST /api/v1/ai/chat
async function chatHandler(req, res) {
    try {
        const { message } = req.body;
        const user = req.user;

        // 1. Guard check
        PermissionService.assertOrgAccess(user, user.organizationId, 'use_ai_chat');

        // 2. Execute processAIRequest
        // mockAICall would be your actual gemini API integration here
        const mockAICall = async (prompt, msg) => "This is a simulated AI response.";
        const response = await AIChatIntegration.processAIRequest(user, message, mockAICall);

        res.status(200).json({ response });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
}

module.exports = { chatHandler, requireAuthAndOrg };
