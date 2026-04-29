/**
 * ============================================================
 *  Numi Platform — AI Chat UI Adapter
 *  File: src/services/AIChatUIAdapter.js
 *
 *  Connects the AIChatIntegration engine to the real frontend UI.
 *  Can be imported into numi-app.js, admin.html, or any existing Chat UI.
 * ============================================================
 */

const _AIChatIntegration = (typeof AIChatIntegration !== 'undefined') 
    ? AIChatIntegration 
    : require('./AIChatIntegration');

const _AICE = (typeof AIContextEngine !== 'undefined') 
    ? AIContextEngine 
    : require('./AIContextEngine');

// ─── 1. FRONTEND ADAPTER (API COMMUNICATION LAYER) ───────────────────────────

/**
 * Sends a message to the backend AI endpoint using fetch.
 * Acts as the 'aiCallFn' for processAIRequest.
 * 
 * @param {string} systemPrompt - The dynamically generated system prompt
 * @param {string} userMessage - The raw user message
 * @returns {Promise<string>} The AI's response text
 */
async function callBackendAI(systemPrompt, userMessage) {
    try {
        // We assume your backend has this route implemented: POST /api/ai/chat
        // If it doesn't, this will gracefully fail and trigger the Fallback Safety.
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemPrompt: systemPrompt,
                message: userMessage
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.response) {
            throw new Error(data.error || "Invalid response format from AI backend");
        }

        return data.response;
    } catch (error) {
        console.error('[AIFetchAdapter] callBackendAI failed:', error);
        throw error; // Will be caught by processAIRequest's fallback
    }
}


// ─── 2. UI INTEGRATION HANDLER (CHAT FLOW) ───────────────────────────────────

/**
 * The main handler that should be attached to the Chat UI's Send button
 * or invoked when a user submits a message to the floating AI assistant.
 * 
 * @param {Object} currentUser - The current user object (from localStorage or state)
 * @param {string} messageText - The text typed by the user
 * @param {Object} uiCallbacks - Callbacks to safely manipulate the UI
 */
async function handleSendAIMessage(currentUser, messageText, uiCallbacks) {
    const { onMessageAdded, onLoadingStart, onLoadingEnd, onError } = uiCallbacks;

    if (!messageText || messageText.trim() === '') return;

    // 1. Render User Message immediately
    onMessageAdded({
        sender: 'user',
        name: currentUser.name || 'أنت',
        text: messageText,
        timestamp: new Date().toISOString()
    });

    // 2. Show Loading State (e.g. typing indicator)
    onLoadingStart();

    try {
        // 3. Process the AI Request locally using our safe AI Context Engine
        const safeAIResponse = await _AIChatIntegration.processAIRequest(
            currentUser, 
            messageText, 
            callBackendAI // Injected API call
        );

        // 4. Render AI Response
        onMessageAdded({
            sender: 'ai',
            name: 'المساعد الذكي',
            text: safeAIResponse,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // Fallback catch in case processAIRequest itself crashes horribly
        console.error('[AIChatUIAdapter] Critical UI failure:', error);
        if (onError) {
            onError('حدث خطأ غير متوقع. لا يمكن معالجة طلبك حالياً.');
        } else {
            onMessageAdded({
                sender: 'ai',
                name: 'المساعد الذكي',
                text: 'حدث خطأ غير متوقع. لا يمكن معالجة طلبك حالياً.',
                timestamp: new Date().toISOString(),
                isError: true
            });
        }
    } finally {
        // 5. Hide Loading State
        onLoadingEnd();
    }
}


// ─── 3. EXPORTS ──────────────────────────────────────────────────────────────

const AIChatUIAdapter = {
    callBackendAI,
    handleSendAIMessage
};

// Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIChatUIAdapter;
}

// Browser global
if (typeof window !== 'undefined') {
    window.AIChatUIAdapter = AIChatUIAdapter;
}
