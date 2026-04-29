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

const { getAIContext } = _AICE;

// ─── 1. DYNAMIC SYSTEM PROMPT BUILDER ────────────────────────────────────────

/**
 * Builds the dynamic system prompt instructing the AI on how to behave
 * based on the user's role and resolved subject.
 *
 * @param {Object} aiContext - Context from getAIContext(user)
 * @returns {string} System prompt string
 */
function buildAISystemPrompt(aiContext) {
    if (!aiContext) return '';

    const { role, subject, responseRules } = aiContext;

    let prompt = `You are an AI assistant specialized ONLY in ${subject}.\n`;
    prompt += `User role: ${role}.\n\n`;
    prompt += `Rules:\n`;
    prompt += `- Never answer outside ${subject}\n`;
    prompt += `- If question is outside subject → politely refuse\n`;

    if (responseRules.explainStepByStep) {
        prompt += `- If user is student → explain step-by-step\n`;
    } else if (role === 'teacher') {
        prompt += `- If user is teacher → give structured teaching answers\n`;
    }

    if (!responseRules.allowAdvanced) {
        prompt += `- Do not use overly advanced or complex technical jargon.\n`;
    }

    return prompt;
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
        // Step 1: Connect AI Context
        const aiContext = getAIContext(rawUser);

        // Step 2: Subject Guard (Pre-AI Check)
        const guardRejection = preAICheck(userMessage, aiContext);
        if (guardRejection) {
            return guardRejection; // Reject immediately, saving API costs
        }

        // Step 3: Build System Prompt
        const systemPrompt = buildAISystemPrompt(aiContext);

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
