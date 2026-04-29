/**
 * ============================================================
 *  Numi Platform — Teacher Content Store
 *  File: src/services/TeacherContentStore.js
 *
 *  Manages teacher-uploaded learning materials. Extracts text,
 *  chunks it for RAG retrieval, and stores it with metadata.
 * ============================================================
 */

// ─── 1. IN-MEMORY STORE ──────────────────────────────────────────────────────
// In production this would be a database (MongoDB / Firestore).
const _materialsDB = {};

const _Notif = (typeof NotificationService !== 'undefined')
    ? NotificationService
    : (() => { try { return require('./NotificationService'); } catch(e) { return null; } })();


// ─── 2. TEXT PROCESSING PIPELINE ─────────────────────────────────────────────

/**
 * Splits raw text into chunks of approximately 600 characters,
 * breaking on sentence boundaries to preserve meaning.
 *
 * @param {string} text
 * @param {number} maxChunkSize
 * @returns {string[]}
 */
function chunkText(text, maxChunkSize = 600) {
    if (!text || typeof text !== 'string') return [];

    // Normalize whitespace / newlines
    const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    // Split on paragraph or sentence boundaries first
    const sentences = normalized.split(/(?<=[.!?؟\n])\s+/);

    const chunks = [];
    let current = '';

    for (const sentence of sentences) {
        if ((current + ' ' + sentence).length > maxChunkSize) {
            if (current.trim()) chunks.push(current.trim());
            current = sentence;
        } else {
            current = current ? current + ' ' + sentence : sentence;
        }
    }
    if (current.trim()) chunks.push(current.trim());

    return chunks;
}

/**
 * Simulates text extraction from a "file".
 * In production: use pdf-parse (Node) or FileReader API (browser).
 *
 * @param {string|Object} file - Raw text string OR { type, content } object
 * @returns {string}
 */
function extractTextFromFile(file) {
    if (typeof file === 'string') return file;                 // Plain text
    if (file && typeof file.content === 'string') return file.content; // { type, content }
    throw new Error('Unsupported file format. Pass raw text or { type, content }.');
}

// ─── 3. MATERIAL MANAGEMENT ──────────────────────────────────────────────────

/**
 * Uploads and processes a learning material for a teacher.
 *
 * @param {string} teacherId
 * @param {string|Object} file - Raw text or { type, content }
 * @param {{ subject: string, title: string }} metadata
 * @returns {Object} Stored material record
 */
function uploadMaterial(teacherId, file, metadata = {}) {
    if (!teacherId) throw new Error("uploadMaterial: teacherId is required.");
    if (!metadata.title) throw new Error("uploadMaterial: metadata.title is required.");

    const rawText = extractTextFromFile(file);
    const contentChunks = chunkText(rawText);

    if (contentChunks.length === 0) {
        throw new Error("No text content could be extracted from the uploaded file.");
    }

    const materialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
        materialId,
        teacherId,
        subject: metadata.subject || 'general',
        title: metadata.title,
        contentChunks,
        embeddings: [], // Future hook: vector embeddings
        uploadedAt: new Date().toISOString()
    };

    _materialsDB[materialId] = record;

    console.log(`[ContentStore] Uploaded "${metadata.title}" for teacher ${teacherId}. Chunks: ${contentChunks.length}`);

    // ── Notification Hook ───────────────────────────────────────────────────────
    if (_Notif) {
        try {
            _Notif.emit(_Notif.EVENTS.MATERIAL_UPLOADED, {
                teacherName: metadata.teacherName || 'المعلم',
                subject: metadata.subject || 'general',
                materialTitle: metadata.title,
                organizationId: metadata.organizationId || null,
                targetStudents: metadata.targetStudents || []
            });
        } catch (e) { /* Never break upload because of notifications */ }
    }

    return record;
}

/**
 * Returns all materials for a teacher, optionally filtered by subject.
 */
function getMaterials(teacherId, subject = null) {
    return Object.values(_materialsDB).filter(m => {
        if (m.teacherId !== teacherId) return false;
        if (subject && m.subject !== subject) return false;
        return true;
    });
}

/**
 * Lists summary info (no chunks) for all of a teacher's materials.
 */
function listMaterials(teacherId) {
    return getMaterials(teacherId).map(m => ({
        materialId: m.materialId,
        title: m.title,
        subject: m.subject,
        chunkCount: m.contentChunks.length,
        uploadedAt: m.uploadedAt
    }));
}

/**
 * Deletes a material by ID. Only the owning teacher can delete.
 */
function deleteMaterial(materialId, teacherId = null) {
    const mat = _materialsDB[materialId];
    if (!mat) throw new Error(`Material "${materialId}" not found.`);
    if (teacherId && mat.teacherId !== teacherId) {
        throw new Error("Unauthorized: Cannot delete another teacher's material.");
    }
    delete _materialsDB[materialId];
    return true;
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

const TeacherContentStore = {
    uploadMaterial,
    getMaterials,
    listMaterials,
    deleteMaterial,
    chunkText,           // Exported for testing
    _getDB: () => _materialsDB // Test/debug only
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeacherContentStore;
}
if (typeof window !== 'undefined') {
    window.TeacherContentStore = TeacherContentStore;
}
