/**
 * ============================================================
 *  Numi Platform — Full System Audit Engine
 *  File: src/services/SystemAuditEngine.js
 *
 *  Static Analysis tool that scans Frontend, Backend, Permissions,
 *  and AI modules to detect dead UI, unused routes, missing guards,
 *  and architectural violations. Transforms Numi into a self-healing SaaS.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

// ─── 1. FILE SYSTEM HELPER ───────────────────────────────────────────────────

function walkDir(dir, filterExt = []) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(filePath, filterExt));
        } else {
            const ext = path.extname(filePath);
            if (filterExt.length === 0 || filterExt.includes(ext)) {
                results.push(filePath);
            }
        }
    });
    return results;
}

// ─── 2. AUDIT RUNNER ──────────────────────────────────────────────────────────

class SystemAuditEngine {
    constructor(projectRoot) {
        this.projectRoot = projectRoot || path.resolve(__dirname, '../../');
        this.report = {
            timestamp: new Date().toISOString(),
            readinessScore: 100,
            summary: { frontend: 0, backend: 0, permissions: 0, ai: 0 },
            issues: []
        };
    }

    _addIssue(category, type, message, file, autoFixable = false, fixAction = null) {
        this.report.issues.push({ category, type, message, file, autoFixable, fixAction });
        this.report.summary[category]++;
        this.report.readinessScore = Math.max(0, this.report.readinessScore - 2);
    }

    // ── 3. FRONTEND AUDIT (HTML/JS) ──────────────────────────────────────────
    auditFrontend() {
        const htmlFiles = walkDir(path.join(this.projectRoot, 'public'), ['.html'])
            .concat(walkDir(this.projectRoot, ['.html']).filter(f => !f.includes('node_modules')));
        
        const jsFiles = walkDir(path.join(this.projectRoot, 'src'), ['.js'])
            .concat(walkDir(path.join(this.projectRoot, 'public'), ['.js']));

        // Extract all defined JS functions using simple regex
        const definedFunctions = new Set();
        jsFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            const matches = content.match(/function\s+([a-zA-Z0-9_]+)\s*\(/g);
            if (matches) {
                matches.forEach(m => definedFunctions.add(m.replace(/function\s+/, '').replace(/\s*\(/, '')));
            }
            // Also arrow functions attached to window: window.funcName = () => ...
            const windowMatches = content.match(/window\.([a-zA-Z0-9_]+)\s*=/g);
            if (windowMatches) {
                windowMatches.forEach(m => definedFunctions.add(m.replace('window.', '').replace(/\s*=/, '')));
            }
        });

        // Scan HTML files
        htmlFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            const shortName = path.basename(file);

            // 1. Check onclick attributes
            const onclickMatches = content.matchAll(/onclick="([a-zA-Z0-9_]+)\(/g);
            for (const match of onclickMatches) {
                const funcName = match[1];
                if (!definedFunctions.has(funcName)) {
                    this._addIssue('frontend', 'DEAD_UI', `onclick="${funcName}()" is missing JS definition`, shortName);
                }
            }

            // 2. Check Modals without triggers
            const modalMatches = content.matchAll(/id="(modal_[a-zA-Z0-9_]+)"/g);
            for (const match of modalMatches) {
                const modalId = match[1];
                if (!content.includes(`'${modalId}'`) && !content.includes(`"${modalId}"`) && !content.includes(`toggleModal`)) {
                    this._addIssue('frontend', 'ORPHAN_MODAL', `Modal '${modalId}' has no trigger mechanism.`, shortName);
                }
            }
        });
    }

    // ── 4. BACKEND AUDIT (API/Services) ──────────────────────────────────────
    auditBackend() {
        const apiFiles = walkDir(path.join(this.projectRoot, 'src/api'), ['.js']);
        const serverFile = path.join(this.projectRoot, 'backend/server.js');
        
        let serverContent = '';
        if (fs.existsSync(serverFile)) serverContent = fs.readFileSync(serverFile, 'utf8');

        apiFiles.forEach(file => {
            const shortName = path.basename(file);
            const content = fs.readFileSync(file, 'utf8');

            // 1. Check exported routes
            const exportsMatch = content.match(/module\.exports\s*=\s*{([^}]+)}/);
            if (exportsMatch) {
                const exportedFunctions = exportsMatch[1].split(',').map(s => s.trim().split(':')[0]);
                exportedFunctions.forEach(func => {
                    if (func && !serverContent.includes(func) && !serverContent.includes(shortName)) {
                        this._addIssue('backend', 'UNUSED_ROUTE', `Route handler '${func}' is exported but not mounted in server.js`, shortName);
                    }
                });
            }
        });
    }

    // ── 5. PERMISSION AUDIT ──────────────────────────────────────────────────
    auditPermissions() {
        const permFile = path.join(this.projectRoot, 'src/services/PermissionService.js');
        if (!fs.existsSync(permFile)) return;

        const permContent = fs.readFileSync(permFile, 'utf8');
        const permsMatch = permContent.match(/const PERMISSIONS = Object\.freeze\({([^}]+)}\);/);
        
        if (!permsMatch) return;
        
        // Extract all defined permissions
        const keys = permsMatch[1].match(/[A-Z_]+:/g).map(k => k.replace(':', '').trim());
        
        // Scan all UI components and API routes to see if they are actually used
        const allCodeFiles = walkDir(path.join(this.projectRoot, 'src/components'), ['.js'])
            .concat(walkDir(path.join(this.projectRoot, 'src/api'), ['.js']));
        
        let allCode = '';
        allCodeFiles.forEach(f => allCode += fs.readFileSync(f, 'utf8'));

        keys.forEach(permKey => {
            if (!allCode.includes(permKey) && !permContent.includes(permKey)) {
                this._addIssue('permissions', 'ORPHAN_PERMISSION', `Permission '${permKey}' is defined but never enforced in code.`, 'PermissionService.js', true, `REMOVE_PERM:${permKey}`);
            }
        });
    }

    // ── 6. AI SYSTEM AUDIT ───────────────────────────────────────────────────
    auditAISystem() {
        const aiFiles = [
            'src/services/AIChatIntegration.js',
            'src/services/AIExamGenerator.js',
            'src/services/AIExamGrader.js',
            'src/services/RAGEngine.js'
        ];

        aiFiles.forEach(relPath => {
            const file = path.join(this.projectRoot, relPath);
            if (!fs.existsSync(file)) return;
            const content = fs.readFileSync(file, 'utf8');

            const shortName = path.basename(file);

            // AI MUST use AIContextEngine
            if (!content.includes('AIContextEngine') && shortName !== 'RAGEngine.js') {
                this._addIssue('ai', 'AI_BYPASS', `AI Service bypasses AIContextEngine! Risk of hallucinations.`, shortName);
            }

            // AI MUST log usage
            if (!content.includes('AIUsageTracker') && !content.includes('_AIUsage')) {
                this._addIssue('ai', 'USAGE_LEAK', `AI Service does not report token usage to AIUsageTracker.`, shortName);
            }
        });
    }

    // ── 7. RUN ───────────────────────────────────────────────────────────────
    runAll() {
        this.report.issues = [];
        this.report.summary = { frontend: 0, backend: 0, permissions: 0, ai: 0 };
        this.report.readinessScore = 100;

        console.log('[SystemAuditEngine] 🔍 Scanning Frontend Architecture...');
        this.auditFrontend();
        console.log('[SystemAuditEngine] 🔍 Scanning Backend Routes...');
        this.auditBackend();
        console.log('[SystemAuditEngine] 🔍 Scanning Permission Maps...');
        this.auditPermissions();
        console.log('[SystemAuditEngine] 🔍 Scanning AI Security & Contexts...');
        this.auditAISystem();

        console.log(`[SystemAuditEngine] ✅ Audit Complete. Score: ${this.report.readinessScore}%`);
        return this.report;
    }

    // ── 8. AUTO-FIX ──────────────────────────────────────────────────────────
    applyAutoFixes() {
        let fixesApplied = 0;
        this.report.issues.forEach(issue => {
            if (issue.autoFixable && issue.fixAction) {
                // Example fix: Remove orphaned permission
                if (issue.fixAction.startsWith('REMOVE_PERM:')) {
                    const permKey = issue.fixAction.split(':')[1];
                    const permFile = path.join(this.projectRoot, 'src/services/PermissionService.js');
                    let content = fs.readFileSync(permFile, 'utf8');
                    // Simple regex to strip it (MVP)
                    const regex = new RegExp(`\\s*${permKey}:\\s*['"][a-z_]+['"],?`, 'g');
                    content = content.replace(regex, '');
                    fs.writeFileSync(permFile, content, 'utf8');
                    fixesApplied++;
                }
            }
        });
        return fixesApplied;
    }
}

module.exports = SystemAuditEngine;
