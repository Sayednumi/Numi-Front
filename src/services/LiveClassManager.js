/**
 * ============================================================
 *  Numi Platform — Live Class System
 *  File: src/services/LiveClassManager.js
 *
 *  Manages real-time interactive classes, combining Zoom-like
 *  session state, Kahoot-like polling, and AI tutoring.
 * ============================================================
 */

const TenantManager = (typeof window !== 'undefined' && window.TenantManager) ? window.TenantManager : require('./TenantManager');
const PermissionService = (typeof window !== 'undefined' && window.PermissionService) ? window.PermissionService : require('./PermissionService');
const NotificationService = (typeof window !== 'undefined' && window.NotificationService) ? window.NotificationService : require('./NotificationService');
const AIContextEngine = (typeof window !== 'undefined' && window.AIContextEngine) ? window.AIContextEngine : require('./AIContextEngine');
const AIChatIntegration = (typeof window !== 'undefined' && window.AIChatIntegration) ? window.AIChatIntegration : require('./AIChatIntegration');
const AIUsageTracker = (typeof window !== 'undefined' && window.AIUsageTracker) ? window.AIUsageTracker : require('./AIUsageTracker');

// In-Memory Data Store (Simulates Redis/DB)
const _sessions = {}; // { sessionId: SessionObject }
const _chatHistory = {}; // { sessionId: [Messages] }
const _polls = {}; // { sessionId: [Polls] }
const _recordings = {}; // { sessionId: RecordingData }

class LiveClassManager {
    
    // ─── 1. SESSION MANAGEMENT ────────────────────────────────────────────────

    static createSession(teacher, title, subject, scheduledAt) {
        PermissionService.assertOrgAccess(teacher, teacher.organizationId, 'manage_live');

        const sessionId = `live_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        const session = {
            id: sessionId,
            title,
            subject,
            teacherId: teacher.id,
            organizationId: teacher.organizationId,
            status: 'scheduled', // scheduled, active, ended
            scheduledAt,
            startedAt: null,
            endedAt: null,
            attendees: new Set(),
            aiModeEnabled: false,
            analytics: {
                maxConcurrent: 0,
                totalMessages: 0,
                pollsLaunched: 0,
                aiRequests: 0
            }
        };

        _sessions[sessionId] = session;
        _chatHistory[sessionId] = [];
        _polls[sessionId] = [];

        // Notify students in the organization
        NotificationService.sendBulkNotification(teacher.organizationId, {
            type: 'lesson',
            title: `حصة مباشرة جديدة: ${title}`,
            body: `جدول المعلم حصة مباشرة في مادة ${subject}.`,
            senderId: teacher.id,
            priority: 'high'
        });

        return session;
    }

    static startSession(teacher, sessionId) {
        const session = _sessions[sessionId];
        if (!session) throw new Error("Session not found");
        if (session.teacherId !== teacher.id) throw new Error("Only the host can start this session");

        session.status = 'active';
        session.startedAt = new Date().toISOString();

        NotificationService.sendBulkNotification(teacher.organizationId, {
            type: 'lesson',
            title: `بدأت الحصة: ${session.title}`,
            body: `انضم الآن للحصة المباشرة مع المعلم.`,
            senderId: teacher.id,
            priority: 'high'
        });

        return session;
    }

    static endSession(teacher, sessionId) {
        const session = _sessions[sessionId];
        if (!session || session.status !== 'active') throw new Error("Session not active");
        if (session.teacherId !== teacher.id) throw new Error("Only the host can end this session");

        session.status = 'ended';
        session.endedAt = new Date().toISOString();

        // Generate Recording Mock
        _recordings[sessionId] = {
            videoUrl: `https://storage.numi.education/recordings/${sessionId}.mp4`,
            chatLog: _chatHistory[sessionId],
            pollsLog: _polls[sessionId],
            analytics: session.analytics
        };

        // Notify summary
        NotificationService.sendBulkNotification(teacher.organizationId, {
            type: 'system',
            title: `ملخص الحصة: ${session.title}`,
            body: `انتهت الحصة. تم تسجيل ${session.attendees.size} حضور. التسجيل متاح الآن.`,
            senderId: 'system',
            priority: 'low'
        });

