/**
 * Quick test: AIExamGenerator
 * Run with: node src/utils/test_exam_generator.js
 */

const PermissionService = require('../services/PermissionService');
global.PermissionService = PermissionService;
const AIContextEngine = require('../services/AIContextEngine');
global.AIContextEngine = AIContextEngine;

const AIExamGenerator = require('../services/AIExamGenerator');

// Mock AI function
async function mockAI(systemPrompt) {
    // If the subject is math, return a mock math JSON
    if (systemPrompt.includes('exam generator for math')) {
        return JSON.stringify({
            subject: "math",
            topic: "الجبر",
            questions: [
                {
                    type: "mcq",
                    question: "حل المعادلة س + 2 = 5",
                    options: ["2", "3", "4", "5"],
                    correctAnswer: "3",
                    explanation: "نطرح 2 من الطرفين"
                }
            ]
        });
    }

    // If the subject is science, return a mock science JSON
    if (systemPrompt.includes('exam generator for science')) {
        return JSON.stringify({
            subject: "science",
            topic: "الكواكب",
            questions: [
                {
                    type: "true_false",
                    question: "الأرض تدور حول الشمس",
                    correctAnswer: "true",
                    explanation: "الأرض كوكب يدور في النظام الشمسي"
                }
            ]
        });
    }

    return "{}"; // default fallback
}

async function runTests() {
    console.log('─── Testing AI Exam Generator ───\n');

    // 1. Valid Math Exam Generation
    try {
        const mathUser = { role: 'teacher', subject: 'math' };
        const mathContext = AIContextEngine.getAIContext(mathUser);
        const mathConfig = {
            topic: "الجبر",
            difficulty: "medium",
            numberOfQuestions: 5,
            questionTypes: ["mcq", "essay"]
        };
        
        console.log('[1. Testing Valid Math Exam...]');
        const mathResult = await AIExamGenerator.generateExam(mathContext, mathConfig, mockAI);
        console.log('✅ Success:', mathResult);
    } catch (e) {
        console.error('❌ Failed:', e.message);
    }

    // 2. Valid Science Exam Generation
    try {
        const sciUser = { role: 'teacher', subject: 'science' };
        const sciContext = AIContextEngine.getAIContext(sciUser);
        const sciConfig = {
            topic: "الكواكب",
            difficulty: "easy",
            numberOfQuestions: 3,
            questionTypes: ["true_false"]
        };
        
        console.log('\n[2. Testing Valid Science Exam...]');
        const sciResult = await AIExamGenerator.generateExam(sciContext, sciConfig, mockAI);
        console.log('✅ Success:', sciResult);
    } catch (e) {
        console.error('❌ Failed:', e.message);
    }

    // 3. Invalid Subject Rejection (Asking for history in math)
    try {
        const rejectUser = { role: 'teacher', subject: 'math' };
        const rejectContext = AIContextEngine.getAIContext(rejectUser);
        const rejectConfig = {
            topic: "تاريخ الفراعنة",
            difficulty: "easy",
            numberOfQuestions: 2,
            questionTypes: ["mcq"]
        };
        
        console.log('\n[3. Testing Invalid Subject Rejection...]');
        const rejectResult = await AIExamGenerator.generateExam(rejectContext, rejectConfig, mockAI);
        console.log('❌ Should not reach here:', rejectResult);
    } catch (e) {
        console.log('✅ Successfully Blocked:', e.message);
    }

    console.log('\n─── Tests Complete ───');
}

runTests();
