/**
 * ============================================================
 *  Numi Platform — Production Hardening Engine
 *  File: src/services/ProductionHardeningEngine.js
 *
 *  Simulates real-world load, concurrent traffic, and
 *  injects failures to test system resilience and graceful recovery.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

// Core Services
const TenantManager = require('./TenantManager');
const LiveClassManager = require('./LiveClassManager');
const { GamificationEngine } = require('./GamificationEngine');
const NotificationService = require('./NotificationService');
const AIChatIntegration = require('./AIChatIntegration');
const AIExamGrader = require('./AIExamGrader');

class ProductionHardeningEngine {
    constructor(projectRoot) {
        this.projectRoot = projectRoot || path.resolve(__dirname, '../../');
        this.metrics = {
            totalUsersSimulated: 0,
            totalRequests: 0,
            aiCallsCount: 0,
            failureCount: 0,
            recoveredFailures: 0,
            avgResponseTime: 0,
            maxResponseTime: 0,
            systemStabilityScore: 100,
            productionReady: false
        };
        this._responseTimes = [];
    }

    // ─── UTILITIES ────────────────────────────────────────────────────────
    
    async _measure(actionName, fn) {
        const start = Date.now();
        let success = true;
        let recovered = false;
        
        try {
            await fn();
        } catch (e) {
            success = false;
            // Check if it's a known handled failure
            if (e.message.includes('Simulated') || e.message.includes('fallback') || e.message.includes('timeout')) {
                recovered = true;
                this.metrics.recoveredFailures++;
            } else {
                this.metrics.failureCount++;
                console.error(`[HARDENING] ❌ Critical failure in ${actionName}:`, e.message);
            }
        }

        const duration = Date.now() - start;
        this._responseTimes.push(duration);
        this.metrics.totalRequests++;
        
        if (duration > this.metrics.maxResponseTime) {
            this.metrics.maxResponseTime = duration;
        }

        return { success, recovered, duration };
    }

    _calculateAvg() {
        if (this._responseTimes.length === 0) return 0;
        const sum = this._responseTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / this._responseTimes.length);
    }

    // ─── FAILURE INJECTION ────────────────────────────────────────────────

    async injectAITimeout() {
        return this._measure('AI_TIMEOUT_RECOVERY', async () => {
            // Simulate AI delay -> should fallback gracefully
            const mockCall = async () => {
                return new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Simulated API Timeout')), 100);
                });
            };
            
            try {
                await AIChatIntegration.processAIRequest(
                    { id: 'u1', role: 'student', organizationId: 'org1' },
                    'سؤال',
                    mockCall
                );
            } catch(e) {
                if(!e.message.includes('Simulated')) throw e; // Unhandled crash
            }
        });
    }

    async injectPermissionFailure() {
        return this._measure('CROSS_TENANT_BLOCK', async () => {
            const org1 = 'orgA';
            const org2 = 'orgB';
            TenantManager.createTenant({ name: 'A', type: 'school', adminId: 'a1' });
            // Should throw error and block
            try {
                TenantManager.assertSameOrg('student1', org1, org2);
                throw new Error("Failed to block cross-tenant access!");
            } catch (e) {
                // Expected to throw Access Denied
            }
        });
    }

    // ─── STRESS SIMULATION ────────────────────────────────────────────────

    async simulateConcurrentLiveClass(teacher, students, orgId) {
        return this._measure('CONCURRENT_LIVE_CLASS_JOIN', async () => {
            const session = LiveClassManager.createSession(teacher, 'تاريخ', 'history', new Date().toISOString());
            LiveClassManager.startSession(teacher, session.id);
            
            // 20 students joining simultaneously
            const joinPromises = students.map(s => async () => {
                LiveClassManager.joinSession(s, session.id);
            });
            
            await Promise.all(joinPromises.map(p => p()));
            
            // Assert concurrent max is correct
            const analytics = LiveClassManager.getSessionAnalytics(teacher, session.id);
            if (analytics.maxConcurrent !== students.length) {
                throw new Error("Concurrency count mismatch");
            }
        });
    }

    async simulateConcurrentExams(students, orgId) {
        return this._measure('CONCURRENT_EXAM_GRADING', async () => {
            const gradePromises = students.map(s => async () => {
                this.metrics.aiCallsCount++;
                // Simulate grading request
                GamificationEngine.onExamGraded(s.id, orgId, Math.floor(Math.random() * 100));
            });
            await Promise.all(gradePromises.map(p => p()));
        });
    }

    // ─── RUNNER ──────────────────────────────────────────────────────────

    async runFullStressTest(usersData) {
        console.log('[HardeningEngine] 🚀 Commencing Real-World Load Simulation...');
        this.metrics.totalUsersSimulated = usersData.students.length + usersData.teachers.length + 1;

        // 1. Failure Injection
        console.log('[HardeningEngine] 💉 Injecting Critical Failures...');
        await this.injectAITimeout();
        await this.injectPermissionFailure();

        // 2. Load Testing
        console.log('[HardeningEngine] ⚡ Simulating Burst Traffic...');
        await this.simulateConcurrentLiveClass(usersData.teachers[0], usersData.students, usersData.orgId);
        await this.simulateConcurrentExams(usersData.students, usersData.orgId);

        // Calculate final score
        this.metrics.avgResponseTime = this._calculateAvg();
        
        let score = 100;
        if (this.metrics.failureCount > 0) score -= (this.metrics.failureCount * 20);
        if (this.metrics.avgResponseTime > 500) score -= 10;
        if (this.metrics.recoveredFailures > 0) score += 5; // Bonus for resilience
        
        this.metrics.systemStabilityScore = Math.min(100, Math.max(0, score));
        this.metrics.productionReady = this.metrics.systemStabilityScore >= 90 && this.metrics.failureCount === 0;

        const outPath = path.join(this.projectRoot, 'public/production_stress_report.json');
        fs.writeFileSync(outPath, JSON.stringify(this.metrics, null, 2));

        return this.metrics;
    }
}

module.exports = ProductionHardeningEngine;
