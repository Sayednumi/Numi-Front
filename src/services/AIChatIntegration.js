/**
 * ============================================================
 *  Numi Platform — AI Chat Integration & Guard System
 *  File: src/services/AIChatIntegration.js
 *
 *  Provides a secure, role-aware wrapper around all AI requests.
 *  Uses the AIContextEngine to enforce Subject Guard and safe AI responses.
 *
 *  ✅ Injects logic only (no UI dependencies)
 *  ✅ Provides Fallback Safety
 *  ✅ Ready for integration into chat, floating assistants, and exams
 * ============================================================
 */

const _AICE = (typeof AIContextEngine !== 'undefined') 
    ? AIContextEngine 
    : require('./AIContextEngine');

const _AIUsage = (typeof AIUsageTracker !== 'undefined')
    ? AIUsageTracker
    : require('./AIUsageTracker');


const { getAIContext } = _AICE;

// ─── 1. DYNAMIC SYSTEM PROMPT BUILDER ────────────────────────────────────────

/**
 * Builds the dynamic system prompt instructing the AI on how to behave
 * based on the user's role, resolved subject, and teaching strategy.
 *
 * @param {Object} aiContext - Context from getAIContext(user)
 * @param {Object} [rawUser=null] - Raw user object for light personalization
 * @returns {string} System prompt string
 */
function buildAISystemPrompt(aiContext, rawUser = null) {
    if (!aiContext) return '';

    const { role, subject, responseRules } = aiContext;
    const strategy = getTeachingStrategy(role, subject);
    
    // Light Personalization
    const userName = rawUser && rawUser.name ? rawUser.name : (role === 'student' ? 'الطالب' : 'المستخدم');

    let prompt = `You are a professional ${subject} teacher.\n`;
    prompt += `You are talking to ${userName} (Role: ${role}).\n\n`;
    
    // Inject Teacher Profile if applicable
    if (aiContext.teacherProfile) {
        const tp = aiContext.teacherProfile;
        prompt += `User Identity Information:\n`;
        prompt += `- Name: ${tp.name}\n`;
        if (tp.academicDegree) prompt += `- Degree: ${tp.academicDegree}\n`;
        if (tp.bio) prompt += `- Bio: ${tp.bio}\n`;
        prompt += `\nPlease adapt your tone and responses to align with this user's identity when assisting them.\n\n`;
    }

    
    prompt += `Teaching style:\n`;
    prompt += `- Explanation: ${strategy.explanationStyle}\n`;
    prompt += `- Tone: ${strategy.tone}\n`;
    prompt += `- Depth: ${strategy.depth}\n`;
    prompt += `- Use Examples: ${strategy.useExamples}\n\n`;

    prompt += `Response Format Requirements:\n`;
    prompt += `${strategy.format}\n\n`;

    prompt += `Rules:\n`;
    prompt += `- Always teach, not just answer directly.\n`;
    prompt += `- Break down complex ideas appropriately.\n`;
    prompt += `- Adapt your explanation to the user's level.\n`;
    prompt += `- Never answer outside the subject of ${subject}.\n`;
    prompt += `- If question is outside ${subject} → politely refuse.\n`;

    if (!responseRules.allowAdvanced) {
        prompt += `- Do not use overly advanced or complex technical jargon.\n`;
    }

    return prompt;
}


// ─── 1.5. TEACHER PERSONALITY LAYER (STRATEGY) ───────────────────────────────

/**
 * Returns the teaching strategy object defining explanation style, tone, and format
 * based on the user's role.
 *
 * @param {string} role - Resolved user role
 * @param {string} subject - Resolved subject
 * @returns {Object} Strategy configuration
 */
function getTeachingStrategy(role, subject) {
    if (role === 'student') {
        return {
            explanationStyle: 'step-by-step',
            tone: 'friendly, encouraging',
            depth: 'basic',
            useExamples: true,
            format: '1. Simple explanation\n2. Practical example\n3. Quick check question'
        };
    } else if (role === 'teacher') {
        return {
            explanationStyle: 'conceptual',
            tone: 'professional, structured',
            depth: 'detailed',
            useExamples: true,
            format: '1. Concept explanation\n2. Teaching suggestion\n3. Possible student mistakes'
        };
    } else {
        // manager or admin
        return {
            explanationStyle: 'summary',
            tone: 'professional, analytical',
            depth: 'high-level',
            useExamples: false,
            format: '1. Executive summary\n2. Key insights'
        };
    }
}


// ─── 2. SUBJECT GUARD (PRE-AI CHECK) ─────────────────────────────────────────

// Simple keyword heuristic to detect obvious out-of-scope questions.
// Can be expanded with NLP or embeddings in the future.
const OUT_OF_SCOPE_KEYWORDS = {
    'math': ['تاريخ', 'جغرافيا', 'لغة', 'انجليزي', 'تعبير', 'قواعد', 'دين', 'اعراب', 'نحو', 'شعر'],
    'science': ['اعراب', 'تاريخ', 'شعر', 'نحو', 'رياضيات', 'حساب'],
    'arabic': ['رياضيات', 'فيزياء', 'كيمياء', 'احياء', 'انجليزي', 'math', 'science'],
    'english': ['اعراب', 'نحو', 'رياضيات', 'فيزياء', 'تاريخ']
};

