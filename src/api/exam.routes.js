/**
 * ============================================================
 *  Numi Platform — Exam Routes
 *  File: src/api/exam.routes.js
 * ============================================================
 */
const AIExamGenerator = require('../services/AIExamGenerator');
const AIExamGrader = require('../services/AIExamGrader');
const PermissionService = require('../services/PermissionService');
const TenantManager = require('../services/TenantManager');
const AIContextEngine = require('../services/AIContextEngine');

// POST /api/v1/exam/generate
async function generateExamHandler(req, res) {
    try {
        const user = req.user;
        const { targetSubject, config } = req.body;
        
        PermissionService.assertOrgAccess(user, user.organizationId, 'generate_ai');
        
        // Ensure tenant feature is on
        const tenant = TenantManager.getOrganizationContext(user);
        if (!tenant) {
            throw new Error("User has no active tenant context.");
        }
        if (!tenant.isFeatureEnabled('examGenerator')) {
            throw new Error("Feature 'examGenerator' is disabled for your school.");
        }

        const mockGenCall = async () => '{"title":"Mock Exam", "questions":[]}';
        const exam = await AIExamGenerator.generateExam(user, targetSubject, config, mockGenCall);
        
        res.status(200).json({ exam: JSON.parse(exam) });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
}

// POST /api/v1/exam/grade
async function gradeExamHandler(req, res) {
    try {
        const user = req.user;
        const { examDef, answers } = req.body;
        
        // Enforce user can take quiz
        PermissionService.assertOrgAccess(user, user.organizationId, 'take_quiz');

        const mockGradeCall = async () => '{"score":5,"feedback":"Good"}';
        
        // Pass aiContext to grader
        const aiContext = AIContextEngine.getAIContext(user);
        
        const result = await AIExamGrader.gradeExamSubmission(examDef, answers, aiContext, mockGradeCall);
        
        res.status(200).json({ result });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
}

module.exports = { generateExamHandler, gradeExamHandler };
