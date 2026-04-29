/**
 * ============================================================
 *  Numi Platform — AI Exam Grader
 *  File: src/services/AIExamGrader.js
 *
 *  Auto-grades objective questions natively and delegates essay
 *  grading to the AI, ensuring subject boundaries and providing
 *  rich educational feedback.
 * ============================================================
 */

const _AICE = (typeof AIContextEngine !== 'undefined') 
    ? AIContextEngine 
    : require('./AIContextEngine');

const _AIUsage = (typeof AIUsageTracker !== 'undefined')
    ? AIUsageTracker
    : require('./AIUsageTracker');

const _Notif = (typeof NotificationService !== 'undefined')
    ? NotificationService
    : require('./NotificationService');



// ─── 1. SUBJECT ENFORCEMENT ──────────────────────────────────────────────────

function validateExamSubject(exam, aiContext) {
    if (exam.subject.toLowerCase() !== aiContext.subject.toLowerCase()) {
        throw new Error(`Subject mismatch. Cannot grade a ${exam.subject} exam as a ${aiContext.subject} user.`);
    }
}

// ─── 2. NATIVE AUTO-GRADING (OBJECTIVE) ──────────────────────────────────────

function normalizeString(str) {
    if (!str) return '';
    return str.toString().trim().toLowerCase()
        // Simple normalization for Arabic characters (أ, إ, آ -> ا) (ة -> ه)
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه');
}

function gradeObjectiveQuestion(questionObj, studentAnswer) {
    let isCorrect = false;
    const type = questionObj.type;
    const correct = questionObj.correctAnswer;
    const ans = studentAnswer;

    if (type === 'mcq' || type === 'true_false') {
        isCorrect = normalizeString(ans) === normalizeString(correct);
    } else if (type === 'fill_blank') {
        // Compare normalized strings for fill in the blank to allow minor spacing differences
        isCorrect = normalizeString(ans) === normalizeString(correct);
    }

    return {
        question: questionObj.question,
        studentAnswer: ans || "",
        correctAnswer: correct,
        score: isCorrect ? 10 : 0, // Default 10 points per objective question
        maxScore: 10,
        isCorrect: isCorrect,
        explanation: isCorrect 
            ? "إجابة صحيحة!" 
            : `إجابة خاطئة. الإجابة الصحيحة هي: ${correct}. ${questionObj.explanation || ''}`
    };
}

// ─── 3. AI GRADING (ESSAY ONLY) ──────────────────────────────────────────────

/**
 * Builds the prompt for the AI to evaluate a single essay question.
 */
function buildEssayGradingPrompt(aiContext, questionObj, studentAnswer) {
    const { subject } = aiContext;

    let prompt = `You are a professional teacher grading an exam in ${subject}.\n`;
    prompt += `Evaluate the following essay question based strictly on ${subject} principles.\n\n`;
    
    prompt += `Question: "${questionObj.question}"\n`;
    prompt += `Ideal Answer / Concept: "${questionObj.correctAnswer || 'Accept any correct reasoning'}"\n`;
    prompt += `Student's Answer: "${studentAnswer || ''}"\n\n`;

    prompt += `You must return your evaluation STRICTLY as valid JSON without any markdown formatting.\n`;
    prompt += `Do NOT include any extra text outside the JSON object.\n\n`;

    prompt += `{
  "score": number, // out of 10
  "isCorrect": boolean, // true if score >= 5
  "explanation": "string", // explanation of correctness or missing points
  "learningSuggestion": "string" // how the student can improve
}`;

    return prompt;
}

async function gradeEssayQuestion(questionObj, studentAnswer, aiContext, aiCallFn) {
    // If empty answer, automatically zero
    if (!studentAnswer || studentAnswer.trim() === '') {
        return {
            question: questionObj.question,
            studentAnswer: "",
            correctAnswer: questionObj.correctAnswer,
            score: 0,
            maxScore: 10,
            isCorrect: false,
            explanation: "لم يتم تقديم إجابة.",
            learningSuggestion: "تأكد من كتابة إجابة كاملة في المرة القادمة."
        };
    }

    const systemPrompt = buildEssayGradingPrompt(aiContext, questionObj, studentAnswer);
    
    try {
        const rawResponse = await aiCallFn(systemPrompt);
        
        // --- LOG USAGE FOR THIS ESSAY ---
        const estimatedTokens = Math.ceil((systemPrompt.length + rawResponse.length) / 4);
        const mockUser = aiContext.rawUser || { id: 'grader_user', role: aiContext.role, subject: aiContext.subject };
        _AIUsage.logAIUsage({
            user: mockUser,
            type: 'exam_grading',
            tokensUsed: estimatedTokens,
            metadata: { subject: aiContext.subject, questionType: 'essay' }
        });

        let jsonStr = rawResponse.trim();
        if (jsonStr.startsWith('\`\`\`json')) {
            jsonStr = jsonStr.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
        }
        
        const aiEvaluation = JSON.parse(jsonStr);

        return {
            question: questionObj.question,
            studentAnswer: studentAnswer,
            correctAnswer: questionObj.correctAnswer,
            score: aiEvaluation.score || 0,
            maxScore: 10,
            isCorrect: aiEvaluation.isCorrect || false,
            explanation: aiEvaluation.explanation || "تم تقييم الإجابة بواسطة المساعد الذكي.",
            learningSuggestion: aiEvaluation.learningSuggestion || ""
        };

    } catch (e) {
        console.error('[AIExamGrader] Failed to grade essay via AI:', e);
        // Safe fallback
        return {
            question: questionObj.question,
            studentAnswer: studentAnswer,
            correctAnswer: questionObj.correctAnswer,
            score: 0,
            maxScore: 10,
            isCorrect: false,
            explanation: "حدث خطأ أثناء التقييم الآلي للإجابة المقالية. سيتم مراجعتها يدوياً."
        };
    }
}

