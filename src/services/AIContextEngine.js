/**
 * ============================================================
 *  Numi Platform — AI Context Engine (Core Logic Layer)
 *  File: src/services/AIContextEngine.js
 *
 *  Prepares AI behavior context based on user identity.
 *  Composes on top of PermissionService (no circular deps).
 *
 *  ✅ No API calls — pure logic only
 *  ✅ No UI — reusable by chat, exams, and future AI features
 *  ✅ Compatible with browser <script> and Node.js require()
 * ============================================================
 */

// ─── DEPENDENCY: PermissionService ───────────────────────────────────────────
// Load from global (browser) or require (Node.js)
const _PS = (typeof PermissionService !== 'undefined')
    ? PermissionService
    : require('./PermissionService');

const { ROLES, resolveSubject, resolvePermissions, buildUserProfile } = _PS;


// ─── 1. AI MODE MAP ──────────────────────────────────────────────────────────
/**
 * Maps each platform role to a named AI operating mode.
 *
 * | Role    | AI Mode           | Behaviour Intent                              |
 * |---------|-------------------|-----------------------------------------------|
 * | teacher | assistant_teacher | Helps prepare lessons, answers, explanations  |
 * | student | learning          | Simple step-by-step explanations, encouragement|
 * | manager | overview          | High-level summaries, no deep drill-downs     |
 * | admin   | overview          | Same as manager, with full data visibility    |
 */
const AI_MODE_MAP = Object.freeze({
    [ROLES.TEACHER]: 'assistant_teacher',
    [ROLES.STUDENT]: 'learning',
    [ROLES.MANAGER]: 'overview',
    [ROLES.ADMIN]:   'overview',
});

/**
 * Resolves the AI mode string for a given role.
 * Falls back to 'learning' for any unrecognised role (safe default).
 *
 * @param {string} role
 * @returns {string}
 */
function resolveAIMode(role) {
    return AI_MODE_MAP[role] || 'learning';
}


// ─── 2. RESPONSE RULES ───────────────────────────────────────────────────────
/**
 * Builds the responseRules object that governs how the AI shapes its replies.
 *
 * | Rule              | Type    | Meaning                                        |
 * |-------------------|---------|------------------------------------------------|
 * | restrictToSubject | boolean | AI must stay within the resolved subject scope |
 * | explainStepByStep | boolean | True only for students — simplified guidance   |
 * | allowAdvanced     | boolean | False for students — hides advanced content    |
 *
 * @param {string} role - Resolved user role
 * @returns {Object} responseRules
 */
function buildResponseRules(role) {
    const isStudent = role === ROLES.STUDENT;

    return Object.freeze({
        /** AI must not answer questions outside the assigned subject */
        restrictToSubject: true,

        /** Students receive step-by-step, simplified explanations */
        explainStepByStep: isStudent,

        /** Non-students may access advanced/technical content */
        allowAdvanced: !isStudent,
    });
}


// ─── 3. CORE: getAIContext ────────────────────────────────────────────────────
/**
 * Prepares the full AI context object for a given user.
 *
 * This is the single entry point consumed by:
 *   • The chat system (to prime the AI prompt)
 *   • The exam/quiz module (to restrict AI hints)
 *   • Any future AI feature on the Numi platform
 *
 * Priority chain for `subject`:
 *   1. user.managerSubject  — manager-assigned override (highest priority)
 *   2. user.subject         — teacher / self-selected subject
 *   3. 'math'               — platform default fallback
 *
 * @param {Object} rawUser - Raw user object (from DB, localStorage, or token payload)
 * @returns {{
 *   role:          string,        // e.g. 'teacher'
 *   subject:       string,        // resolved subject e.g. 'math'
 *   subjectSource: string,        // 'manager' | 'teacher' | 'default'
 *   academyId:     string|null,   // multi-academy scoping (reserved)
 *   permissions:   Object,        // full merged permission map
 *   mode:          string,        // AI operating mode
 *   responseRules: Object,        // rules that shape AI output
 *   meta: {
 *     generatedAt:  string,       // ISO timestamp of context creation
 *     engineVersion: string       // bump when logic changes
 *   }
 * }}
 */
