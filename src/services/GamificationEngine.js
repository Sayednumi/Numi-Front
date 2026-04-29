/**
 * ============================================================
 *  Numi Platform — Gamification 2.0 Engine
 *  File: src/services/GamificationEngine.js
 *
 *  Core engine for XP, Leveling, Streaks, Leaderboards, Badges,
 *  and AI-driven challenges.
 * ============================================================
 */

const NotificationService = (typeof window !== 'undefined' && window.NotificationService) ? window.NotificationService : require('./NotificationService');

// Simulated DB for Gamification State
const _players = {}; // { studentId: PlayerData }
const _leaderboards = {}; // { orgId: [studentIds] }

const LEVEL_THRESHOLDS = [
    { level: 1, name: 'مبتدئ', xpRequired: 0 },
    { level: 2, name: 'متدرب', xpRequired: 100 },
    { level: 3, name: 'مجتهد', xpRequired: 300 },
    { level: 4, name: 'خبير', xpRequired: 700 },
    { level: 5, name: 'مُعلم صغير', xpRequired: 1500 },
    { level: 6, name: 'أسطورة', xpRequired: 3000 }
];

const BADGES = {
    FIRST_BLOOD: { id: 'first_blood', name: 'أول إنجاز', icon: '🏆' },
    PERFECT_SCORE: { id: 'perfect_score', name: 'العلامة الكاملة', icon: '⭐' },
    STREAK_7: { id: 'streak_7', name: 'مستمر لـ 7 أيام', icon: '🔥' },
    CHAT_ACTIVE: { id: 'chat_active', name: 'شعلة نشاط', icon: '💬' },
    AI_MASTER: { id: 'ai_master', name: 'محلل ذكي', icon: '🤖' }
};

class GamificationEngine {

    // ─── 1. PLAYER INITIALIZATION ──────────────────────────────────────────

    static _getOrCreatePlayer(studentId, orgId) {
        if (!_players[studentId]) {
            _players[studentId] = {
                id: studentId,
                orgId: orgId,
                xp: 0,
                level: 1,
                rankName: 'مبتدئ',
                streak: 0,
                lastActiveDate: null,
                badges: [],
                stats: {
                    examsPassed: 0,
                    liveClassesAttended: 0,
                    pollsAnswered: 0,
                    aiUsage: 0
                },
                challenges: [] // Daily/Weekly active challenges
            };
        }
        return _players[studentId];
    }

    // ─── 2. XP & LEVEL SYSTEM ──────────────────────────────────────────────

    static awardXP(studentId, orgId, amount, reason) {
        const player = this._getOrCreatePlayer(studentId, orgId);
        player.xp += amount;
        
        // Check for Level Up
        let newLevel = player.level;
        let newRank = player.rankName;

        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
            if (player.xp >= LEVEL_THRESHOLDS[i].xpRequired) {
                newLevel = LEVEL_THRESHOLDS[i].level;
                newRank = LEVEL_THRESHOLDS[i].name;
                break;
            }
        }

        if (newLevel > player.level) {
            player.level = newLevel;
            player.rankName = newRank;

            NotificationService.sendNotification([studentId], {
                type: 'system',
                title: '🎉 ارتقاء في المستوى!',
                body: `لقد وصلت للمستوى ${newLevel} (${newRank})! أحسنت العمل.`,
                senderId: 'gamification_engine',
                priority: 'high'
            });
        }

        // Update org leaderboard
        this._updateLeaderboard(orgId);