// ─── 4. MAIN GRADING ORCHESTRATOR ────────────────────────────────────────────

/**
 * Orchestrates the grading of the entire exam.
 * Objective questions are graded natively instantly.
 * Essay questions are dispatched to the AI.
 */
async function gradeExamSubmission(exam, studentAnswers, aiContext, aiCallFn) {
    // --- USAGE LIMIT CHECK ---
    const mockUser = aiContext.rawUser || { id: 'grader_user', role: aiContext.role, subject: aiContext.subject };
    _AIUsage.checkUsageLimits(mockUser);

    validateExamSubject(exam, aiContext);

    let totalScore = 0;
    let maxScore = 0;
    const results = [];
    const learningSuggestions = [];

    for (let i = 0; i < exam.questions.length; i++) {
        const questionObj = exam.questions[i];
        const studentAns = studentAnswers[i];
        let gradedResult;

        if (questionObj.type === 'essay') {
            gradedResult = await gradeEssayQuestion(questionObj, studentAns, aiContext, aiCallFn);
            if (gradedResult.learningSuggestion) {
                learningSuggestions.push(gradedResult.learningSuggestion);
            }
        } else {
            gradedResult = gradeObjectiveQuestion(questionObj, studentAns);
        }

        totalScore += gradedResult.score;
        maxScore += gradedResult.maxScore;
        results.push(gradedResult);
    }

    // ─── 5. FEEDBACK SYSTEM ──────────────────────────────────────────────────
    
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    let encouragementMessage = "";

    if (percentage >= 90) {
        encouragementMessage = "عمل ممتاز! أداؤك رائع جداً واستيعابك للمفاهيم ممتاز.";
    } else if (percentage >= 70) {
        encouragementMessage = "جيد جداً! لديك أساس قوي، مع قليل من المراجعة ستصل للقمة.";
    } else if (percentage >= 50) {
        encouragementMessage = "نجاح مقبول. تحتاج إلى تركيز أكبر ومراجعة النقاط الضعيفة المذكورة.";
    } else {
        encouragementMessage = "لا بأس، كل خطأ هو فرصة للتعلم. راجع الملاحظات المرفقة وحاول مجدداً.";
    }

    // ─── 6. FUTURE HOOKS ─────────────────────────────────────────────────────
    
    const futureHooksData = {
        xpReward: Math.floor(percentage / 10), // Example: 100% = 10 XP
        weakTopicsDetected: learningSuggestions.length > 0 ? true : false,
        requiresTeacherReview: results.some(r => r.score === 0 && r.type === 'essay')
    };

    const gradingResult = {
        totalScore,
        maxScore,
        percentage: Math.round(percentage),
        encouragementMessage,
        results,
        learningSuggestions,
        _futureHooks: futureHooksData
    };

    // ── Notification Hook: emit grading completed ────────────────────────────
    try {
        const studentId = aiContext.rawUser ? (aiContext.rawUser.id || aiContext.rawUser._id) : null;
        const teacherId = aiContext.rawUser ? aiContext.rawUser.teacherId : null;
        const weakTopics = learningSuggestions.length > 0 ? [aiContext.subject] : [];
        _Notif.emit(_Notif.EVENTS.GRADING_COMPLETED, {
            studentId,
            teacherId,
            subject: aiContext.subject,
            percentage: Math.round(percentage),
            weakTopics
        });
    } catch (e) { /* Never break grading because of notifications */ }

    return gradingResult;
}


// ─── EXPORTS ─────────────────────────────────────────────────────────────────

const AIExamGrader = {
    gradeExamSubmission,
    gradeObjectiveQuestion,
    buildEssayGradingPrompt
};

// Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIExamGrader;
}

// Browser global
if (typeof window !== 'undefined') {
    window.AIExamGrader = AIExamGrader;
}
