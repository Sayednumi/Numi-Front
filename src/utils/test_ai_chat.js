/**
 * Quick test: AIChatIntegration
 * Run with: node src/utils/test_ai_chat.js
 */

const PermissionService = require('../services/PermissionService');
global.PermissionService = PermissionService;
const AIContextEngine = require('../services/AIContextEngine');
global.AIContextEngine = AIContextEngine;

const AIChatIntegration = require('../services/AIChatIntegration');
const { processAIRequest } = AIChatIntegration;

// Mock AI function
async function mockAI(systemPrompt, userMessage) {
    // If the test sends "AI ERROR", simulate API failure
    if (userMessage === 'AI ERROR') throw new Error("API Timeout");
    
    // Simulate hallucination
    if (userMessage.includes('hallucinate')) return 'الجواب هو كذا والتاريخ والجغرافيا والاعراب مهم أيضا';

    return `(AI Response to: ${userMessage})`;
}

async function runTests() {
    console.log('─── Testing AI Chat Integration ───\n');

    const rawUser = { role: 'student', subject: 'math' };

    // 1. Normal valid request
    const r1 = await processAIRequest(rawUser, 'كيف أحل هذه المعادلة؟', mockAI);
    console.log('[Valid]:', r1);

    // 2. Pre-AI Check block (Asking Arabic in Math subject)
    const r2 = await processAIRequest(rawUser, 'ما هو اعراب الجملة؟', mockAI);
    console.log('[Pre-Check Block]:', r2);

    // 3. Post-AI Check block (AI hallucinates and mentions multiple invalid subjects)
    const r3 = await processAIRequest(rawUser, 'hallucinate', mockAI);
    console.log('[Post-Check Block]:', r3);

    // 4. AI API Failure Fallback
    const r4 = await processAIRequest(rawUser, 'AI ERROR', mockAI);
    console.log('[API Failure Fallback]:', r4);

    // 5. Fatal Engine Error (Pass null rawUser)
    const r5 = await processAIRequest(null, 'hello', mockAI);
    console.log('[Fatal Engine Fallback]:', r5);
    
    console.log('\n─── Tests Complete ───');
}

runTests();