function getAIContext(rawUser) {
    // ── Normalise / extend the raw user object ──────────────────────────────
    const user = buildUserProfile(rawUser);

    if (!user) {
        throw new Error('[AIContextEngine] getAIContext: user is null or undefined.');
    }

    // ── Role ────────────────────────────────────────────────────────────────
    const role = user.role || ROLES.STUDENT;

    // ── Subject (priority: managerSubject → subject → 'math') ───────────────
    const { subject, source: subjectSource } = resolveSubject(user);

    // ── Academy scope ────────────────────────────────────────────────────────
    const academyId = user.academyId || null;

    // ── Permissions (role defaults merged with individual overrides) ─────────
    const permissions = resolvePermissions(user);

    // ── AI Mode ──────────────────────────────────────────────────────────────
    const mode = resolveAIMode(role);

    // ── Response Rules ───────────────────────────────────────────────────────
    const responseRules = buildResponseRules(role);

    // ── Assemble & return ────────────────────────────────────────────────────
    return Object.freeze({
        role,
        subject,
        subjectSource,
        academyId,
        permissions,
        mode,
        responseRules,
        meta: Object.freeze({
            generatedAt:   new Date().toISOString(),
            engineVersion: '1.0.0',
        }),
    });
}


// ─── 4. CONVENIENCE HELPERS ──────────────────────────────────────────────────

/**
 * Quick check — can this user's context generate AI content?
 * Guards the GENERATE_AI and USE_AI_CHAT permissions.
 *
 * @param {Object} aiContext - Result of getAIContext()
 * @returns {boolean}
 */
function canUseAI(aiContext) {
    if (!aiContext || !aiContext.permissions) return false;
    return !!(
        aiContext.permissions['generate_ai'] ||
        aiContext.permissions['use_ai_chat']
    );
}

/**
 * Returns a plain-English system prompt hint to inject at the top of any
 * AI model request.  Does NOT call any API — just formats a string.
 *
 * @param {Object} aiContext - Result of getAIContext()
 * @returns {string}
 */
function buildSystemPromptHint(aiContext) {
    if (!aiContext) return '';

    const { role, subject, mode, responseRules } = aiContext;

    const modeLine = {
        assistant_teacher: 'You are an expert teaching assistant helping an educator.',
        learning:          'You are a friendly, encouraging tutor helping a student learn.',
        overview:          'You provide high-level summaries and insights for platform managers.',
    }[mode] || 'You are a helpful AI assistant on the Numi platform.';

    const stepLine = responseRules.explainStepByStep
        ? 'Always break answers into clear, numbered steps suitable for a student.'
        : 'You may use technical language appropriate for educators or managers.';

    const advancedLine = responseRules.allowAdvanced
        ? 'Advanced concepts and detailed explanations are welcome.'
        : 'Keep explanations simple and avoid overly technical language.';

    return [
        modeLine,
        `You are restricted to the "${subject}" subject only.`,
        'Do not answer questions unrelated to this subject.',
        stepLine,
        advancedLine,
    ].join(' ');
}


// ─── 5. EXPORTS ──────────────────────────────────────────────────────────────

const AIContextEngine = {
    /** ⭐ Primary export — use this in chat, exams, and all AI features */
    getAIContext,

    /** Helpers */
    canUseAI,
    buildSystemPromptHint,

    /** Internals exposed for testing */
    resolveAIMode,
    buildResponseRules,
    AI_MODE_MAP,
};

// Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIContextEngine;
}

// Browser global (loaded via <script> tag)
if (typeof window !== 'undefined') {
    window.AIContextEngine = AIContextEngine;
}
