/**
 * Quick test: AIUsageTracker
 * Run with: node src/utils/test_ai_usage.js
 */

const AIUsageTracker = require('../services/AIUsageTracker');
global.AIUsageTracker = AIUsageTracker;

const AIContextEngine = require('../services/AIContextEngine');
global.AIContextEngine = AIContextEngine;

const AIChatIntegration = require('../services/AIChatIntegration');
const AIExamGenerator = require('../services/AIExamGenerator');
const AIExamGrader = require('../services/AIExamGrader');

// Mock AI
async function mockAI(prompt) {
    if (prompt.includes('exam generator')) return JSON.stringify({ subject: "math", topic: "x", questions: [] });
    if (prompt.includes('grading')) return JSON.stringify({ score: 10, isCorrect: true, explanation: "good", learningSuggestion: "" });
    return "Mock Chat Response";
}

async function runTests() {
    console.log('─── Testing AI Usage Tracker ───\n');

    const testUser = {
        id: 'user_123',
        role: 'teacher',
        subject: 'math',
        organizationId: 'academy_A'
    };

    // 1. Simulate Chat
    console.log('[1. Simulating Chat Request...]');
    await AIChatIntegration.processAIRequest(testUser, "مرحباً!", mockAI);

    // 2. Simulate Exam Generation
    console.log('[2. Simulating Exam Generation...]');
    const baseContext = AIContextEngine.getAIContext(testUser);
    const aiContext = { ...baseContext, rawUser: testUser }; // bypass Object.freeze
    
    await AIExamGenerator.generateExam(aiContext, { topic: "الجبر", difficulty: "easy", numberOfQuestions: 1, questionTypes: ["mcq"] }, mockAI);

    // 3. Simulate Exam Grading (With Essay)
    console.log('[3. Simulating Exam Grading...]');
    const mockExam = { subject: "math", topic: "x", questions: [{ type: "essay", question: "اشرح", correctAnswer: "x" }] };
    await AIExamGrader.gradeExamSubmission(mockExam, ["اجابة مقالية"], aiContext, mockAI);

    // 4. Fetch Analytics
    console.log('\n[4. Fetching Usage Analytics for academy_A...]');
    const report = AIUsageTracker.getAIUsageReport('academy_A');
    console.dir(report, { depth: null });

    // 5. Test Soft Limits
    console.log('\n[5. Testing Soft Limits...]');
    try {
        // Set user requests to near limit
        const state = AIUsageTracker._getDbState();
        state.usageDB.users['user_123'].totalRequests = 50; 

        // Check limits directly
        AIUsageTracker.checkUsageLimits(testUser);
        console.log('❌ Should not reach here');
    } catch (e) {
        console.log('✅ Limit Blocked Correctly:', e.message);
    }

    console.log('\n─── Tests Complete ───');
}

runTests();
