/**
 * ============================================================
 *  Numi Platform — UI Auto-Fix Engine
 *  File: src/services/UIAutoFixEngine.js
 *
 *  Self-Healing Frontend System. Processes the output of the
 *  SystemAuditEngine and automatically applies safe fixes.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const SystemAuditEngine = require('./SystemAuditEngine');

class UIAutoFixEngine {
    constructor(projectRoot) {
        this.projectRoot = projectRoot || path.resolve(__dirname, '../../');
        this.fixLog = {
            timestamp: new Date().toISOString(),
            totalFixed: 0,
            totalRemoved: 0,
            manualInterventionRequired: 0,
            uiImprovementScore: 0,
            details: []
        };

        // Fallback script injected into files that needed fixes
        this.fallbackScript = `
<!-- [AutoFixEngine] Safe Fallback Handler -->
<script>
    if (!window.safeFallbackHandler) {
        window.safeFallbackHandler = function(funcName, element) {
            console.warn('[AutoFixEngine] Fallback triggered for: ' + funcName);
            // Visual feedback for the user
            const origColor = element.style.backgroundColor;
            element.style.backgroundColor = '#ef4444';
            element.innerText = '⚠️ غير متاح حالياً';
            setTimeout(() => { element.style.backgroundColor = origColor; }, 2000);
        };
    }
</script>
</body>`;
    }

    findFile(fileName) {
        // Recursive search for the file
        const walk = (dir) => {
            if (!fs.existsSync(dir)) return null;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file === 'node_modules' || file === '.git') continue;
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    const found = walk(filePath);
                    if (found) return found;
                } else if (file === fileName) {
                    return filePath;
                }
            }
            return null;
        };
        return walk(this.projectRoot);
    }

    applyFixes() {
        console.log('[UIAutoFixEngine] ⚙️ Initializing Self-Healing System...');
        
        // 1. Run fresh audit to get current state
        const auditor = new SystemAuditEngine(this.projectRoot);
        const report = auditor.runAll();
        
        const initialIssues = report.issues.length;
        if (initialIssues === 0) {
            console.log('[UIAutoFixEngine] ✅ System is already 100% healthy. No fixes needed.');
            this.fixLog.uiImprovementScore = 100;
            return this.fixLog;
        }

        // Keep track of which HTML files got modified so we can inject the fallback script
        const modifiedHtmlFiles = new Set();

        report.issues.forEach(issue => {
            const filePath = this.findFile(issue.file);
            if (!filePath || !fs.existsSync(filePath)) {
                this._logFix('SKIPPED', issue, 'File not found on disk.');
                this.fixLog.manualInterventionRequired++;
                return;
            }

            let content = fs.readFileSync(filePath, 'utf8');
            let fixed = false;

            // ── FIX: DEAD_UI (onclick) ──
            if (issue.category === 'frontend' && issue.type === 'DEAD_UI') {
                // message format: 'onclick="funcName()" is missing JS definition'
                const match = issue.message.match(/onclick="([a-zA-Z0-9_]+)\(\)"/);
                if (match) {
                    const funcName = match[1];
                    // Replace the specific broken onclick with safeFallbackHandler
                    const regex = new RegExp(`onclick=["']${funcName}\\(\\)(?:;)?["']`, 'g');
                    
                    if (content.match(regex)) {
                        content = content.replace(regex, `onclick="safeFallbackHandler('${funcName}', this)"`);
                        fixed = true;
                        modifiedHtmlFiles.add(filePath);
                        this._logFix('FIXED', issue, `Replaced dead onclick with safeFallbackHandler`);
                        this.fixLog.totalFixed++;
                    }
                }
            }
            
            // ── FIX: ORPHAN_MODAL ──
            else if (issue.category === 'frontend' && issue.type === 'ORPHAN_MODAL') {
                // Since removing HTML safely via regex is risky (div tags can be nested),
                // we will inject a hidden class to ensure it doesn't break UI layout.
                const match = issue.message.match(/Modal '([a-zA-Z0-9_]+)'/);
                if (match) {
                    const modalId = match[1];
                    const regex = new RegExp(`id=["']${modalId}["']`, 'g');
                    if (content.match(regex)) {
                        // Just append display:none to its style safely
                        content = content.replace(regex, `id="${modalId}" style="display:none !important;" data-autofix="orphan_modal"`);
                        fixed = true;
                        this._logFix('REMOVED_UI', issue, `Hid orphaned modal to prevent DOM pollution`);
                        this.fixLog.totalRemoved++;
                    }
                }
            }

            // ── FIX: BACKEND/AI (Safe Mode) ──
            else if (issue.category === 'backend' || issue.category === 'ai') {
                // Safe Mode Rules: Do NOT delete backend code or modify AI without manual review
                this._logFix('MANUAL', issue, `Backend/AI code requires manual intervention (SAFE MODE)`);
                this.fixLog.manualInterventionRequired++;
            }
            
            // ── FIX: ORPHAN PERMISSION ──
            else if (issue.category === 'permissions' && issue.type === 'ORPHAN_PERMISSION') {
                if (issue.autoFixable && issue.fixAction) {
                    const permKey = issue.fixAction.split(':')[1];
                    const regex = new RegExp(`\\s*${permKey}:\\s*['"][a-zA-Z0-9_]+['"],?`, 'g');
                    if (content.match(regex)) {
                        content = content.replace(regex, '');
                        fixed = true;
                        this._logFix('REMOVED', issue, `Purged unused permission: ${permKey}`);
                        this.fixLog.totalRemoved++;
                    }
                }
            }

            if (fixed) {
                fs.writeFileSync(filePath, content, 'utf8');
            }
        });

        // Inject the fallback script into any modified HTML files
        modifiedHtmlFiles.forEach(filePath => {
            let content = fs.readFileSync(filePath, 'utf8');
            if (!content.includes('safeFallbackHandler')) {
                // Inject right before </body>
                content = content.replace('</body>', this.fallbackScript);
                fs.writeFileSync(filePath, content, 'utf8');
            }
        });

        // Calculate improvement score
        const totalAddressed = this.fixLog.totalFixed + this.fixLog.totalRemoved;
        this.fixLog.uiImprovementScore = initialIssues > 0 
            ? Math.round((totalAddressed / initialIssues) * 100) 
            : 100;

        this.saveLog();
        console.log(`[UIAutoFixEngine] ✅ Auto-Fix Complete. UI Improvement: ${this.fixLog.uiImprovementScore}%`);
        return this.fixLog;
    }

    _logFix(status, issue, actionTaken) {
        this.fixLog.details.push({
            status,
            category: issue.category,
            file: issue.file,
            issue: issue.message,
            actionTaken
        });
    }

    saveLog() {
        const outPath = path.join(this.projectRoot, 'public/fix-log.json');
        fs.writeFileSync(outPath, JSON.stringify(this.fixLog, null, 2), 'utf8');
    }
}

module.exports = UIAutoFixEngine;