        return _recordings[sessionId];
    }

    // ─── 2. STUDENT JOIN SYSTEM ───────────────────────────────────────────────

    static joinSession(user, sessionId) {
        const session = _sessions[sessionId];
        if (!session) throw new Error("Session not found");
        if (session.status !== 'active') throw new Error("Session is not currently active");
        
        // Tenant Guard: Block students from other schools
        TenantManager.assertSameOrg(user.id, session.organizationId);

        session.attendees.add(user.id);
        if (session.attendees.size > session.analytics.maxConcurrent) {
            session.analytics.maxConcurrent = session.attendees.size;
        }

        return { sessionInfo: session, chatHistory: _chatHistory[sessionId] };
    }

    // ─── 3. REAL-TIME CHAT & AI ───────────────────────────────────────────────

    static async sendChatMessage(user, sessionId, messageText, mockAICall = null) {
        const session = _sessions[sessionId];
        if (!session || session.status !== 'active') throw new Error("Session not active");
        TenantManager.assertSameOrg(user.id, session.organizationId);

        const msg = {
            id: `msg_${Date.now()}`,
            senderId: user.id,
            senderName: user.fullName || user.id,
            role: user.role,
            text: messageText,
            timestamp: new Date().toISOString()
        };

        _chatHistory[sessionId].push(msg);
        session.analytics.totalMessages++;

        // If AI Teacher Mode is ON and a student asked a question, the AI answers automatically
        if (session.aiModeEnabled && user.role === PermissionService.ROLES.STUDENT && messageText.includes('؟')) {
            await this._triggerAIAssistant(session, user, messageText, mockAICall);
        }

        return msg;
    }

    // ─── 4. INTERACTIVE TEACHING TOOLS (POLLS) ───────────────────────────────

    static launchPoll(teacher, sessionId, question, options) {
        const session = _sessions[sessionId];
        if (!session || session.status !== 'active') throw new Error("Session not active");
        if (session.teacherId !== teacher.id) throw new Error("Only the host can launch polls");

        const poll = {
            id: `poll_${Date.now()}`,
            question,
            options,
            answers: {}, // { studentId: optionIndex }
            launchedAt: new Date().toISOString()
        };

        _polls[sessionId].push(poll);
        session.analytics.pollsLaunched++;

        // Send poll as a chat message for UI binding
        _chatHistory[sessionId].push({
            id: `msg_poll_${poll.id}`,
            senderId: 'system',
            senderName: 'أداة التقييم',
            role: 'system',
            isPoll: true,
            pollData: poll,
            timestamp: new Date().toISOString()
        });

        return poll;
    }

    static submitPollAnswer(student, sessionId, pollId, optionIndex) {
        const session = _sessions[sessionId];
        if (!session || session.status !== 'active') throw new Error("Session not active");
        TenantManager.assertSameOrg(student.id, session.organizationId);

        const poll = _polls[sessionId].find(p => p.id === pollId);
        if (!poll) throw new Error("Poll not found");

        poll.answers[student.id] = optionIndex;
        return poll;
    }

    // ─── 5. AI LIVE TEACHER MODE ──────────────────────────────────────────────

    static toggleAITeacherMode(teacher, sessionId, enabled) {
        const session = _sessions[sessionId];
        if (!session) throw new Error("Session not found");
        if (session.teacherId !== teacher.id) throw new Error("Unauthorized");

        session.aiModeEnabled = enabled;
        return session.aiModeEnabled;
    }

    static async _triggerAIAssistant(session, student, question, mockAICall) {
        session.analytics.aiRequests++;
        
        // 1. Build context using the host teacher's profile
        const aiCtx = AIContextEngine.getAIContext({ 
            id: session.teacherId, 
            role: 'teacher', 
            organizationId: session.organizationId 
        });

        // 2. Add live class specifics to context without mutating frozen object
        const fullPrompt = `[سياق الحصة المباشرة: ${session.title} - مادة ${session.subject}]\n` +
                           `[سؤال الطالب]: ${question}\n` +
                           `[ملاحظة للمساعد]: أجب كأنك المعلم بناءً على محتوى الحصة.`;

        // 3. Process via AIChatIntegration
        // Injecting mockAICall for testing, otherwise it uses real API
        const aiResponse = await AIChatIntegration.processAIRequest(
            { id: student.id, role: 'student', organizationId: session.organizationId }, 
            fullPrompt, 
            mockAICall || (async () => "هذه إجابة تفاعلية من الذكاء الاصطناعي بناءً على محتوى الحصة.")
        );

        // 4. Send AI response to chat
        const aiMsg = {
            id: `msg_ai_${Date.now()}`,
            senderId: 'ai_tutor',
            senderName: 'المساعد الذكي (AI)',
            role: 'system',
            text: aiResponse,
            isAI: true,
            timestamp: new Date().toISOString()
        };

        _chatHistory[session.id].push(aiMsg);
        session.analytics.totalMessages++;
    }

    // ─── 6. ANALYTICS & EXPORTS ──────────────────────────────────────────────

    static getSessionAnalytics(teacher, sessionId) {
        const session = _sessions[sessionId];
        if (!session) throw new Error("Session not found");
        TenantManager.assertSameOrg(teacher.id, session.organizationId);

        return {
            title: session.title,
            status: session.status,
            attendeesCount: session.attendees.size,
            maxConcurrent: session.analytics.maxConcurrent,
            messagesCount: session.analytics.totalMessages,
            pollsLaunched: session.analytics.pollsLaunched,
            aiInterventions: session.analytics.aiRequests,
            recording: _recordings[sessionId] || null
        };
    }
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveClassManager;
}
if (typeof window !== 'undefined') {
    window.LiveClassManager = LiveClassManager;
}
