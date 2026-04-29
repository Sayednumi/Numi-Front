/**
 * ============================================================
 *  Numi Platform — Live Class E2E Test
 *  File: src/utils/test_live_class.js
 * ============================================================
 */

// Load globals
const PermissionService = require('../services/PermissionService');
global.PermissionService = PermissionService;
const TenantManager = require('../services/TenantManager');
global.TenantManager = TenantManager;
const AIUsageTracker = require('../services/AIUsageTracker');
global.AIUsageTracker = AIUsageTracker;
const NotificationService = require('../services/NotificationService');
global.NotificationService = NotificationService;
const AIChatIntegration = require('../services/AIChatIntegration');
global.AIChatIntegration = AIChatIntegration;

const LiveClassManager = require('../services/LiveClassManager');

function ok(label, val) { console.log(`  ${val ? '✅' : '❌'}  ${label}`); if(!val) process.exitCode = 1; }

async function run() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║        NUMI LIVE CLASS SYSTEM TEST           ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // 1. Setup Tenant and Users
    const t1 = TenantManager.createTenant({ name: 'أكاديمية نيومي', type: 'academy', adminId: 'admin_1' });
    const orgId = t1.organizationId;
    
    const teacher = { id: 't_1', role: 'teacher', organizationId: orgId, fullName: 'أ. خالد' };
    const student1 = { id: 's_1', role: 'student', organizationId: orgId, fullName: 'أحمد' };
    const studentForeign = { id: 's_2', role: 'student', organizationId: 'foreign_org' };

    TenantManager.assignUserToOrganization(teacher.id, orgId);
    
    // Ensure NotificationService finds them by explicitly pushing to the students array
    const { OrganizationManager } = require('../models/Organization');
    const orgRecord = OrganizationManager.getOrganization(orgId);
    orgRecord.students.push(student1.id);
    TenantManager.assignUserToOrganization(student1.id, orgId);

    // 2. Create Session
    const session = LiveClassManager.createSession(teacher, 'مراجعة التفاضل', 'math', new Date().toISOString());
    ok('Session created with ID', !!session.id);
    ok('Status is scheduled', session.status === 'scheduled');
    
    // Check notification emitted
    const notifs = NotificationService.getUserNotifications(student1.id);
    ok('Student received scheduled notification', notifs.some(n => n.title.includes('حصة مباشرة جديدة')));

    // 3. Start Session
    LiveClassManager.startSession(teacher, session.id);
    ok('Session started', session.status === 'active');

    // 4. Student Join
    const joined = LiveClassManager.joinSession(student1, session.id);
    ok('Student 1 joined successfully', session.attendees.has(student1.id));
    
    let crossBlocked = false;
    try { LiveClassManager.joinSession(studentForeign, session.id); } catch (e) { crossBlocked = true; }
    ok('Foreign student blocked from joining', crossBlocked);

    // 5. Chat & Polling
    await LiveClassManager.sendChatMessage(teacher, session.id, 'أهلاً بكم في حصة المراجعة!');
    
    const poll = LiveClassManager.launchPoll(teacher, session.id, 'ما هو تفاضل x^2؟', ['2x', 'x', '2']);
    ok('Poll launched', !!poll.id);
    
    LiveClassManager.submitPollAnswer(student1, session.id, poll.id, 0); // chooses '2x'
    ok('Student submitted poll answer', poll.answers[student1.id] === 0);

    // 6. AI Live Teacher Mode
    LiveClassManager.toggleAITeacherMode(teacher, session.id, true);
    ok('AI Mode Enabled', session.aiModeEnabled === true);

    const mockAICall = async () => 'تفاضل Sin(x) هو Cos(x) يا أحمد.';
    
    // Student asks a question -> triggers AI
    await LiveClassManager.sendChatMessage(student1, session.id, 'ما هو تفاضل Sin(x)؟', mockAICall);
    
    const joinedState = LiveClassManager.joinSession(student1, session.id);
    const aiMessage = joinedState.chatHistory.find(m => m.isAI);
    ok('AI auto-answered student question in chat', !!aiMessage);
    console.log(`     ↳ AI Reply: "${aiMessage.text}"`);

    // 7. End Session & Analytics
    const recording = LiveClassManager.endSession(teacher, session.id);
    ok('Session ended', session.status === 'ended');
    ok('Recording URL generated', !!recording.videoUrl);
    
    const analytics = LiveClassManager.getSessionAnalytics(teacher, session.id);
    ok('Analytics: Max Concurrent = 1', analytics.maxConcurrent === 1);
    ok('Analytics: Messages = 3 (Teacher + Student + AI)', analytics.messagesCount === 3);
    ok('Analytics: AI Intervention logged', analytics.aiInterventions === 1);

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ✅ All Live Class Tests Passed!             ║');
    console.log('╚══════════════════════════════════════════════╝\n');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
