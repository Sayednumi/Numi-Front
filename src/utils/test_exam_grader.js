/**
 * Quick test: AIExamGrader
 * Run with: node src/utils/test_exam_grader.js
 */

const AIContextEngine = require('../services/AIContextEngine');
global.AIContextEngine = AIContextEngine;

const AIExamGrader = require('../services/AIExamGrader');

// Mock AI function for Essay Evaluation
async function mockAIGrader(systemPrompt) {
    if (systemPrompt.includes('Science')) {
        return JSON.stringify({
            score: 8,
            isCorrect: true,
            explanation: "الإجابة جيدة وتشرح المفهوم الأساسي ولكنها تفتقر إلى بعض التفاصيل العلمية الدقيقة.",
            learningSuggestion: "حاول استخدام مصطلحات علمية أكثر دقة في المرة القادمة."
        });
    }

    return JSON.stringify({
        score: 2,
        isCorrect: false,
        explanation: "الإجابة لا تمت للموضوع بصلة.",
        learningSuggestion: "يرجى قراءة الدرس جيداً قبل الإجابة."
    });
}

async function runTests() {
    console.log('─── Testing AI Exam Grader ───\n');

    // Mock Context
    const aiContext = { subject: 'Science', role: 'teacher' };

    // Mock Exam
    const mockExam = {
        subject: "Science",
        topic: "Physics",
        questions: [
            {
                type: "mcq",
                question: "ما هو الكوكب الأقرب للشمس؟",
                correctAnswer: "عطارد",
                explanation: "عطارد هو الكوكب الأول في النظام الشمسي."
            },
            {
                type: "fill_blank",
                question: "الماء يتكون من هيدروجين و _______.",
                correctAnswer: "أكسجين",
                explanation: "H2O يعني ذرتي هيدروجين وذرة أكسجين."
            },
            {
                type: "essay",
                question: "اشرح باختصار قانون الجاذبية لنيوتن.",
                correctAnswer: "قانون يصف الجذب بين الكتل." // Ideal Answer
            }
        ]
    };

    // Mock Student Answers
    const studentAnswers = [
        "عطارد", // Correct MCQ
        "اكسجين", // Correct Fill Blank (normalized to ignore hamza)
        "الجاذبية هي قوة تجذب الأشياء لبعضها البعض." // Essay
    ];

    try {
        console.log('[1. Running Auto-Grader on Mixed Exam...]');
        const gradingResult = await AIExamGrader.gradeExamSubmission(mockExam, studentAnswers, aiContext, mockAIGrader);
        
        console.log('\n--- GRADING RESULTS ---');
        console.log(`Total Score: ${gradingResult.totalScore} / ${gradingResult.maxScore}`);
        console.log(`Percentage: ${gradingResult.percentage}%`);
        console.log(`Encouragement: ${gradingResult.encouragementMessage}`);
        
        console.log('\n--- DETAILED QUESTION RESULTS ---');
        gradingResult.results.forEach((r, idx) => {
            console.log(`\nQ${idx + 1}: ${r.question}`);
            console.log(`Student Answer: ${r.studentAnswer}`);
            console.log(`Score: ${r.score}/${r.maxScore} (${r.isCorrect ? '✅' : '❌'})`);
            console.log(`Explanation: ${r.explanation}`);
        });

        console.log('\n--- LEARNING SUGGESTIONS ---');
        gradingResult.learningSuggestions.forEach(s => console.log(`- ${s}`));

    } catch (e) {
        console.error('❌ Failed:', e.message);
    }

    // 2. Invalid Subject Rejection
    try {
        console.log('\n\n[2. Testing Invalid Subject Rejection...]');
        const mathContext = { subject: 'Math', role: 'teacher' };
        await AIExamGrader.gradeExamSubmission(mockExam, studentAnswers, mathContext, mockAIGrader);
        console.log('❌ Should not reach here');
    } catch (e) {
        console.log('✅ Successfully Blocked:', e.message);
    }

    console.log('\n─── Tests Complete ───');
}

runTests();
