/**
 * ============================================================
 *  Numi Platform — Notification Service
 *  File: src/services/NotificationService.js
 *
 *  Unified communication layer for Teachers, Admins & System.
 *  Supports direct, bulk, and scheduled notifications.
 *  Built with an in-memory event bus — WebSocket-upgrade-ready.
 * ============================================================
 */

// ─── 1. IN-MEMORY STORES ─────────────────────────────────────────────────────

const _notificationsDB = {};   // { notificationId: notification }
const _userInbox = {};         // { userId: [ notificationId, ... ] }
const _scheduledQueue = [];    // [ { notification, scheduledAt } ]
const _eventListeners = {};    // { eventName: [ callback ] }

// ─── 2. CONSTANTS ─────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES = {
    MESSAGE:  'message',
    REMINDER: 'reminder',
    SYSTEM:   'system',
    EXAM:     'exam',
    LESSON:   'lesson',
    GRADING:  'grading',
    MATERIAL: 'material',
    AI_ALERT: 'ai_alert'
};

const PRIORITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };

let _idCounter = 1;
function _genId() { return `notif_${Date.now()}_${_idCounter++}`; }

// ─── 3. CORE EVENT BUS ────────────────────────────────────────────────────────

/**
 * Registers a listener for an internal platform event.
 * @param {string} event - e.g. 'exam.created', 'grading.completed'
 * @param {Function} callback
 */
function on(event, callback) {
    if (!_eventListeners[event]) _eventListeners[event] = [];
    _eventListeners[event].push(callback);
}

/**
 * Emits an internal platform event with an optional payload.
 * @param {string} event
 * @param {Object} data
 */
function emit(event, data = {}) {
    const listeners = _eventListeners[event] || [];
    listeners.forEach(cb => {
        try { cb(data); } catch (e) {
            console.error(`[NotificationService] Event listener error on "${event}":`, e.message);
        }
    });
}

// ─── 4. NOTIFICATION FACTORY ─────────────────────────────────────────────────

function _createNotification({ type, title, body, senderId, targetUsers = [], organizationId = null,
                                scheduledAt = null, priority = PRIORITY.MEDIUM, metadata = {} }) {
    return {
        id: _genId(),
        type: type || NOTIFICATION_TYPES.SYSTEM,
        title,
        body,
        senderId: senderId || 'system',
        targetUsers,   // array of userIds
        organizationId,
        createdAt: new Date().toISOString(),
        scheduledAt,
        read: {},      // { userId: true/false }
        priority,
        metadata
    };
}

// ─── 5. DELIVERY ENGINE ───────────────────────────────────────────────────────

function _deliver(notification) {
    _notificationsDB[notification.id] = notification;

    notification.targetUsers.forEach(userId => {
        if (!_userInbox[userId]) _userInbox[userId] = [];
        _userInbox[userId].unshift(notification.id); // Newest first
        notification.read[userId] = false;
    });

    // Emit internal event for real-time listeners / future WebSocket layer
    emit('notification.delivered', { notification });
}

// ─── 6. PUBLIC API ────────────────────────────────────────────────────────────

/**
 * Send a notification to a specific list of user IDs.
 */
function sendNotification(targetUsers, payload) {
    if (!Array.isArray(targetUsers) || targetUsers.length === 0) return null;
    const notification = _createNotification({ ...payload, targetUsers });
    _deliver(notification);
    return notification;
}

/**
 * Send a notification to ALL users in an organization.
 * Requires OrganizationManager to be available.
 */
function sendBulkNotification(organizationId, payload) {
    const OrgMgr = (typeof OrganizationManager !== 'undefined') ? OrganizationManager : null;
    let targets = [];

    if (OrgMgr && OrgMgr._db[organizationId]) {
        const org = OrgMgr._db[organizationId];
        targets = [...(org.teachers || []), ...(org.students || [])];
    }

    if (targets.length === 0) {
        console.warn(`[NotificationService] No users found for org ${organizationId}. Using provided list.`);
        targets = payload.fallbackUsers || [];
    }

    const notification = _createNotification({
        ...payload,
        targetUsers: targets,
        organizationId
    });
    _deliver(notification);
    return notification;
}

/**
 * Schedules a notification for a future time.
 * Polling is done every 10s by startScheduler().
 */
function scheduleNotification(payload, datetime) {
    const scheduledAt = new Date(datetime).toISOString();
    const notification = _createNotification({ ...payload, scheduledAt });
    _scheduledQueue.push({ notification, scheduledAt });
    console.log(`[NotificationService] Scheduled "${payload.title}" for ${scheduledAt}`);
    return notification;
}

/**
 * Returns all notifications in a user's inbox, newest first.
 */
function getUserNotifications(userId, options = {}) {
    const { type = null, unreadOnly = false, limit = 50 } = options;
    const ids = _userInbox[userId] || [];

    return ids
        .map(id => _notificationsDB[id])
        .filter(n => {
            if (!n) return false;
            if (type && n.type !== type) return false;
            if (unreadOnly && n.read[userId] === true) return false;
            return true;
        })
        .slice(0, limit)
        .map(n => ({
            ...n,
            isRead: n.read[userId] === true,
            unreadCount: undefined  // Clean up internal field
        }));
}

/**
 * Marks a notification as read for a specific user.
 */
function markAsRead(notificationId, userId) {
    const n = _notificationsDB[notificationId];
    if (!n) throw new Error(`Notification "${notificationId}" not found.`);
    n.read[userId] = true;
    return true;
}