        return { xpAdded: amount, totalXp: player.xp, level: player.level, reason };
    }

    // ─── 3. EVENT HOOKS (Triggered from other services) ────────────────────

    static onLiveClassJoined(studentId, orgId) {
        const player = this._getOrCreatePlayer(studentId, orgId);
        player.stats.liveClassesAttended++;
        return this.awardXP(studentId, orgId, 20, 'حضور حصة مباشرة');
    }

    static onExamGraded(studentId, orgId, scorePercentage) {
        const player = this._getOrCreatePlayer(studentId, orgId);
        player.stats.examsPassed++;
        
        let xp = 10; // base
        if (scorePercentage >= 90) xp += 40;
        else if (scorePercentage >= 70) xp += 20;

        if (scorePercentage === 100) {
            this.awardBadge(studentId, orgId, BADGES.PERFECT_SCORE);
        }

        return this.awardXP(studentId, orgId, xp, 'حل اختبار');
    }

    static onPollAnswered(studentId, orgId) {
        const player = this._getOrCreatePlayer(studentId, orgId);
        player.stats.pollsAnswered++;
        return this.awardXP(studentId, orgId, 5, 'الإجابة على سؤال تفاعلي');
    }

    static onAIUsage(studentId, orgId) {
        const player = this._getOrCreatePlayer(studentId, orgId);
        player.stats.aiUsage++;
        
        if (player.stats.aiUsage === 10) {
            this.awardBadge(studentId, orgId, BADGES.AI_MASTER);
        }
        
        return this.awardXP(studentId, orgId, 2, 'استخدام تعليمي للذكاء الاصطناعي');
    }

    // ─── 4. DAILY STREAK SYSTEM ────────────────────────────────────────────

    static updateDailyStreak(studentId, orgId) {
        const player = this._getOrCreatePlayer(studentId, orgId);
        const today = new Date().toDateString();
        
        if (player.lastActiveDate === today) {
            return player.streak; // Already logged today
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (player.lastActiveDate === yesterday.toDateString()) {
            player.streak++;
        } else {
            player.streak = 1; // Reset streak
        }

        player.lastActiveDate = today;

        // Streak rewards
        if (player.streak === 3) this.awardXP(studentId, orgId, 30, 'Streak x3');
        if (player.streak === 7) {
            this.awardXP(studentId, orgId, 100, 'Streak x7');
            this.awardBadge(studentId, orgId, BADGES.STREAK_7);
        }

        return player.streak;
    }

    // ─── 5. BADGE SYSTEM ───────────────────────────────────────────────────

    static awardBadge(studentId, orgId, badgeConfig) {
        const player = this._getOrCreatePlayer(studentId, orgId);
        
        const hasBadge = player.badges.some(b => b.id === badgeConfig.id);
        if (hasBadge) return false;

        player.badges.push({ ...badgeConfig, awardedAt: new Date().toISOString() });

        NotificationService.sendNotification([studentId], {
            type: 'system',
            title: `🏅 شارة جديدة: ${badgeConfig.name} ${badgeConfig.icon}`,
            body: `تهانينا! لقد حصلت على شارة إنجاز جديدة.`,
            senderId: 'gamification_engine',
            priority: 'high'
        });

        return true;
    }

    // ─── 6. LEADERBOARDS ───────────────────────────────────────────────────

    static _updateLeaderboard(orgId) {
        // Collect all players in this org
        const playersInOrg = Object.values(_players).filter(p => p.orgId === orgId);
        // Sort by XP descending
        playersInOrg.sort((a, b) => b.xp - a.xp);
        
        _leaderboards[orgId] = playersInOrg.map(p => ({
            id: p.id,
            xp: p.xp,
            level: p.level,
            rankName: p.rankName
        }));
    }

    static getLeaderboard(orgId, topN = 10) {
        if (!_leaderboards[orgId]) this._updateLeaderboard(orgId);
        return _leaderboards[orgId].slice(0, topN);
    }

    // ─── 7. AI CHALLENGE GENERATOR ─────────────────────────────────────────

    static generateAIChallenges(studentId, orgId, weakTopics = []) {
        const player = this._getOrCreatePlayer(studentId, orgId);
        
        // Based on weak topics provided by AIExamGrader
        const generated = [];
        
        if (weakTopics.length > 0) {
            generated.push({
                id: `chal_ai_${Date.now()}`,
                title: `تحدي التحسين: ${weakTopics[0]}`,
                description: `احصل على 80% في اختبار مخصص عن موضوع ${weakTopics[0]}`,
                rewardXp: 150,
                isCompleted: false
            });
        }

        // Generic daily challenges
        generated.push({
            id: `chal_daily_1`,
            title: `المشاركة الفعالة`,
            description: `أجب على 3 استبيانات (Polls) داخل الحصص المباشرة اليوم`,
            rewardXp: 50,
            isCompleted: false
        });

        player.challenges = generated;
        return player.challenges;
    }

    // ─── EXPORTS ──────────────────────────────────────────────────────────

    static getPlayerProfile(studentId) {
        return _players[studentId] || null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GamificationEngine, BADGES, LEVEL_THRESHOLDS };
}
if (typeof window !== 'undefined') {
    window.GamificationEngine = GamificationEngine;
}
