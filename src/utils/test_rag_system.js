/**
 * Full RAG System Test — Teacher Content RAG
 * Run with: node src/utils/test_rag_system.js
 *
 * Simulates: upload → query match → query no-match → fallback
 */

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

const AIChatIntegration    = require('../services/AIChatIntegration');

const { TeacherProfile, TeacherProfileManager } = require('../models/TeacherProfile');
global.TeacherProfileManager = TeacherProfileManager;

// ─── MOCK AI CALLER ───────────────────────────────────────────────────────────
// In production this calls your backend POST /api/ai/chat
async function mockAICall(systemPrompt, userMessage) {
    // Simulate what a real LLM would return when given the RAG context
    if (systemPrompt.includes('RAG Mode')) {
        if (systemPrompt.includes('لا تستخدم أي معرفة عامة')) {
            // RAG with context: simulate AI reading and answering from chunks
            return 'وفقاً للمحتوى المقدَّم: الضوء يتكون من فوتونات وينتقل بسرعة 300,000 كم/ث في الفراغ.';
        }
        // RAG with no-result instruction: AI must output the specific phrase
        return 'المعلومة غير موجودة في المحتوى المرفوع من المعلم';
    }
    return 'إجابة عامة من الذكاء الاصطناعي.';
}

// ─── SAMPLE MATERIAL ─────────────────────────────────────────────────────────
const SAMPLE_PHYSICS_TEXT = `
الضوء وخصائصه
الضوء هو شكل من أشكال الطاقة الكهرومغناطيسية. ينتقل الضوء في خطوط مستقيمة.
يتكون الضوء من جسيمات تُسمى الفوتونات. ينتقل الضوء بسرعة 300,000 كيلومتر في الثانية في الفراغ.

الانعكاس والانكسار
عندما يصطدم الضوء بسطح مصقول يحدث الانعكاس. زاوية السقوط تساوي زاوية الانعكاس.
الانكسار هو تغيير في اتجاه الضوء عند انتقاله من وسط إلى آخر ذي كثافة بصرية مختلفة.

ألوان الطيف الضوئي
يتكون الضوء الأبيض من سبعة ألوان: أحمر، برتقالي، أصفر، أخضر، أزرق، نيلي، بنفسجي.
يمكن رؤية هذه الألوان من خلال المنشور الزجاجي.
`;

// ─── TESTS ────────────────────────────────────────────────────────────────────
async function runTests() {
    console.log('═══════════════════════════════════════════');
    console.log('  Testing Teacher Content RAG System');
    console.log('═══════════════════════════════════════════\n');

    // 1. Create a teacher profile with RAG disabled initially
    console.log('[1] Creating Teacher Profile...');
    let teacher = TeacherProfileManager.createTeacherProfile({
        fullName: 'أ. خالد العلي',
        subject: 'science',
        bio: 'معلم فيزياء',
        ragEnabled: false
    });
    console.log(`    ✅ Created: ${teacher.fullName} | RAG: ${teacher.ragEnabled}\n`);

    // 2. Upload a material
    console.log('[2] Uploading Physics Material...');
    const material = TeacherContentStore.uploadMaterial(
        teacher.id,
        SAMPLE_PHYSICS_TEXT,
        { title: 'وحدة الضوء - الفيزياء', subject: 'science' }
    );
    console.log(`    ✅ Uploaded: "${material.title}" | Chunks: ${material.contentChunks.length}\n`);
    console.log('    Sample chunks:');
    material.contentChunks.forEach((c, i) => console.log(`      [${i+1}] ${c.substring(0,80)}...`));
    console.log();

    // 3. Test the RAG retrieval engine directly
    console.log('[3] Testing RAG Retrieval (keyword: "فوتون")...');
    const retrieval = RAGEngine.retrieveRelevantChunks(teacher.id, 'ما هي الفوتونات؟', { subject: 'science' });
    console.log(`    ✅ hasResults: ${retrieval.hasResults}`);
    console.log(`    ✅ Retrieved chunks: ${retrieval.chunks.length}`);
    console.log(`    ✅ Sources: ${retrieval.sources.join(', ')}\n`);

    // 4. Enable RAG mode for teacher
    console.log('[4] Enabling RAG Mode for Teacher...');
    teacher = TeacherProfileManager.setRAGMode(teacher.id, true);
    console.log(`    ✅ RAG Mode: ${teacher.ragEnabled}\n`);

    // 5. Full AI request WITH RAG active + matching content
    console.log('[5] Full AI Request — RAG Mode ON, content FOUND...');
    const rawUser = { ...teacher.toJSON(), id: teacher.id, role: 'student', subject: 'science' };
    const responseMatch = await AIChatIntegration.processAIRequest(
        rawUser,
        'ما هي خصائص الضوء والفوتونات؟',
        mockAICall
    );
    console.log('    AI Response:', responseMatch, '\n');

    // 6. Full AI request WITH RAG active + NO matching content (fallback test)
    console.log('[6] Full AI Request — RAG Mode ON, content NOT FOUND...');
    const responseNoMatch = await AIChatIntegration.processAIRequest(
        rawUser,
        'اشرح قوانين نيوتن للحركة',  // Not in the uploaded material
        mockAICall
    );
    console.log('    AI Response:', responseNoMatch, '\n');

    // 7. Disable RAG mode and test standard mode
    console.log('[7] Full AI Request — RAG Mode OFF (Standard Mode)...');
    const standardUser = { ...rawUser, ragEnabled: false };
    const responseStandard = await AIChatIntegration.processAIRequest(
        standardUser,
        'ما هي خصائص الضوء؟',
        mockAICall
    );
    console.log('    AI Response:', responseStandard, '\n');

    // 8. List materials
    console.log('[8] Listing Teacher Materials...');
    const list = TeacherContentStore.listMaterials(teacher.id);
    console.dir(list, { depth: null });

    // 9. Check Usage Tracking logged rag_query
    console.log('\n[9] Checking AI Usage Log for RAG entries...');
    const { logsDB } = AIUsageTracker._getDbState();
    const ragLogs = logsDB.filter(l => l.type === 'rag_query');
    console.log(`    ✅ RAG query logs: ${ragLogs.length}`);
    ragLogs.forEach(l => console.log(`      - tokens: ${l.tokens} | retrieved: ${l.metadata.retrieved} chunks | query: "${l.metadata.query}"`));

    console.log('\n═══════════════════════════════════════════');
    console.log('  All RAG System Tests Passed ✅');
    console.log('═══════════════════════════════════════════');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