/**
 * Marks all notifications as read for a user.
 */
function markAllAsRead(userId) {
    (_userInbox[userId] || []).forEach(id => {
        if (_notificationsDB[id]) _notificationsDB[id].read[userId] = true;
    });
}

/**
 * Returns unread count for a user.
 */
function getUnreadCount(userId) {
    return (_userInbox[userId] || []).filter(id => {
        const n = _notificationsDB[id];
        return n && n.read[userId] === false;
    }).length;
}

// ─── 7. SCHEDULED NOTIFICATION POLLER ────────────────────────────────────────

let _schedulerInterval = null;

function startScheduler(intervalMs = 10000) {
    if (_schedulerInterval) return; // Already running
    _schedulerInterval = setInterval(() => {
        const now = new Date();
        const pending = _scheduledQueue.filter(item => new Date(item.scheduledAt) <= now);
        pending.forEach(item => {
            _deliver(item.notification);
            const idx = _scheduledQueue.indexOf(item);
            if (idx > -1) _scheduledQueue.splice(idx, 1);
            console.log(`[NotificationService] Delivered scheduled: "${item.notification.title}"`);
        });
    }, intervalMs);
}

function stopScheduler() {
    if (_schedulerInterval) { clearInterval(_schedulerInterval); _schedulerInterval = null; }
}

// ─── 8. AI-POWERED ALERT BUILDER ─────────────────────────────────────────────

/**
 * Builds and sends an AI-generated smart alert based on grading data.
 * Called by AIExamGrader when a student has weak topics.
 */
function sendAIAlert({ teacherId, studentId, weakTopics = [], subject, percentage }) {
    if (!teacherId && !studentId) return;

    const targets = [teacherId, studentId].filter(Boolean);
    const hasWeakTopics = weakTopics.length > 0;

    const title = hasWeakTopics
        ? `تنبيه ذكي: نقاط ضعف مكتشفة في ${subject}`
        : `تقرير أداء: ${subject}`;

    const body = hasWeakTopics
        ? `الطالب يحتاج مراجعة في: ${weakTopics.join('، ')}. النتيجة: ${percentage}%.`
        : `أداء الطالب في الاختبار: ${percentage}%.`;

    return sendNotification(targets, {
        type: NOTIFICATION_TYPES.AI_ALERT,
        title,
        body,
        senderId: 'ai_system',
        priority: percentage < 50 ? PRIORITY.HIGH : PRIORITY.MEDIUM,
        metadata: { weakTopics, subject, percentage }
    });
}

// ─── 9. EVENT HOOK PRESETS ────────────────────────────────────────────────────
// These are the named platform events other services can emit.

const EVENTS = {
    EXAM_CREATED:       'exam.created',
    GRADING_COMPLETED:  'grading.completed',
    LESSON_UPLOADED:    'lesson.uploaded',
    SESSION_SCHEDULED:  'session.scheduled',
    MATERIAL_UPLOADED:  'rag.material_uploaded'
};

// Register default handlers for each platform event
on(EVENTS.EXAM_CREATED, ({ teacherName, subject, targetStudents, organizationId }) => {
    sendBulkNotification(organizationId, {
        type: NOTIFICATION_TYPES.EXAM,
        title: `اختبار جديد في ${subject}`,
        body: `قام ${teacherName} بإنشاء اختبار جديد. استعد جيداً!`,
        senderId: 'system',
        priority: PRIORITY.HIGH,
        fallbackUsers: targetStudents || []
    });
});

on(EVENTS.GRADING_COMPLETED, ({ studentId, teacherId, subject, percentage, weakTopics }) => {
    sendAIAlert({ teacherId, studentId, weakTopics, subject, percentage });
});

on(EVENTS.MATERIAL_UPLOADED, ({ teacherName, subject, targetStudents, materialTitle, organizationId }) => {
    sendBulkNotification(organizationId, {
        type: NOTIFICATION_TYPES.MATERIAL,
        title: `محتوى تعليمي جديد: ${materialTitle}`,
        body: `أضاف ${teacherName} ملفاً جديداً في مادة ${subject}.`,
        senderId: 'system',
        priority: PRIORITY.MEDIUM,
        fallbackUsers: targetStudents || []
    });
});

on(EVENTS.SESSION_SCHEDULED, ({ teacherName, subject, sessionTime, targetStudents, organizationId }) => {
    sendBulkNotification(organizationId, {
        type: NOTIFICATION_TYPES.REMINDER,
        title: `جلسة مباشرة قادمة في ${subject}`,
        body: `المعلم ${teacherName} سيبدأ جلسة مباشرة في ${sessionTime}. لا تفوّت!`,
        senderId: 'system',
        priority: PRIORITY.HIGH,
        fallbackUsers: targetStudents || []
    });
});

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

const NotificationService = {
    // Core
    sendNotification,
    sendBulkNotification,
    scheduleNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    // Event Bus
    on,
    emit,
    EVENTS,
    NOTIFICATION_TYPES,
    PRIORITY,
    // AI Alerts
    sendAIAlert,
    // Scheduler
    startScheduler,
    stopScheduler,
    // Debug
    _getDB: () => ({ _notificationsDB, _userInbox, _scheduledQueue })
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationService;
}
if (typeof window !== 'undefined') {
    window.NotificationService = NotificationService;
}
