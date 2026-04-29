/**
 * ============================================================
 *  Numi Platform — AI Exam Generator
 *  File: src/services/AIExamGenerator.js
 *
 *  Generates strictly structured JSON exams based on AI Context.
 * ============================================================
 */

const _AICE = (typeof AIContextEngine !== 'undefined') 
    ? AIContextEngine 
    : require('./AIContextEngine');

const _AIUsage = (typeof AIUsageTracker !== 'undefined')
    ? AIUsageTracker
    : require('./AIUsageTracker');

// ─── 1. SUBJECT ENFORCEMENT ──────────────────────────────────────────────────

const OUT_OF_SCOPE_KEYWORDS = {
    'math': ['تاريخ', 'جغرافيا', 'لغة', 'انجليزي', 'تعبير', 'قواعد', 'دين', 'اعراب', 'نحو', 'شعر'],
    'science': ['اعراب', 'تاريخ', 'شعر', 'نحو', 'رياضيات', 'حساب'],
    'arabic': ['رياضيات', 'فيزياء', 'كيمياء', 'احياء', 'انجليزي', 'math', 'science'],
    'english': ['اعراب', 'نحو', 'رياضيات', 'فيزياء', 'تاريخ']
};

/**
 * Validates if the requested topic is safely within the user's subject.
 */
function isTopicAllowed(topic, subject) {
    const t = (topic || '').toLowerCase();
    const invalidKeywords = OUT_OF_SCOPE_KEYWORDS[subject.toLowerCase()] || [];
    const isOutside = invalidKeywords.some(keyword => t.includes(keyword));
    return !isOutside;
}

// ─── 2. PROMPT BUILDER ───────────────────────────────────────────────────────

/**
 * Builds the strict JSON-generating prompt for the exam.
 */
function buildExamPrompt(aiContext, config) {
    const { subject } = aiContext;
    const { topic, difficulty, numberOfQuestions, questionTypes } = config;

    let prompt = `You are an exam generator for ${subject}.\n`;
    prompt += `Generate structured educational exams only.\n`;
    prompt += `Do not include unrelated subjects.\n\n`;

    prompt += `Create an exam about: "${topic}".\n`;
    prompt += `Difficulty: ${difficulty}.\n`;
    prompt += `Number of questions: ${numberOfQuestions}.\n`;
    prompt += `Question types allowed: ${questionTypes.join(', ')}.\n\n`;

    prompt += `OUTPUT FORMAT:\n`;
    prompt += `You must return your response STRICTLY as valid JSON. Do not include any markdown formatting (e.g. no \`\`\`json) or extra text. Return ONLY the JSON object.\n\n`;

    prompt += `{
  "subject": "${subject}",
  "topic": "${topic}",
  "questions": [
    {
      "type": "mcq | true_false | fill_blank | essay",
      "question": "string",
      "options": ["string"], // Only for mcq
      "correctAnswer": "string",
      "explanation": "string"
    }
  ]
}`;

    return prompt;
}

// ─── 3. EXAM GENERATOR ───────────────────────────────────────────────────────

/**
 * Generates an exam ensuring subject safety and returning structured JSON.
 * 
 * @param {Object} aiContext - The context from getAIContext(user)
 * @param {Object} config - Exam configuration (topic, difficulty, etc.)
 * @param {Function} aiCallFn - Async function (prompt) => JSON string
 */
async function generateExam(aiContext, config, aiCallFn) {
    const { subject } = aiContext;
    const { topic } = config;

    // --- USAGE LIMIT CHECK ---
    // Note: aiContext should have the user embedded if we want full limits.
    // If not passed fully, we default to tracking the subject as org for tests.
    const mockUser = aiContext.rawUser || { id: 'generator_user', role: aiContext.role, subject: aiContext.subject };
    _AIUsage.checkUsageLimits(mockUser);

    // Step 1: Subject Enforcement
    if (!isTopicAllowed(topic, subject)) {
        throw new Error(`موضوع "${topic}" خارج نطاق مادة ${subject}. يرجى إدخال موضوع متعلق بالمادة.`);
    }

    // Step 2: Build Prompt
    const systemPrompt = buildExamPrompt(aiContext, config);

    // Step 3: Call AI
    const rawResponse = await aiCallFn(systemPrompt);

    // --- LOG USAGE ---
    const estimatedTokens = Math.ceil((systemPrompt.length + rawResponse.length) / 4);
    _AIUsage.logAIUsage({
        user: mockUser,
        type: 'exam_generation',
        tokensUsed: estimatedTokens,
        metadata: { subject, topic, difficulty: config.difficulty }
    });


    // Step 4: Parse & Validate JSON
    try {
        let jsonStr = rawResponse.trim();
        // Fallback cleanup if AI still included markdown
        if (jsonStr.startsWith('\`\`\`json')) {
            jsonStr = jsonStr.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
        }

        const examObj = JSON.parse(jsonStr);

        // Basic validation
        if (examObj.subject.toLowerCase() !== subject.toLowerCase()) {
             throw new Error("AI generated an exam for a different subject.");
        }

        return examObj;

    } catch (err) {
        console.error('[AIExamGenerator] Failed to parse AI response:', err);
        throw new Error("فشل في استخراج هيكل الاختبار من المساعد الذكي.");
    }
}

// ─── 4. FUTURE EXTENSION HOOKS ───────────────────────────────────────────────

/**
 * Placeholder hook for future AI auto-grading system.
 * Takes a student's submission and compares it against the generated exam.
 */
async function gradeExamSubmission(examData, studentAnswers, aiContext) {
    console.warn("gradeExamSubmission is a future extension hook. Not implemented yet.");
    // 1. Calculate Score for MCQs / True_False natively
    // 2. Pass Essay answers to AI for grading
    // 3. Return { totalScore, explanationsForMistakes }
    return {
        status: "pending_implementation",
        score: null,
        feedback: []
    };
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

const AIExamGenerator = {
    isTopicAllowed,
    buildExamPrompt,
    generateExam,
    gradeExamSubmission // Future hook
};

// Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIExamGenerator;
}

// Browser global
if (typeof window !== 'undefined') {
    window.AIExamGenerator = AIExamGenerator;
}
