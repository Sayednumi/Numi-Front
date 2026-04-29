/**
 * Quick test: AIContextEngine
 * Run with: node src/utils/test_ai_context.js
 */

const PermissionService = require('../services/PermissionService');
// Expose as global so AIContextEngine can find it (mirrors browser behaviour)
global.PermissionService = PermissionService;

const AIContextEngine = require('../services/AIContextEngine');
const { getAIContext, canUseAI, buildSystemPromptHint } = AIContextEngine;

// ── Test helpers ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅  ${label}`);
        passed++;
    } else {
        console.error(`  ❌  FAIL: ${label}`);
        failed++;
    }
}

function section(title) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('─'.repeat(60));
}

// ── 1. TEACHER ────────────────────────────────────────────────────────────────
section('Role: TEACHER');
const teacher = getAIContext({ role: 'teacher', subject: 'science' });
assert(teacher.role           === 'teacher',           'role = teacher');
assert(teacher.subject        === 'science',           'subject = science (from user.subject)');
assert(teacher.subjectSource  === 'teacher',           'subjectSource = teacher');
assert(teacher.mode           === 'assistant_teacher', 'mode = assistant_teacher');
assert(teacher.responseRules.restrictToSubject === true,  'restrictToSubject = true');
assert(teacher.responseRules.explainStepByStep === false, 'explainStepByStep = false');
assert(teacher.responseRules.allowAdvanced     === true,  'allowAdvanced = true');
assert(canUseAI(teacher),                              'canUseAI = true');

// ── 2. STUDENT ────────────────────────────────────────────────────────────────
section('Role: STUDENT');
const student = getAIContext({ role: 'student' });
assert(student.role           === 'student',  'role = student');
assert(student.subject        === 'math',     'subject = math (default fallback)');
assert(student.subjectSource  === 'default',  'subjectSource = default');
assert(student.mode           === 'learning', 'mode = learning');
assert(student.responseRules.explainStepByStep === true,  'explainStepByStep = true');
assert(student.responseRules.allowAdvanced     === false, 'allowAdvanced = false');

// ── 3. MANAGER ────────────────────────────────────────────────────────────────
section('Role: MANAGER — managerSubject override');
const manager = getAIContext({
    role: 'manager',
    subject: 'english',           // should be overridden
    managerSubject: 'arabic',     // highest priority
});
assert(manager.role          === 'manager',  'role = manager');
assert(manager.subject       === 'arabic',   'subject = arabic (managerSubject wins)');
assert(manager.subjectSource === 'manager',  'subjectSource = manager');
assert(manager.mode          === 'overview', 'mode = overview');
assert(manager.responseRules.allowAdvanced === true, 'allowAdvanced = true');

// ── 4. ADMIN ──────────────────────────────────────────────────────────────────
section('Role: ADMIN');
const admin = getAIContext({ role: 'admin', permissions: { isOwner: true } });
assert(admin.role   === 'admin',    'role = admin');
assert(admin.mode   === 'overview', 'mode = overview');
assert(admin.subject === 'math',    'subject = math (default)');
assert(canUseAI(admin),             'canUseAI = true');

// ── 5. SUBJECT PRIORITY CHAIN ─────────────────────────────────────────────────
section('Subject Priority Chain');
// managerSubject > subject > default
const u1 = getAIContext({ role: 'teacher', managerSubject: 'physics', subject: 'math' });
assert(u1.subject === 'physics', 'managerSubject wins over subject');

const u2 = getAIContext({ role: 'teacher', subject: 'history' });
assert(u2.subject === 'history', 'user.subject used when no managerSubject');

const u3 = getAIContext({ role: 'teacher' });
assert(u3.subject === 'math', 'defaults to "math" when no subject fields');

// ── 6. PROMPT HINT ────────────────────────────────────────────────────────────
section('buildSystemPromptHint');
const hint = buildSystemPromptHint(student);
assert(hint.includes('student'), 'hint mentions student tutor persona');
assert(hint.includes('math'),    'hint contains resolved subject');
assert(hint.includes('steps'),   'hint includes step-by-step instruction');
console.log('\n  Sample hint (student):\n  →', hint, '\n');

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log('─'.repeat(60));
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('─'.repeat(60));
process.exit(failed > 0 ? 1 : 0);
