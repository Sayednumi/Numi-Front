/**
 * ============================================================
 *  Numi Platform — RAG Engine (Retrieval-Augmented Generation)
 *  File: src/services/RAGEngine.js
 *
 *  Keyword-based MVP retrieval engine. Scores chunks by relevance
 *  to a user query and returns the top matches for prompt injection.
 *
 *  Future: swap _scoreChunk() for cosine-similarity on embeddings.
 * ============================================================
 */

const TeacherContentStore = (typeof window !== 'undefined' && window.TeacherContentStore)
    ? window.TeacherContentStore
    : require('./TeacherContentStore');

const AIUsageTracker = (typeof window !== 'undefined' && window.AIUsageTracker)
    ? window.AIUsageTracker
    : require('./AIUsageTracker');

// ─── 1. TOKENISER / KEYWORD EXTRACTOR ────────────────────────────────────────

const ARABIC_STOP_WORDS = new Set([
    'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك',
    'التي', 'الذي', 'هو', 'هي', 'نحن', 'أنت', 'أنا', 'كان', 'كانت', 'يكون',
    'ما', 'لا', 'أو', 'و', 'أن', 'قد', 'لقد', 'عند', 'حتى', 'بعد', 'قبل',
    'the', 'a', 'an', 'is', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'for',
    'it', 'this', 'that', 'was', 'are', 'be', 'by', 'with', 'as', 'but', 'not'
]);

/**
 * Extracts meaningful keywords from a query string.
 * Strips punctuation, lowercases, removes stop words.
 */
function extractKeywords(text) {
    return text
        .replace(/[،,؟?!.؛;()[\]{}""'']/g, ' ')
        .split(/\s+/)
        .map(w => w.toLowerCase().trim())
        .filter(w => w.length > 1 && !ARABIC_STOP_WORDS.has(w));
}

// ─── 2. CHUNK SCORER ─────────────────────────────────────────────────────────

/**
 * Scores a single chunk against the query keywords.
 * Uses term frequency — a simple but effective MVP metric.
 *
 * @param {string} chunk
 * @param {string[]} keywords
 * @returns {number} Score (higher = more relevant)
 */
function _scoreChunk(chunk, keywords) {
    const lowerChunk = chunk.toLowerCase();
    let score = 0;

    for (const kw of keywords) {
        // Count occurrences using a regex
        const matches = (lowerChunk.match(new RegExp(kw, 'g')) || []).length;
        score += matches;

        // Bonus: keyword appears at start of chunk (likely a heading/key point)
        if (lowerChunk.startsWith(kw)) score += 3;
    }

    // Slight penalty for very long chunks (prefer focused chunks)
    if (chunk.length > 800) score *= 0.85;

    return score;
}

// ─── 3. RETRIEVAL ENGINE ─────────────────────────────────────────────────────

/**
 * Retrieves the top N most relevant chunks from a teacher's materials
 * for the given user query.
 *
 * @param {string} teacherId
 * @param {string} query - The user's question
 * @param {Object} options
 * @param {string} [options.subject] - Filter to a specific subject
 * @param {number} [options.topK=4] - Max chunks to return
 * @returns {{ chunks: string[], sources: string[], hasResults: boolean }}
 */
function retrieveRelevantChunks(teacherId, query, options = {}) {
    const { subject = null, topK = 4 } = options;

    const materials = TeacherContentStore.getMaterials(teacherId, subject);

    if (materials.length === 0) {
        return { chunks: [], sources: [], hasResults: false };
    }

    const keywords = extractKeywords(query);
    if (keywords.length === 0) {
        // No usable keywords: return first chunks from first material as fallback
        const firstMat = materials[0];
        return {
            chunks: firstMat.contentChunks.slice(0, 2),
            sources: [firstMat.title],
            hasResults: true
        };
    }

    // Score every chunk across all materials
    const scored = [];
    for (const material of materials) {
        for (const chunk of material.contentChunks) {
            const score = _scoreChunk(chunk, keywords);
            if (score > 0) {
                scored.push({ chunk, score, source: material.title });
            }
        }
    }

    // Sort descending and take top K
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);

    if (top.length === 0) {
        return { chunks: [], sources: [], hasResults: false };
    }

    return {
        chunks: top.map(t => t.chunk),
        sources: [...new Set(top.map(t => t.source))],
        hasResults: true
    };
}

