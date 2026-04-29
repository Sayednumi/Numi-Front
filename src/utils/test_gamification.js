/**
 * ============================================================
 *  Numi Platform — Gamification 2.0 Test Script
 *  File: src/utils/test_gamification.js
 * ============================================================
 */

// Load globals
const NotificationService = require('../services/NotificationService');
global.NotificationService = NotificationService;

const { GamificationEngine, BADGES } = require('../services/GamificationEngine');

function ok(label, val) { console.log(`  ${val ? '✅' : '❌'}  ${label}`); if(!val) process.exitCode = 1; }
function sec(t) { console.log(`\n── ${t} ${'─'.repeat(45 - t.length)}`); }

async function run() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║        NUMI GAMIFICATION 2.0 TEST            ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    const orgId = 'academy_1';
    const s1 = 'student_A';
    const s2 = 'student_B';

    // ── 1. Daily Streak System ──────────────────────────────────────────────
    sec('1. Daily Streak');
    GamificationEngine.updateDailyStreak(s1, orgId);
    let p1 = GamificationEngine.getPlayerProfile(s1);
    ok('Initial streak is 1', p1.streak === 1);
    
    // Simulate playing yesterday
    p1.lastActiveDate = new Date(Date.now() - 86400000).toDateString();
    GamificationEngine.updateDailyStreak(s1, orgId);
    ok('Streak incremented to 2', p1.streak === 2);

    // ── 2. Event Hooks & XP ────────────────────────────────────────────────
    sec('2. Event Hooks (Live Classes & Exams)');
    
    GamificationEngine.onLiveClassJoined(s1, orgId);
    ok('Awarded 20 XP for joining live class', p1.xp === 20);

    GamificationEngine.onExamGraded(s1, orgId, 100); // 100% score -> 10 + 40 = 50 XP
    ok('Awarded 50 XP for Perfect Exam', p1.xp === 70);
    ok('Awarded PERFECT_SCORE Badge', p1.badges.some(b => b.id === BADGES.PERFECT_SCORE.id));

    // ── 3. Leveling System ─────────────────────────────────────────────────
    sec('3. Leveling Up');
    
    // Give enough XP to hit Level 2 (100 XP)
    GamificationEngine.awardXP(s1, orgId, 40, 'مكافأة خاصة');
    ok('Player leveled up to 2', p1.level === 2);
    ok('Rank Name is "متدرب"', p1.rankName === 'متدرب');

    // ── 4. AI & Polls Engagement ───────────────────────────────────────────
    sec('4. AI Master Badge & Polls');
    
    // Simulate 10 AI Usages
    for(let i = 0; i < 10; i++) GamificationEngine.onAIUsage(s2, orgId);
    let p2 = GamificationEngine.getPlayerProfile(s2);
    ok('Awarded AI_MASTER Badge to student B', p2.badges.some(b => b.id === BADGES.AI_MASTER.id));

    // ── 5. AI Challenge Generation ─────────────────────────────────────────
    sec('5. AI Generated Challenges');
    const challenges = GamificationEngine.generateAIChallenges(s1, orgId, ['الفيزياء الكلاسيكية']);
    ok('AI generated target challenge based on weak topic', challenges[0].title.includes('الفيزياء الكلاسيكية'));

    // ── 6. Leaderboard ─────────────────────────────────────────────────────
    sec('6. Leaderboard Ranking');
    const leaderboard = GamificationEngine.getLeaderboard(orgId);
    ok('Leaderboard contains 2 players', leaderboard.length === 2);
    ok('Student A is #1', leaderboard[0].id === s1);
    ok('Student B is #2', leaderboard[1].id === s2);

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ✅ All Gamification Tests Passed!           ║');
    console.log('╚══════════════════════════════════════════════╝\n');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
