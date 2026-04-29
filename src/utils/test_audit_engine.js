/**
 * ============================================================
 *  Numi Platform — Run System Audit
 *  File: src/utils/test_audit_engine.js
 * ============================================================
 */

const SystemAuditEngine = require('../services/SystemAuditEngine');
const fs = require('fs');
const path = require('path');

const engine = new SystemAuditEngine(path.resolve(__dirname, '../../'));
const report = engine.runAll();

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║        NUMI FULL SYSTEM AUDIT REPORT         ║');
console.log('╚══════════════════════════════════════════════╝\n');

console.log(`System Readiness Score: ${report.readinessScore}%\n`);

const categories = {
    frontend: '🎨 Frontend (Dead UI / Missing Listeners)',
    backend: '⚙️ Backend (Unused Routes / Broken Deps)',
    permissions: '🔐 Permissions (Orphaned / Unused Keys)',
    ai: '🧠 AI System (Context Bypass / Token Leaks)'
};

let hasIssues = false;

Object.entries(categories).forEach(([key, title]) => {
    const issues = report.issues.filter(i => i.category === key);
    console.log(`${title} [${issues.length} issues]`);
    if (issues.length > 0) hasIssues = true;
    
    issues.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. [${issue.type}] ${issue.file}`);
        console.log(`     ↳ ${issue.message}`);
        if (issue.autoFixable) console.log(`     ✨ Auto-fix available`);
    });
    console.log('');
});

// Output JSON for the dashboard
const outPath = path.resolve(__dirname, '../../public/audit_report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\n💾 Report saved to: public/audit_report.json`);
