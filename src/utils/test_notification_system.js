/**
 * Full Notification System Test
 * Run with: node src/utils/test_notification_system.js
 */

const NotificationService  = require('../services/NotificationService');
global.NotificationService = NotificationService;

const PermissionService    = require('../services/PermissionService');
global.PermissionService   = PermissionService;

const AIContextEngine      = require('../services/AIContextEngine');
global.AIContextEngine     = AIContextEngine;

const AIUsageTracker       = require('../services/AIUsageTracker');
global.AIUsageTracker      = AIUsageTracker;

const TeacherContentStore  = require('../services/TeacherContentStore');
global.TeacherContentStore = TeacherContentStore;

const RAGEngine            = require('../services/RAGEngine');
global.RAGEngine           = RAGEngine;

const AIExamGrader         = require('../services/AIExamGrader');

const { OrganizationManager } = require('../models/Organization');
global.OrganizationManager = OrganizationManager;

const { TeacherProfileManager } = require('../models/TeacherProfile');

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function section(title) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  ${title}`);
    console.log('─'.repeat(50));
}

function check(label, value) {
    const icon = value ? '✅' : '❌';
    console.log(`  ${icon}  ${label}`);
    if (!value) process.exitCode = 1;
}

// ─── SEED ─────────────────────────────────────────────────────────────────────
const org = OrganizationManager.createOrganization({
    name: 'أكاديمية نيومي',
    type: 'academy',
    adminId: 'admin_1',
    teachers: ['teacher_1'],
    students: ['student_1', 'student_2']
});

async function runTests() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   Numi — Notification System Full Test Suite  ║');
    console.log('╚══════════════════════════════════════════════╝');

    // ── 1. Direct Notification ────────────────────────────────────────────────
    section('1. Direct Notification (Teacher → Student)');
    const n1 = NotificationService.sendNotification(['student_1'], {
        type: NotificationService.NOTIFICATION_TYPES.MESSAGE,
        title: 'ملاحظة على الواجب',
        body: 'أحسنت! لكن راجع القسم الثاني.',
        senderId: 'teacher_1',
        priority: NotificationService.PRIORITY.MEDIUM
    });
    check('Notification created', !!n1);
    check('Student inbox has entry', NotificationService.getUserNotifications('student_1').length === 1);
    check('Notification is unread', NotificationService.getUnreadCount('student_1') === 1);

    // ── 2. Mark as Read ───────────────────────────────────────────────────────
    section('2. Mark as Read');
    NotificationService.markAsRead(n1.id, 'student_1');
    check('Unread count is 0 after read', NotificationService.getUnreadCount('student_1') === 0);
    const fetched = NotificationService.getUserNotifications('student_1');
    check('isRead flag is true', fetched[0].isRead === true);

    // ── 3. Bulk Notification (Admin → Organization) ───────────────────────────
    section('3. Bulk Notification (Admin → Academy)');
    const n2 = NotificationService.sendBulkNotification(org.id, {
        type: NotificationService.NOTIFICATION_TYPES.SYSTEM,
        title: 'تحديث النظام',
        body: 'تم إضافة ميزات جديدة للمنصة.',
        senderId: 'admin_1',
        priority: NotificationService.PRIORITY.LOW
    });
    check('Bulk notification created', !!n2);
    check('Teacher received bulk', NotificationService.getUserNotifications('teacher_1').length >= 1);
    check('Student_2 received bulk', NotificationService.getUserNotifications('student_2').length >= 1);

    // ── 4. Scheduled Notification ─────────────────────────────────────────────
    section('4. Scheduled Notification (1 second delay)');
    const futureTime = new Date(Date.now() + 1000).toISOString();
    const sched = NotificationService.scheduleNotification({
        type: NotificationService.NOTIFICATION_TYPES.REMINDER,
        title: 'تذكير: الاختبار غداً',
        body: 'لا تنس مراجعة الفصل الثالث.',
        senderId: 'system',
        targetUsers: ['student_1'],
        priority: NotificationService.PRIORITY.HIGH
    }, futureTime);
    check('Scheduled notification queued', !!sched);

    NotificationService.startScheduler(500); // poll every 500ms
    await new Promise(r => setTimeout(r, 1600)); // wait for delivery
    NotificationService.stopScheduler();

    const student1Notifs = NotificationService.getUserNotifications('student_1');
    const hasScheduled = student1Notifs.some(n => n.title === 'تذكير: الاختبار غداً');
    check('Scheduled notification delivered', hasScheduled);

    // ── 5. Event-Driven: exam.created ─────────────────────────────────────────
    section('5. Event Hook — exam.created');
    NotificationService.emit(NotificationService.EVENTS.EXAM_CREATED, {
        teacherName: 'أ. سارة',
        subject: 'science',
        organizationId: org.id,
        targetStudents: ['student_1', 'student_2']
    });
    const examNotif = NotificationService.getUserNotifications('student_1')
        .find(n => n.type === NotificationService.NOTIFICATION_TYPES.EXAM);
    check('Exam notification received by student', !!examNotif);

    // ── 6. Event-Driven: rag.material_uploaded ────────────────────────────────
    section('6. Event Hook — rag.material_uploaded (via ContentStore)');
    TeacherContentStore.uploadMaterial(
        'teacher_1',
        'محتوى مادة العلوم: الطاقة هي القدرة على بذل الشغل...',
        {
            title: 'وحدة الطاقة',
            subject: 'science',
            organizationId: org.id,
            targetStudents: ['student_1', 'student_2'],
            teacherName: 'أ. سارة'
        }
    );
    const matNotif = NotificationService.getUserNotifications('student_1')
        .find(n => n.type === NotificationService.NOTIFICATION_TYPES.MATERIAL);
    check('Material notification auto-fired', !!matNotif);
    check('Material title in body', matNotif && matNotif.title.includes('وحدة الطاقة'));

    // ── 7. Event-Driven: grading.completed → AI Alert ─────────────────────────
    section('7. Event Hook — grading.completed → AI Alert');
    const mockExam = {
        subject: 'science',
        topic: 'الطاقة',
        questions: [{ type: 'mcq', question: 'ما هي الطاقة؟', correctAnswer: 'ب', explanation: '' }]
    };
    const aiCtx = { ...AIContextEngine.getAIContext({ role: 'student', subject: 'science' }), rawUser: { id: 'student_1', teacherId: 'teacher_1' } };

    await AIExamGrader.gradeExamSubmission(mockExam, ['أ'], aiCtx, async () => '{}');

    const aiAlerts = NotificationService.getUserNotifications('student_1')
        .filter(n => n.type === NotificationService.NOTIFICATION_TYPES.AI_ALERT);
    check('AI grading alert sent to student', aiAlerts.length >= 1);

    const teacherAlerts = NotificationService.getUserNotifications('teacher_1')
        .filter(n => n.type === NotificationService.NOTIFICATION_TYPES.AI_ALERT);
    check('AI grading alert sent to teacher', teacherAlerts.length >= 1);

    // ── 8. Filter by Type ─────────────────────────────────────────────────────
    section('8. Filter Notifications by Type');
    const onlyExams = NotificationService.getUserNotifications('student_1', { type: 'exam' });
    check('Filter by type=exam works', onlyExams.every(n => n.type === 'exam'));

    const onlyUnread = NotificationService.getUserNotifications('student_1', { unreadOnly: true });
    check('unreadOnly filter works', onlyUnread.every(n => n.isRead === false));

    // ── 9. Mark All as Read ───────────────────────────────────────────────────
    section('9. Mark All as Read');
    NotificationService.markAllAsRead('student_1');
    check('All student_1 notifications are read', NotificationService.getUnreadCount('student_1') === 0);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════╗');
    if (process.exitCode === 1) {
        console.log('║  ❌  Some Tests FAILED — Check output above   ║');
    } else {
        console.log('║  ✅  All Notification System Tests Passed!     ║');
    }
    console.log('╚══════════════════════════════════════════════╝\n');
}

runTests().catch(err => { console.error('❌ Fatal:', err); process.exit(1); });