// ─── 4. RAG SYSTEM PROMPT BUILDER ────────────────────────────────────────────

/**
 * Builds the strict RAG system prompt fragment that forces the AI to answer
 * only from the provided chunks and refuse if the answer isn't there.
 *
 * @param {string[]} chunks
 * @param {string[]} sources
 * @returns {string}
 */
function buildRAGContextPrompt(chunks, sources) {
    let prompt = `\n\n══════════════════════════════════════════\n`;
    prompt += `📚 وضع المصدر الموثوق (RAG Mode) - مفعّل\n`;
    prompt += `══════════════════════════════════════════\n`;
    prompt += `يجب أن تجيب فقط من المحتوى التالي المقدَّم من المعلم.\n`;
    prompt += `إذا لم تجد الإجابة في هذا المحتوى، قل:\n`;
    prompt += `"المعلومة غير موجودة في المحتوى المرفوع من المعلم"\n`;
    prompt += `لا تستخدم أي معرفة عامة خارج هذا المحتوى.\n\n`;
    prompt += `المصادر المستخدمة: ${sources.join('، ')}\n\n`;
    prompt += `--- بداية المحتوى ---\n`;
    chunks.forEach((chunk, i) => {
        prompt += `\n[مقطع ${i + 1}]\n${chunk}\n`;
    });
    prompt += `\n--- نهاية المحتوى ---\n`;
    prompt += `══════════════════════════════════════════\n\n`;
    return prompt;
}

/**
 * Builds the "no results" RAG prompt — tells AI to explicitly state the content
 * wasn't uploaded yet, rather than making something up.
 */
function buildRAGNoResultsPrompt() {
    return `\n\n[RAG Mode Active — No relevant material found]\n` +
           `You MUST respond with ONLY this sentence in Arabic: "المعلومة غير موجودة في المحتوى المرفوع من المعلم"\n` +
           `Do not add anything else.\n\n`;
}

// ─── 5. TOP-LEVEL RAG QUERY HANDLER ──────────────────────────────────────────

/**
 * Full RAG query: retrieves chunks, builds prompt fragment, tracks usage.
 *
 * @param {string} teacherId
 * @param {string} query
 * @param {Object} options - { subject, topK, rawUser }
 * @returns {{ contextPrompt: string, hasResults: boolean, sources: string[] }}
 */
function queryRAG(teacherId, query, options = {}) {
    const { subject, topK, rawUser } = options;

    const result = retrieveRelevantChunks(teacherId, query, { subject, topK });

    // Track usage
    if (rawUser) {
        AIUsageTracker.logAIUsage({
            user: rawUser,
            type: 'rag_query',
            tokensUsed: result.chunks.reduce((acc, c) => acc + Math.ceil(c.length / 4), 0),
            metadata: { subject, query: query.substring(0, 80), retrieved: result.chunks.length }
        });
    }

    if (!result.hasResults) {
        return {
            contextPrompt: buildRAGNoResultsPrompt(),
            hasResults: false,
            sources: []
        };
    }

    return {
        contextPrompt: buildRAGContextPrompt(result.chunks, result.sources),
        hasResults: true,
        sources: result.sources
    };
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

const RAGEngine = {
    retrieveRelevantChunks,
    queryRAG,
    buildRAGContextPrompt,
    buildRAGNoResultsPrompt,
    extractKeywords,
    _scoreChunk
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RAGEngine;
}
if (typeof window !== 'undefined') {
    window.RAGEngine = RAGEngine;
}