/**
 * Analyzes the user's message before calling the AI.
 * If the message is clearly outside the user's assigned subject,
 * it returns a localized refusal string. Otherwise, returns null.
 *
 * @param {string} userMessage - The raw message from the user
 * @param {Object} aiContext - Context from getAIContext(user)
 * @returns {string|null} Refusal message or null if safe to proceed
 */
function preAICheck(userMessage, aiContext) {
    const { subject } = aiContext;
    const msg = (userMessage || '').toLowerCase();

    // Check if the assigned subject has known out-of-scope keywords
    const invalidKeywords = OUT_OF_SCOPE_KEYWORDS[subject.toLowerCase()] || [];

    const isClearlyOutsideSubject = invalidKeywords.some(keyword => msg.includes(keyword));

    if (isClearlyOutsideSubject) {
        // Return standard Arabic refusal
        return `أنا متخصص في مادة ${subject} فقط، من فضلك اسأل في نطاق المادة.`;
    }

    // Safe to proceed to AI
    return null;
}


// ─── 3. SAFE RESPONSE FILTER (POST-AI CHECK) ─────────────────────────────────

/**
 * Validates the AI's response after it is generated.
 * Ensures the AI didn't hallucinate or provide information outside the subject.
 *
 * @param {string} aiResponse - The text returned by the AI model
 * @param {Object} aiContext - Context from getAIContext(user)
 * @returns {string} The filtered response or a safe fallback
 */
function postAIFilter(aiResponse, aiContext) {
    const { subject } = aiContext;
    const resp = (aiResponse || '').toLowerCase();

    // If AI explicitly states it cannot answer, we let it pass
    if (resp.includes('cannot answer') || resp.includes('لا يمكنني')) {
        return aiResponse;
    }

    // If the AI somehow hallucinates and talks heavily about an unrelated subject
    const invalidKeywords = OUT_OF_SCOPE_KEYWORDS[subject.toLowerCase()] || [];
    
    // We use a stricter check for post-filter to avoid false positives (e.g. if AI just mentions a word)
    // For this implementation, if it detects multiple unrelated keywords, it triggers the filter.
    let violationCount = 0;
    invalidKeywords.forEach(keyword => {
        if (resp.includes(keyword)) violationCount++;
    });

    if (violationCount >= 2) {
        console.warn(`[Subject Guard] AI response filtered. Subject: ${subject}`);
        return `أعتذر، يبدو أن الإجابة خرجت عن نطاق مادة ${subject}. يرجى طرح سؤال متعلق بالمادة فقط.`;
    }

    return aiResponse;
}


// ─── 4. MAIN INTEGRATION WRAPPER (FALLBACK SAFETY) ───────────────────────────

/**
 * The main entry point for any AI request (Chat, Floating Assistant, Exams).
 * Ties the entire flow together and catches crashes to protect the UI.
 *
 * @param {Object} rawUser - The user object sending the request
 * @param {string} userMessage - The message/prompt from the user
 * @param {Function} aiCallFn - An async function that calls the actual AI API: async (systemPrompt, userMsg) => string
 * @returns {Promise<string>} The final, safe response string to display in UI
 */
async function processAIRequest(rawUser, userMessage, aiCallFn) {
    try {
        // --- USAGE LIMIT CHECK ---
        _AIUsage.checkUsageLimits(rawUser);

        // Step 1: Connect AI Context
        const aiContext = getAIContext(rawUser);

        // Step 2: Subject Guard (Pre-AI Check)
        const guardRejection = preAICheck(userMessage, aiContext);
        if (guardRejection) {
            return guardRejection; // Reject immediately, saving API costs
        }

        // Step 3: Build System Prompt
        const systemPrompt = buildAISystemPrompt(aiContext, rawUser);

        // Step 4: Execute AI Call (Wrapped in Try/Catch for Fallback Safety)
        let rawAIResponse = '';
        try {
            rawAIResponse = await aiCallFn(systemPrompt, userMessage);
            if (!rawAIResponse) throw new Error("Empty AI response");
        } catch (apiError) {
            console.error('[AI Integration] API Call Failed:', apiError);
            return 'حدث خطأ أثناء الاتصال بالمساعد الذكي. يرجى المحاولة لاحقاً.';
        }

        // Step 5: Safe Response Filter (Post-AI)
        const safeResponse = postAIFilter(rawAIResponse, aiContext);

        // --- LOG USAGE ---
        const estimatedTokens = Math.ceil((systemPrompt.length + safeResponse.length) / 4);
        _AIUsage.logAIUsage({
            user: rawUser,
            type: 'chat',
            tokensUsed: estimatedTokens,
            metadata: { subject: aiContext.subject }
        });

        return safeResponse;

    } catch (engineError) {
        // Ultimate Fallback Safety: Never crash the UI
        console.error('[AI Integration] Fatal Engine Error:', engineError);
        return 'عذراً، حدث خطأ غير متوقع. لا يمكن معالجة طلبك حالياً.';
    }
}


// ─── 5. EXPORTS ──────────────────────────────────────────────────────────────

const AIChatIntegration = {
    buildAISystemPrompt,
    getTeachingStrategy,
    preAICheck,
    postAIFilter,
    processAIRequest
};

// Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIChatIntegration;
}

// Browser global
if (typeof window !== 'undefined') {
    window.AIChatIntegration = AIChatIntegration;
}
