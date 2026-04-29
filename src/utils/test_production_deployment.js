/**
 * ============================================================
 *  Numi Platform — Run Production Deployment Engine
 *  File: src/utils/test_production_deployment.js
 * ============================================================
 */

// Inject mock env for the test script
process.env.NODE_ENV = 'production';
process.env.TENANT_ENFORCEMENT_MODE = 'true';
process.env.AI_USAGE_TRACKING = 'true';
process.env.ENABLE_DEBUG = 'false';

const ProductionDeploymentEngine = require('../core/ProductionDeploymentEngine');

async function run() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║        NUMI PRODUCTION DEPLOYMENT ENGINE         ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    const engine = new ProductionDeploymentEngine();
    
    await engine.bootstrapServices();
    const report = engine.validateProductionReadiness();

    console.log('\n── Final Validation Report ───────────────────────');
    console.log(`  System Status:         ${report.systemStatus}`);
    console.log(`  Services Loaded:       ${report.servicesLoaded}`);
    console.log(`  Security Status:       ${report.securityStatus}`);
    console.log(`  Tenant Isolation:      ${report.tenantIsolationStatus}`);
    console.log(`  AI System Status:      ${report.aiSystemStatus}`);
    console.log(`  Deployment Mode:       ${report.deploymentMode}`);

    if (report.systemStatus === 'READY') {
        console.log('\n✅ NUMI IS SCALABLE • SECURE • MULTI-TENANT • AI-POWERED');
        console.log('✅ READY FOR CLOUD DEPLOYMENT.');
    } else {
        console.log('\n❌ SYSTEM FAILED DEPLOYMENT VALIDATION.');
        report.errors.forEach(e => console.log(`   [${e.category}] ${e.message}`));
        process.exitCode = 1;
    }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
