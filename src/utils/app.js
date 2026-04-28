document.addEventListener('DOMContentLoaded', () => {
    
    // Auth Check
    if (Auth.isLoggedIn()) {
        UI.showApp();
    } else {
        UI.showLogin();
    }

    // Login Form
    document.getElementById('btn-login').addEventListener('click', () => {
        const phone = document.getElementById('phone').value.trim();
        const code = document.getElementById('student-code').value.trim();
        const res = Auth.login(phone, code);
        if (res.success) {
            UI.showApp();
            document.getElementById('login-error').style.display = 'none';
        } else {
            UI.showLoginError(res.msg);
        }
    });

    // Mobile Sidebar Toggle
    document.getElementById('mobile-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Notes Auto-save
    const notesArea = document.getElementById('qn-textarea');
    if (notesArea) {
        notesArea.addEventListener('input', (e) => {
            StorageHelper.save('numi_notes', e.target.value);
        });
    }

    // Name editing
    document.getElementById('btn-edit-name').addEventListener('click', () => {
        const currentName = document.getElementById('display-name').textContent;
        const newName = prompt("أدخل اسمك الجديد:", currentName);
        if (newName && newName.trim()) {
            Auth.updateUser({ name: newName.trim() });
            UI.updateProfile();
        }
    });

    // Fake Chat AI Logic (UI Simulation only as requested)
    const chatInput = document.getElementById('chat-field');
    const btnSendMsg = document.getElementById('btn-send-msg');
    const chatHistory = document.getElementById('chat-history');

    const handleSend = () => {
        const txt = chatInput.value.trim();
        if(!txt) return;
        
        // Append user
        appendChatMsg(txt, 'user');
        chatInput.value = '';

        // Fake typing
        const typingId = 'typing-' + Date.now();
        setTimeout(() => {
            chatHistory.innerHTML += `<div id="${typingId}" class="msg bot" style="opacity: 0.7;">يكتب الآن... <i class="fas fa-pencil-alt"></i></div>`;
            scrollToBottom();
        }, 300);

        // Fake response
        setTimeout(() => {
            const typingEl = document.getElementById(typingId);
            if(typingEl) typingEl.remove();
            appendChatMsg('تطبيق هذه المعادلة يتطلب خطوة بخطوة. يجب مراجعة قاعدة السلسلة في الاشتقاق.', 'bot');
        }, 1500);
    };

    btnSendMsg.addEventListener('click', handleSend);
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

    function appendChatMsg(text, sender) {
        chatHistory.innerHTML += `<div class="msg ${sender}">${text}</div>`;
        scrollToBottom();
    }
    
    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
    
    // Math Keyboard logic
    document.getElementById('btn-toggle-math').addEventListener('click', () => {
        document.getElementById('math-keyboard').classList.toggle('active');
    });

    // Insert math symbol logic attached dynamically
    document.querySelectorAll('.math-key').forEach(key => {
        key.addEventListener('click', (e) => {
            const sym = e.target.getAttribute('data-sym') || e.target.textContent;
            chatInput.value += sym;
            chatInput.focus();
        });
    });
});
