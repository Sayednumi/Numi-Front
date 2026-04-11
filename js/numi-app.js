/* ═══════════════════════════════════════════════════════════════
   NUMI LEARNING PLATFORM — Main Application Logic
   ═══════════════════════════════════════════════════════════════ */

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : 'https://numi-production-7484.up.railway.app/api';
const SESSION_KEY = 'numi_session_user';
const CHAT_KEY = 'numi_chat_data';
const NOTES_KEY = 'numi_notes';

let currentUser = null;
let platformDB = null;
let lessonsList = [];
let unitsList = [];
let currentLessonSteps = [];
let currentStepIndex = 0;
let currentLessonObj = null;
let currentQuizScore = null;
let currentQuizAnswers = [];
let currentQuizAttempt = null;
let quizTimerInterval = null;
let quizSecondsRemaining = 0;


// ─── Achievements Definition ──────────────────────────────────
const ACHIEVEMENTS = [
    { id: 'first_lesson', icon: '🎓', title: 'البداية', desc: 'أكمل أول درس', condition: u => (u.completedLessons || []).length >= 1 },
    { id: 'five_lessons', icon: '📚', title: 'طالب نشط', desc: 'أكمل 5 دروس', condition: u => (u.completedLessons || []).length >= 5 },
    { id: 'ten_lessons', icon: '🏆', title: 'بطل المعرفة', desc: 'أكمل 10 دروس', condition: u => (u.completedLessons || []).length >= 10 },
    { id: 'xp_100', icon: '⭐', title: 'نجم ساطع', desc: 'اجمع 100 XP', condition: u => (u.xp || 0) >= 100 },
    { id: 'xp_500', icon: '💎', title: 'ماسي', desc: 'اجمع 500 XP', condition: u => (u.xp || 0) >= 500 },
    { id: 'xp_1000', icon: '👑', title: 'أسطورة', desc: 'اجمع 1000 XP', condition: u => (u.xp || 0) >= 1000 },
    { id: 'streak_3', icon: '🔥', title: 'حماس مشتعل', desc: '3 أيام متتالية', condition: u => (u.streak || 0) >= 3 },
    { id: 'streak_7', icon: '🌟', title: 'أسبوع كامل', desc: '7 أيام متتالية', condition: u => (u.streak || 0) >= 7 },
];

// ─── AI Responses Bank ────────────────────────────────────────
const AI_RESPONSES = [
    'سؤال ممتاز! 💡 دعني أساعدك خطوة بخطوة...\n\nأولاً: حدد المعطيات في المسألة.\nثانياً: اختر القاعدة المناسبة.\nثالثاً: طبق القاعدة بترتيب.',
    'فكرة رائعة! 🧠 لحل هذا النوع من المسائل:\n\n1. راجع القوانين الأساسية\n2. بسّط المعادلة\n3. تحقق من إجابتك',
    'أحسنت السؤال! 🎯 المفتاح هنا هو فهم العلاقة بين المتغيرات.\n\nنصيحة: ارسم رسم بياني للمسألة لتفهمها بشكل أوضح.',
    'دعني أشرح لك الموضوع ببساطة 📝:\n\nتخيل أن المعادلة مثل الميزان - كل ما تفعله في طرف لازم تفعله في الآخر.',
    'سؤال مهم جداً! ✨ لنفكر فيه معاً:\n\nالخطوة 1: اقرأ المسألة مرتين\nالخطوة 2: حدد ما هو المطلوب\nالخطوة 3: اختر الطريقة المناسبة',
    'ممتاز! أنت في الطريق الصحيح 🚀\n\nتذكر: التفاضل يعني إيجاد معدل التغير، والتكامل يعني إيجاد المساحة تحت المنحنى.',
    'بالتأكيد أقدر أساعدك! 💪\n\nالقاعدة الذهبية: تدرب على أمثلة كثيرة ومتنوعة. كل مسألة تحلها تقربك من الفهم الكامل.',
];

// ── Initialisation ────────────────────────────────────────────
window.onload = async () => {
    await fetchPlatformData();
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
        currentUser = JSON.parse(saved);
        if (currentUser.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        }

        // ✅ Verify the account is still active on the server before allowing access
        try {
            const verifyRes = await fetch(`${API_URL}/users/${currentUser.id}`);
            if (verifyRes.ok) {
                const freshUser = await verifyRes.json();
                if (freshUser.status === 'inactive') {
                    localStorage.removeItem(SESSION_KEY);
                    alert('⚠️ تم إيقاف تفعيل حسابك. يرجى التواصل مع الإدارة.');
                    currentUser = null;
                    return;
                }
                if (freshUser.status === 'locked') {
                    localStorage.removeItem(SESSION_KEY);
                    alert('🔒 تم إغلاق حسابك. يرجى التواصل مع الإدارة.');
                    currentUser = null;
                    return;
                }
                // Update local session with latest data from server
                currentUser = { ...currentUser, ...freshUser };
                localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
            } else {
                // Server returned error (user not found, deleted, etc.) — force logout
                localStorage.removeItem(SESSION_KEY);
                currentUser = null;
                return;
            }
        } catch (e) {
            // If offline / server error, allow access with cached session (graceful degradation)
            console.warn('Could not verify session online, using cached session:', e.message);
        }

        showApp(currentUser);
        await loadLessonsFromBackend();
        renderDashboard();
    }
    const savedChat = localStorage.getItem(CHAT_KEY);
    if (savedChat) document.getElementById('chat-history').innerHTML = savedChat;
    const savedNotes = localStorage.getItem(NOTES_KEY);
    if (savedNotes) { const ta = document.getElementById('qn-textarea'); if (ta) ta.value = savedNotes; }
    // Auto-save notes
    const notesEl = document.getElementById('qn-textarea');
    if (notesEl) notesEl.addEventListener('input', () => localStorage.setItem(NOTES_KEY, notesEl.value));
};

// ── Utility ───────────────────────────────────────────────────
function togglePass(id, icon) {
    const input = document.getElementById(id);
    if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
    else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
}

// ── Platform Data ─────────────────────────────────────────────
async function fetchPlatformData() {
    try {
        const res = await fetch(`${API_URL}/platform-data`);
        if (res.ok) { platformDB = await res.json(); populateClasses(); }
    } catch (e) { console.warn('Platform data fetch failed', e); }
}

function populateClasses() {
    const sel = document.getElementById('reg-class');
    if (!sel || !platformDB?.classes) return;
    sel.innerHTML = '<option value="" disabled selected>اختر الصف...</option>';
    for (let id in platformDB.classes) {
        sel.innerHTML += `<option value="${id}">${platformDB.classes[id].name}</option>`;
    }
}

function updateGroupsDropdown(classSelId, groupSelId) {
    const cId = document.getElementById(classSelId).value;
    const gSel = document.getElementById(groupSelId);
    if (!gSel || !platformDB) return;
    gSel.innerHTML = '<option value="">اختر المجموعة...</option>';
    const groups = platformDB.classes?.[cId]?.groups || {};
    for (let gId in groups) gSel.innerHTML += `<option value="${gId}">${groups[gId].name}</option>`;
}

// ── Auth: Login ───────────────────────────────────────────────
async function login() {
    const phone = document.getElementById('phone').value.trim();
    const code = document.getElementById('student-code').value.trim();
    const err = document.getElementById('login-error');
    const loginBtn = document.getElementById('btn-login');
    if (!phone || !code) { showError(err, 'يرجى إدخال الهاتف وكلمة المرور.'); return; }
    loginBtn.disabled = true; loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحقق...';
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password: code })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
            err.style.display = 'none';
            if (currentUser.role === 'admin') {
                window.location.href = 'admin.html';
                return;
            }
            showApp(currentUser);
            await loadLessonsFromBackend();
            renderDashboard();
        } else { showError(err, data.msg || 'بيانات الدخول غير صحيحة.'); }
    } catch (e) {
        showError(err, 'تعذر الاتصال بالخادم. حاول لاحقاً.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-rocket"></i> بدء التعلم الممتع';
    }
}

// ── Auth: Register ────────────────────────────────────────────
async function register() {
    const fields = { name: 'reg-name', phone: 'reg-phone', password: 'reg-password', parentPhone: 'reg-parent-phone', school: 'reg-school', classId: 'reg-class', groupId: 'reg-group' };
    const vals = {}; for (let k in fields) vals[k] = document.getElementById(fields[k]).value.trim();
    const err = document.getElementById('login-error');
    const regBtn = document.getElementById('reg-btn');
    if (!vals.name || !vals.phone || !vals.password || !vals.classId || !vals.groupId) { showError(err, 'يرجى إكمال جميع البيانات المطلوبة.'); return; }
    if (vals.phone.length !== 11) { showError(err, 'يجب أن يكون رقم الهاتف 11 رقماً.'); return; }
    if (vals.password.length < 8) { showError(err, 'يجب أن تكون كلمة المرور 8 رموز على الأقل.'); return; }
    regBtn.disabled = true; regBtn.textContent = 'جارٍ إنشاء الحساب...';
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vals)
        });
        const data = await res.json();
        if (data.success) {
            showSuccess(err, 'تم إنشاء الحساب بنجاح! حسابك "غير نشط"، يرجى التواصل مع الإدارة لتفعيله.');
            setTimeout(() => toggleAuthMode(false), 3000);
        } else { showError(err, data.msg || 'فشل إنشاء الحساب.'); }
    } catch (e) { showError(err, 'تعذر الاتصال بالخادم.'); }
    finally { regBtn.disabled = false; regBtn.innerHTML = '<i class="fas fa-user-plus"></i> سجل الآن مجاناً'; }
}

function toggleAuthMode(isRegister) {
    document.getElementById('login-fields').classList.toggle('hidden', isRegister);
    document.getElementById('register-fields').classList.toggle('hidden', !isRegister);
    document.getElementById('auth-title').textContent = isRegister ? 'عضو جديد؟ مرحباً بك! ✨' : 'بوابة Numi 🚀';
    document.getElementById('auth-subtitle').textContent = isRegister ? 'أنشئ حسابك الآن وابدأ رحلة التعلم الذكي' : 'قم بتسجيل الدخول لمتابعة دراستك التفاعلية';
    document.getElementById('login-error').style.display = 'none';
    // Scroll to top when switching modes
    document.getElementById('login-page').scrollTop = 0;
}

function showError(el, msg) { el.textContent = msg; el.style.display = 'block'; el.style.color = 'var(--danger)'; el.style.background = 'var(--danger-glow)'; el.style.borderColor = 'rgba(239,68,68,0.3)'; }
function showSuccess(el, msg) { el.textContent = msg; el.style.display = 'block'; el.style.color = 'var(--success)'; el.style.background = 'var(--success-glow)'; el.style.borderColor = 'rgba(16,185,129,0.3)'; }

function logout() {
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CHAT_KEY);
    document.getElementById('chat-history').innerHTML = '<div class="msg bot">جاهز للفهم العميق؟ 💪 اسأل أي سؤال، وسنستكشف الإجابة معًا!</div>';
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-page').style.display = 'flex';
}

function showApp(u) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    if (u.name) {
        document.getElementById('display-name').textContent = u.name;
        updateSidebarAvatar();
    }
    if (u.id) document.getElementById('display-id').textContent = u.id;
    // Grade display
    let gradeDisplay = 'طالب Numi';
    if (u.classId && platformDB?.classes?.[u.classId]) gradeDisplay = platformDB.classes[u.classId].name;
    document.getElementById('display-grade').textContent = gradeDisplay;
    updateGamificationDisplay();
    // Settings
    document.getElementById('settings-name').textContent = u.name || '---';
    document.getElementById('settings-phone').textContent = u.phone || '---';
    document.getElementById('settings-grade').textContent = gradeDisplay;
    const groupName = platformDB?.classes?.[u.classId]?.groups?.[u.groupId]?.name || u.groupId || '---';
    document.getElementById('settings-group').textContent = groupName;

    // Sidebar & Settings Avatar
    if (u.avatar) {
        document.getElementById('settings-avatar-img').src = u.avatar;
        document.getElementById('settings-avatar-img').style.display = 'block';
        document.getElementById('settings-avatar-text').style.display = 'none';
    }

    // Init Real-time Chat
    initHumanChatSocket();

    // Check Live Class Enabled
    const isLiveEnabled = platformDB?.classes?.[u.classId]?.groups?.[u.groupId]?.liveEnabled;
    if (isLiveEnabled) {
        document.getElementById('nav-live-class').style.display = 'flex';
        loadStudentLiveClasses(u);
    } else {
        document.getElementById('nav-live-class').style.display = 'none';
    }
}

function updateSidebarAvatar() {
    const avatarEl = document.getElementById('display-avatar');
    if (currentUser?.avatar) {
        avatarEl.innerHTML = `<img src="${currentUser.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        avatarEl.style.background = 'transparent';
        avatarEl.style.border = 'none';
    } else if (currentUser?.name) {
        avatarEl.innerHTML = currentUser.name.charAt(0);
    }
}

function uploadAvatar(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();

    // Set loading indicator
    document.getElementById('settings-avatar-text').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    document.getElementById('settings-avatar-img').style.display = 'none';
    document.getElementById('settings-avatar-text').style.display = 'block';

    reader.onload = function (e) {
        const img = new Image();
        img.onload = async function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 150;
            canvas.height = 150;

            // Center crop portrait or landscape to perfect square
            const size = Math.min(img.width, img.height);
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, 150, 150);

            // Compress to JPEG 0.7 to avoid bloating MongoDB
            const base64 = canvas.toDataURL('image/jpeg', 0.7);

            document.getElementById('settings-avatar-img').src = base64;
            document.getElementById('settings-avatar-img').style.display = 'block';
            document.getElementById('settings-avatar-text').style.display = 'none';
            document.getElementById('settings-avatar-text').innerHTML = '<i class="fas fa-user"></i>';

            try {
                const res = await fetch(`${API_URL}/users/${currentUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar: base64 })
                });

                if (res.ok) {
                    currentUser.avatar = base64;
                    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
                    updateSidebarAvatar();
                } else {
                    alert('❌ حدث خطأ أثناء حفظ الصورة في الخادم.');
                }
            } catch (err) {
                alert('❌ غير قادر على الاتصال بالخادم لحفظ الصورة.');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateGamificationDisplay() {
    if (!currentUser) return;
    const xp = currentUser.xp || 0;
    const streak = currentUser.streak || 0;
    const badgeCount = ACHIEVEMENTS.filter(a => a.condition(currentUser)).length;
    document.getElementById('sidebar-xp').textContent = xp;
    document.getElementById('sidebar-streak').textContent = streak;
    document.getElementById('sidebar-badges').textContent = badgeCount;
    document.getElementById('dash-xp').textContent = xp;
    document.getElementById('dash-streak').textContent = streak;
    document.getElementById('dash-badges').textContent = badgeCount;
    document.getElementById('dash-completed').textContent = (currentUser.completedLessons || []).length;
}

// ── Load Lessons from Backend ─────────────────────────────────
async function loadLessonsFromBackend() {
    try {
        const res = await fetch(`${API_URL}/platform-data`);
        if (!res.ok) return;
        platformDB = await res.json();
        lessonsList = []; unitsList = [];
        if (platformDB?.classes && currentUser) {
            const cls = platformDB.classes[currentUser.classId];
            if (cls?.groups?.[currentUser.groupId]) {
                const grp = cls.groups[currentUser.groupId];
                for (const crId in (grp.courses || {})) {
                    for (const term of ['term1', 'term2']) {
                        const units = grp.courses[crId][term]?.units || {};
                        for (const uId in units) {
                            const unit = units[uId];
                            const unitObj = { id: uId, title: unit.title, term, lessons: [], desc: unit.desc || '' };
                            for (const lId in (unit.lessons || {})) {
                                const lesson = { ...unit.lessons[lId], _term: term, _unitId: uId, _unit: unit.title || '', _class: cls.name || '' };
                                if (!lesson.id) lesson.id = lId;
                                lessonsList.push(lesson);
                                unitObj.lessons.push(lesson);
                            }
                            unitsList.push(unitObj);
                        }
                    }
                }
            }
        }
        renderSidebarUnits();
        renderDashboard();
    } catch (e) { console.warn('Backend offline', e); }
}

// ── Sidebar Units ─────────────────────────────────────────────
function renderSidebarUnits() {
    const container = document.getElementById('dynamic-menu-units');
    if (!container) return;
    container.innerHTML = '';
    unitsList.forEach(u => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-layer-group"></i> ${u.title}`;
        li.onclick = () => showUnitView(u.id, li);
        container.appendChild(li);
    });
}

// ── Dashboard Render ──────────────────────────────────────────
function renderDashboard(filterTerm = null) {
    if (!currentUser) return;
    const completed = currentUser.completedLessons || [];
    const total = lessonsList.length;
    const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

    // Progress
    setEl('overall-fill', 'style.width', pct + '%');
    setEl('overall-pct', 'textContent', pct + '%');
    setEl('overall-text', 'textContent', `أنجزت ${completed.length} دروس من أصل ${total}`);
    updateGamificationDisplay();
    renderHonorBoard();

    // Daily goal (simple: 1 lesson/day)
    const todayCount = completed.length > 0 ? 1 : 0; // Simplified
    setEl('daily-goal-badge', 'textContent', `${Math.min(todayCount, 1)}/1`);
    setEl('daily-goal-fill', 'style.width', (todayCount >= 1 ? '100' : '0') + '%');

    // Continue learning card — show next lesson or last lesson
    const nextLesson = getNextLesson();
    if (nextLesson) {
        const isNext = nextLesson._isNext || (currentUser?.completedLessons || []).length === 0;
        setEl('last-lesson-name', 'textContent', nextLesson.title);
        setEl('last-lesson-unit', 'textContent', nextLesson._unit || '');
        setEl('continue-card-label', 'textContent', isNext ? 'الدرس التالي عليك 🚀' : 'آخر درس وصلت إليه');
    } else {
        setEl('last-lesson-name', 'textContent', 'لا يوجد دروس حالياً');
        setEl('last-lesson-unit', 'textContent', '');
        setEl('continue-card-label', 'textContent', 'أكمل تعلمك');
    }

    // Upcoming Live Class
    renderUpcomingLiveCard();

    // AI suggestion
    const suggestions = [
        'أنصحك بمراجعة آخر درس لتثبيت المعلومات 💡',
        'يلا نفهم ونحل 🎯',
        'لا تنسى مشاهدة الخريطة الذهنية لتنظيم أفكارك 🧠',
        'أنت تتقدم بشكل رائع! استمر 🚀',
    ];
    setEl('ai-suggestion-text', 'textContent', suggestions[completed.length % suggestions.length]);

    // Units Grid
    const grid = document.getElementById('home-units-grid');
    if (grid) {
        grid.innerHTML = '';
        const filtered = filterTerm ? unitsList.filter(u => u.term === filterTerm) : unitsList;
        setEl('units-section-title', 'textContent', filterTerm ? `وحدات ${filterTerm === 'term1' ? 'الترم الأول' : 'الترم الثاني'}` : 'جميع الوحدات المتاحة لك');
        filtered.forEach(u => {
            const done = u.lessons.filter(l => completed.includes(l.id)).length;
            const uPct = u.lessons.length > 0 ? Math.round((done / u.lessons.length) * 100) : 0;
            grid.innerHTML += `
                <div class="card card-interactive" onclick="showUnitView('${u.id}')">
                    <div class="card-title">${u.title}</div>
                    <div class="card-desc">${u.lessons.length} درس • ${u.term === 'term1' ? 'الترم الأول' : 'الترم الثاني'}</div>
                    <div class="progress-bar" style="margin-top:14px;">
                        <div class="progress-fill" style="width:${uPct}%;"></div>
                    </div>
                    <p class="fs-sm text-muted" style="margin-top:8px;">${uPct}% مكتمل (${done}/${u.lessons.length})</p>
                </div>`;
        });
    }
}

function filterUnitsByTerm(term) {
    renderDashboard(term);
    document.getElementById('units-section')?.scrollIntoView({ behavior: 'smooth' });
}

async function renderHonorBoard() {
    const card = document.getElementById('honor-board-card');
    const container = document.getElementById('honor-board-students');
    const label = document.getElementById('honor-group-label');
    if (!card || !container || !currentUser) return;

    const classId = currentUser.classId;
    const groupId = currentUser.groupId;
    if (!classId || !groupId) { card.style.display = 'none'; return; }

    try {
        const res = await fetch(`${API_URL}/honor-board`);
        const data = await res.json();
        if (!data.success) { card.style.display = 'none'; return; }

        const key = `${classId}_${groupId}`;
        const entry = data.honorBoard?.[key];
        if (!entry || !entry.students || entry.students.length === 0) {
            card.style.display = 'none';
            return;
        }

        const groupName = platformDB?.classes?.[classId]?.groups?.[groupId]?.name || '';
        const className = platformDB?.classes?.[classId]?.name || '';
        label.textContent = `${className} — ${groupName}`;

        const medals = ['🥇', '🥈', '🥉'];
        const medalColors = [
            'linear-gradient(135deg,rgba(234,179,8,0.25),rgba(234,179,8,0.05))',
            'linear-gradient(135deg,rgba(148,163,184,0.2),rgba(100,116,139,0.05))',
            'linear-gradient(135deg,rgba(194,120,61,0.2),rgba(161,88,36,0.05))'
        ];
        const borderColors = ['rgba(234,179,8,0.5)', 'rgba(148,163,184,0.4)', 'rgba(194,120,61,0.4)'];

        container.innerHTML = entry.students.map((s, i) => {
            const medalEmoji = ['🥇', '🥈', '🥉'][i];
            const rankLabel = ['\u0627\u0644\u0623\u0648\u0644', '\u0627\u0644\u062b\u0627\u0646\u064a', '\u0627\u0644\u062b\u0627\u0644\u062b'][i];
            const bgColors = [
                'linear-gradient(180deg,rgba(234,179,8,0.2) 0%,rgba(234,179,8,0.05) 100%)',
                'linear-gradient(180deg,rgba(148,163,184,0.15) 0%,rgba(148,163,184,0.03) 100%)',
                'linear-gradient(180deg,rgba(194,120,61,0.15) 0%,rgba(161,88,36,0.03) 100%)'
            ];
            const borderAccents = ['#facc15', '#94a3b8', '#cd7f32'];
            return `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:10px;
                        padding:20px 12px 18px; text-align:center;
                        background:${bgColors[i]};
                        border-right:${i < entry.students.length - 1 ? '1px solid rgba(234,179,8,0.12)' : 'none'};
                        position:relative;">
                <div style="font-size:28px; margin-bottom:-4px;">${medalEmoji}</div>
                <div style="width:68px;height:68px;border-radius:50%;overflow:hidden;
                            border:3px solid ${borderAccents[i]};
                            box-shadow:0 0 16px ${borderAccents[i]}55;
                            background:rgba(0,0,0,0.4);
                            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    ${s.avatar
                    ? `<img src="${s.avatar}" style="width:100%;height:100%;object-fit:cover;">`
                    : `<span style="font-size:26px;font-weight:900;color:${borderAccents[i]};">${(s.name || '?').charAt(0)}</span>`}
                </div>
                <div style="font-weight:900;font-size:15px;color:#fff;line-height:1.3;">${s.name}</div>
                <div style="font-size:11px;color:${borderAccents[i]};font-weight:700;
                            background:rgba(0,0,0,0.3);border-radius:20px;padding:3px 10px;">
                    ${rankLabel} · ${s.xp || 0} XP ⭐
                </div>
            </div>`;
        }).join('');

        card.style.display = 'block';
    } catch (e) {
        card.style.display = 'none';
        console.warn('Honor board fetch failed', e);
    }
}
// ── Smart Next Lesson Logic ───────────────────────────────────
function getNextLesson() {
    const completed = currentUser?.completedLessons || [];

    if (lessonsList.length === 0) return null;

    if (completed.length === 0) {
        // Never attended any lesson → return first lesson
        return lessonsList[0];
    }

    // Find the index of the last completed lesson in the ordered list
    const lastCompletedId = completed[completed.length - 1];
    const lastIdx = lessonsList.findIndex(l => l.id === lastCompletedId);

    // Look for the next uncompleted lesson after the last completed one
    if (lastIdx !== -1 && lastIdx + 1 < lessonsList.length) {
        const nextLesson = lessonsList[lastIdx + 1];
        if (!completed.includes(nextLesson.id)) {
            return { ...nextLesson, _isNext: true };
        }
    }

    // No next lesson found → return the last completed lesson (for review)
    const lastLesson = lessonsList.find(l => l.id === lastCompletedId);
    return lastLesson || lessonsList[0];
}

function resumeLastLesson() {
    const lesson = getNextLesson();
    if (lesson) openLesson(lesson.id);
}

// ── Unit View ─────────────────────────────────────────────────
function showUnitView(unitId, menuItem) {
    const unit = unitsList.find(u => u.id === unitId);
    if (!unit) return;
    navigateTo('unit', menuItem);
    setEl('unit-view-title', 'textContent', unit.title);
    setEl('unit-view-subtitle', 'textContent', `${unit.term === 'term1' ? 'الترم الأول' : 'الترم الثاني'} • ${unit.lessons.length} دروس`);

    const container = document.getElementById('unit-lessons-list');
    container.innerHTML = '';
    const completed = currentUser?.completedLessons || [];

    unit.lessons.forEach((l, i) => {
        const done = completed.includes(l.id);
        const zones = [];
        if (l.videoZone?.url) zones.push('<div class="zone-icon" title="فيديو"><i class="fas fa-video"></i></div>');
        if (l.ailessonZone?.html || l.ailessonZone?.driveLink) zones.push('<div class="zone-icon" title="الدرس الذكي"><i class="fas fa-magic"></i></div>');
        if (l.podcastZone?.url) zones.push('<div class="zone-icon" title="بودكاست"><i class="fas fa-microphone"></i></div>');
        if (l.mindscapeZone?.url) zones.push('<div class="zone-icon" title="خريطة"><i class="fas fa-brain"></i></div>');
        if (l.gameZone?.url) zones.push('<div class="zone-icon" title="لعبة"><i class="fas fa-gamepad"></i></div>');
        if (l.quizZone?.url) zones.push('<div class="zone-icon" title="اختبار"><i class="fas fa-clipboard-check"></i></div>');

        container.innerHTML += `
            <div class="lesson-card ${done ? 'completed' : ''}" onclick="openLesson('${l.id}')">
                <div style="flex:1;">
                    <h3 class="fw-700" style="font-size:15px; margin-bottom:6px;">${l.title || 'درس'}</h3>
                    <div class="flex items-center gap-12">
                        <span class="fs-sm text-muted"><i class="far fa-clock"></i> ${l.duration || '--'} دقيقة</span>
                        <div class="zone-icons">${zones.join('')}</div>
                    </div>
                </div>
                <div class="flex items-center gap-12">
                    ${done ? '<span class="badge badge-success"><i class="fas fa-check"></i> مكتمل</span>' : ''}
                    <button class="play-btn" style="width:40px;height:40px;font-size:14px;">
                        <i class="fas fa-${done ? 'redo' : 'play'}" style="margin-right:-1px;"></i>
                    </button>
                </div>
            </div>`;
    });
}

// ── Lesson View (Sequential Steps) ───────────────────────────
function getYouTubeID(url) {
    if (!url) return null;
    const trimmed = url.trim();
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/);
    return match ? match[1] : null;
}

function getEmbedUrl(url) {
    if (!url) return '';

    // If user pasted an entire <iframe> code (e.g., from OneDrive/SharePoint), extract the src link
    let finalUrl = url.trim();
    if (finalUrl.toLowerCase().startsWith('<iframe')) {
        const match = finalUrl.match(/src=["']([^"']+)["']/i);
        if (match) {
            finalUrl = match[1];
        }
    }

    // YouTube — extract ID and convert to embed format
    const videoID = getYouTubeID(finalUrl);
    if (videoID) {
        return `https://www.youtube-nocookie.com/embed/${videoID}`;
    }

    // Google Drive Detection
    if (finalUrl.includes('drive.google.com')) {
        if (finalUrl.includes('view')) {
            return finalUrl.replace(/\/view.*/, '/preview');
        } else if (finalUrl.includes('open?id=')) {
            return finalUrl.replace('open?id=', 'file/d/') + '/preview';
        }
    }

    // OneDrive & SharePoint Detection
    if (finalUrl.includes('onedrive.live.com') || finalUrl.includes('1drv.ms') || finalUrl.includes('sharepoint.com')) {
        if (finalUrl.includes('view.aspx')) {
            return finalUrl.replace('view.aspx', 'embed');
        } else if (finalUrl.includes('embed.aspx')) {
            return finalUrl; // Already a perfect embed link
        } else {
            const separator = finalUrl.includes('?') ? '&' : '?';
            return finalUrl.includes('action=embedview') ? finalUrl : finalUrl + separator + 'action=embedview';
        }
    }

    // Google Forms Detection
    if (finalUrl.includes('docs.google.com/forms')) {
        if (!finalUrl.includes('embedded=true')) {
            const separator = finalUrl.includes('?') ? '&' : '?';
            return finalUrl + separator + 'embedded=true';
        }
    }

    return finalUrl;
}

// يلا نتعلم 🚀 — opens the teacher-attached file in a new tab
function openLetsLearnFile() {
    const btnWrap = document.getElementById('lets-learn-btn-wrap');
    const url = btnWrap?.dataset?.learnFile || '';
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

async function openLesson(id) {
    // Refresh lesson data silently in background WITHOUT blocking lesson render.
    // This ensures the student sees the teacher's latest edits on every visit.
    fetch(`${API_URL}/platform-data`)
        .then(r => r.ok ? r.json() : null)
        .then(freshData => {
            if (freshData?.classes) {
                platformDB = freshData;
                // Silently rebuild lessonsList so next openLesson call has fresh data
                lessonsList = []; unitsList = [];
                if (platformDB?.classes && currentUser) {
                    const cls = platformDB.classes[currentUser.classId];
                    if (cls?.groups?.[currentUser.groupId]) {
                        const grp = cls.groups[currentUser.groupId];
                        for (const crId in (grp.courses || {})) {
                            for (const term of ['term1', 'term2']) {
                                const units = grp.courses[crId][term]?.units || {};
                                for (const uId in units) {
                                    const unit = units[uId];
                                    const unitObj = { id: uId, title: unit.title, term, lessons: [], desc: unit.desc || '' };
                                    for (const lId in (unit.lessons || {})) {
                                        const lesson = { ...unit.lessons[lId], _term: term, _unitId: uId, _unit: unit.title || '', _class: cls.name || '' };
                                        if (!lesson.id) lesson.id = lId;
                                        lessonsList.push(lesson);
                                        unitObj.lessons.push(lesson);
                                    }
                                    unitsList.push(unitObj);
                                }
                            }
                        }
                    }
                }
            }
        })
        .catch(() => {}); // silent fail — offline is ok

    const lesson = lessonsList.find(l => l.id === id);
    if (!lesson) return;


    currentLessonObj = lesson;
    // Reset Quiz state for the new lesson
    currentQuizScore = null;
    currentQuizAnswers = [];
    currentQuizAttempt = null;

    setEl('lesson-page-title', 'textContent', lesson.title || '');
    setEl('lesson-main-title', 'textContent', lesson.title || '');
    setEl('lesson-page-subtitle', 'textContent', `${lesson._unit || ''} • ${lesson._class || ''}`);

    const backBtn = document.getElementById('lesson-back-btn');
    backBtn.onclick = () => {
        const unit = unitsList.find(u => u.id === lesson._unitId);
        if (unit) showUnitView(unit.id);
        else navigateTo('dashboard');
    };

    currentLessonSteps = [];
    const zones = { video: lesson.videoZone, podcast: lesson.podcastZone, mindscape: lesson.mindscapeZone, game: lesson.gameZone, quiz: lesson.quizZone, ailesson: lesson.ailessonZone };

    if (zones.video?.url) currentLessonSteps.push({ key: 'video', icon: 'fa-play-circle', label: 'الفيديو' });
    if (zones.ailesson?.html || zones.ailesson?.driveLink) currentLessonSteps.push({ key: 'ailesson', icon: 'fa-magic', label: 'الدرس الذكي' });
    if (zones.mindscape?.url) currentLessonSteps.push({ key: 'mindscape', icon: 'fa-brain', label: 'الخريطة الذهنية' });
    if (zones.game?.url) currentLessonSteps.push({ key: 'game', icon: 'fa-gamepad', label: 'الألعاب التعليمية' });
    if (zones.quiz?.url || zones.quiz?.nativeData) currentLessonSteps.push({ key: 'quiz', icon: 'fa-clipboard-check', label: 'الاختبار' });
    if (zones.podcast?.url) currentLessonSteps.push({ key: 'podcast', icon: 'fa-podcast', label: 'بودكاست' });

    if (currentLessonSteps.length < 2 && !zones.video?.url && !zones.quiz?.url && !zones.quiz?.nativeData && (!zones.ailesson?.html && !zones.ailesson?.driveLink)) {
        currentLessonSteps = [
            { key: 'video', icon: 'fa-play-circle', label: 'الفيديو' },
            { key: 'quiz', icon: 'fa-clipboard-check', label: 'الاختبار' },
        ];
    }

    if (zones.video?.url) {
        const videoFrame = document.getElementById('lesson-video-frame');
        const rawVideoUrl = zones.video.url;
        const embedUrl = getEmbedUrl(rawVideoUrl);
        setEl('video-zone-title', 'textContent', zones.video.title || 'شرح الدرس');
        document.getElementById('video-embed-fallback')?.remove();
        const isYouTube = rawVideoUrl.includes('youtube.com') || rawVideoUrl.includes('youtu.be') || getYouTubeID(rawVideoUrl);
        if (isYouTube && !getYouTubeID(rawVideoUrl)) {
            videoFrame.style.display = 'none';
            setupVideoInvalidFallback();
        } else {
            videoFrame.src = embedUrl;
            videoFrame.style.display = 'block';
            window._ytErrHandler && window.removeEventListener('message', window._ytErrHandler);
            window._ytErrHandler = function (e) {
                try {
                    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                    if (data?.info?.error) { setupVideoFallback(); window.removeEventListener('message', window._ytErrHandler); }
                } catch (_) { }
            };
            window.addEventListener('message', window._ytErrHandler);
        }

        // يلا نتعلم Button visibility
        const learnFile = zones.video.learnFile || '';
        const btnWrap = document.getElementById('lets-learn-btn-wrap');
        if (btnWrap) {
            btnWrap.style.display = learnFile ? 'block' : 'none';
            btnWrap.dataset.learnFile = learnFile;
        }
    } else {
        // Hide يلا نتعلم if no video zone
        const btnWrap = document.getElementById('lets-learn-btn-wrap');
        if (btnWrap) { btnWrap.style.display = 'none'; btnWrap.dataset.learnFile = ''; }
    }

    if (zones.ailesson?.html || zones.ailesson?.driveLink) {
        const studentFrame = document.getElementById('ailesson-student-frame');
        const driveFrame = document.getElementById('ailesson-drive-frame');
        const driveExternalLink = document.getElementById('ailesson-drive-external-link');
        const studentContainer = document.getElementById('ailesson-student-container');
        const driveContainer = document.getElementById('ailesson-drive-container');

        if (zones.ailesson?.html) {
            studentFrame.srcdoc = zones.ailesson.html;
            studentContainer.style.display = 'block';
        } else {
            studentFrame.srcdoc = '';
            studentContainer.style.display = 'none';
        }

        if (zones.ailesson?.driveLink) {
            driveFrame.src = getEmbedUrl(zones.ailesson.driveLink);
            if (driveExternalLink) driveExternalLink.href = zones.ailesson.driveLink;
            driveContainer.style.display = 'block';
        } else {
            driveFrame.src = '';
            if (driveExternalLink) driveExternalLink.href = '#';
            driveContainer.style.display = 'none';
        }
    }

    if (zones.mindscape?.url) {
        const url = zones.mindscape.url;
        setEl('mindscape-title', 'textContent', zones.mindscape.title || 'الملخص البصري');

        const imgEl = document.getElementById('mindscape-img');
        const frameEl = document.getElementById('mindscape-frame');
        const fallbackEl = document.getElementById('mindmap-fallback');

        // Reset visibility
        imgEl.classList.add('hidden');
        frameEl.classList.add('hidden');
        fallbackEl.classList.add('hidden');

        // Check for direct image extensions
        const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url.split('?')[0]);

        if (isImage) {
            imgEl.src = url;
            imgEl.classList.remove('hidden');
        } else {
            // Use smart embed for PDF, Google Drive, OneDrive, etc.
            frameEl.src = getEmbedUrl(url);
            frameEl.classList.remove('hidden');
        }
    }

    if (zones.game?.url) {
        const gameContainer = document.getElementById('games-container');
        if (gameContainer) {
            gameContainer.innerHTML = '';
            const urls = (zones.game.url || '').split('\n').map(u => u.trim()).filter(Boolean);
            if (urls.length > 0) {
                const btnGroup = document.createElement('div');
                btnGroup.className = 'game-btn-group mb-24';
                const funIcons = ['fa-gamepad', 'fa-puzzle-piece', 'fa-dice', 'fa-ghost', 'fa-rocket'];
                const funGradients = ['linear-gradient(135deg, #4facfe, #00f2fe)', 'linear-gradient(135deg, #43e97b, #38f9d7)', 'linear-gradient(135deg, #fa709a, #fee140)', 'linear-gradient(135deg, #b12a5b, #ff8177)'];
                const iframe = document.createElement('iframe');
                iframe.className = 'content-frame';
                iframe.src = getEmbedUrl(urls[0]);
                urls.forEach((u, i) => {
                    const btn = document.createElement('button');
                    btn.className = i === 0 ? 'game-btn active' : 'game-btn inactive';
                    btn.style.background = funGradients[i % funGradients.length];
                    btn.innerHTML = `<i class="fas ${funIcons[i % funIcons.length]}"></i> <span>اللعبة ${i + 1}</span>`;
                    btn.onclick = () => {
                        iframe.src = getEmbedUrl(u);
                        Array.from(btnGroup.children).forEach(b => { b.classList.remove('active'); b.classList.add('inactive'); });
                        btn.classList.add('active'); btn.classList.remove('inactive');
                    };
                    btnGroup.appendChild(btn);
                });
                if (urls.length > 1) gameContainer.appendChild(btnGroup);
                gameContainer.appendChild(iframe);
            }
        }
    }

    if (zones.quiz) {
        const quizContainer = document.getElementById('quiz-container');
        if (quizContainer) {
            quizContainer.innerHTML = '';
            if (zones.quiz.nativeData) {
                renderNativeQuiz(zones.quiz.nativeData, quizContainer);
                const iframe = document.getElementById('quiz-frame');
                if (iframe) iframe.classList.add('hidden');
            } else if (zones.quiz.url) {
                const urls = zones.quiz.url.split('\n').map(u => u.trim()).filter(Boolean);
                if (urls.length > 0) {
                    const btnGroup = document.createElement('div');
                    btnGroup.style.cssText = 'display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; justify-content:center;';
                    const quizIcons = ['fa-file-alt', 'fa-question-circle', 'fa-pencil-alt', 'fa-graduation-cap'];
                    const quizGradients = ['linear-gradient(135deg, #f59e0b, #d97706)', 'linear-gradient(135deg, #3b82f6, #2563eb)', 'linear-gradient(135deg, #10b981, #059669)', 'linear-gradient(135deg, #8b5cf6, #7c3aed)'];
                    const iframe = document.getElementById('quiz-frame');
                    if (iframe) {
                        iframe.src = getEmbedUrl(urls[0]);
                        iframe.classList.remove('hidden');
                        urls.forEach((u, i) => {
                            const btn = document.createElement('button');
                            btn.className = i === 0 ? 'game-btn active' : 'game-btn inactive';
                            btn.style.background = quizGradients[i % quizGradients.length];
                            btn.innerHTML = `<i class="fas ${quizIcons[i % quizIcons.length]}"></i> <span>الاختبار ${i + 1}</span>`;
                            btn.onclick = () => {
                                iframe.src = getEmbedUrl(u);
                                Array.from(btnGroup.children).forEach(b => { b.classList.remove('active'); b.classList.add('inactive'); });
                            };
                            btnGroup.appendChild(btn);
                        });
                        if (urls.length > 1) {
                            quizContainer.appendChild(btnGroup);
                        }
                    }
                }
            }
        }
    }

    if (zones.podcast?.url) document.getElementById('podcast-frame').src = getEmbedUrl(zones.podcast.url);

    // Render step tracker
    currentStepIndex = 0;
    renderStepTracker();

    // Show lesson view
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-lesson').classList.remove('hidden');
    document.getElementById('view-lesson').dataset.lessonId = id;
    showStep(0);
}

function renderStepTracker() {
    const tracker = document.getElementById('step-tracker');
    tracker.innerHTML = '';
    const isFullyCompleted = currentUser?.completedLessons?.includes(currentLessonObj.id);

    currentLessonSteps.forEach((step, i) => {
        const isActive = i === currentStepIndex;
        const isCompleted = isFullyCompleted || i < currentStepIndex;
        const isLocked = !isFullyCompleted && i > currentStepIndex;
        tracker.innerHTML += `
            <div class="step-item ${isActive ? 'active' : ''} ${isCompleted && !isActive ? 'completed' : ''} ${isLocked ? 'locked' : ''}"
                 onclick="${isLocked ? '' : `showStep(${i})`}">
                <i class="fas ${isCompleted && !isActive ? 'fa-check-circle' : step.icon}"></i>
                <span>${step.label}</span>
            </div>`;
    });
}

function showStep(index) {
    const isFullyCompleted = currentUser?.completedLessons?.includes(currentLessonObj.id);

    if (!isFullyCompleted && index > currentStepIndex) return; // Can't skip ahead

    const step = currentLessonSteps[index];
    if (!step) return;

    // Hide all sections
    document.querySelectorAll('.lesson-section').forEach(s => s.classList.add('hidden'));
    const targetSection = document.getElementById('section-' + step.key);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        // Update button text if it's the last step
        const btn = targetSection.querySelector('.complete-step-btn');
        if (btn) {
            if (index === currentLessonSteps.length - 1) {
                btn.innerHTML = '<i class="fas fa-flag-checkered"></i> إنهاء الدرس وحفظ التقدم';
                btn.classList.add('finish-btn');
            } else {
                btn.innerHTML = '<i class="fas fa-check-circle"></i> الخطوة التالية';
                btn.classList.remove('finish-btn');
            }
        }
    }

    // Pause Video if moving away from video step
    if (step.key !== 'video') {
        const videoFrame = document.getElementById('lesson-video-frame');
        if (videoFrame && videoFrame.src && !videoFrame.classList.contains('hidden')) {
            if (videoFrame.src.includes('youtube')) {
                videoFrame.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            } else {
                // For Google Drive/Generic: resetting SRC reloads the frame (stops sound)
                videoFrame.src = videoFrame.src;
            }
        }
    }

    // Update active index
    currentStepIndex = index;
    renderStepTracker();
}

function completeCurrentStep() {
    if (currentStepIndex < currentLessonSteps.length - 1) {
        currentStepIndex++;
        renderStepTracker();
        showStep(currentStepIndex);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        completeLesson();
    }
}


// ── Complete Lesson ───────────────────────────────────────────
async function completeLesson() {
    const lessonId = document.getElementById('view-lesson').dataset.lessonId;
    // Use either .id or ._id as fallback
    const uid = currentUser?.id || currentUser?._id;

    if (!lessonId || !uid) {
        console.error("Missing Lesson ID or User ID", { lessonId, uid });
        return;
    }

    if (currentUser.completedLessons?.includes(lessonId) && !currentQuizScore) {
        navigateTo('dashboard');
        return;
    }

    // Add loading state to all finish buttons
    const finishBtns = document.querySelectorAll('.complete-step-btn');
    finishBtns.forEach(b => {
        if (b.classList.contains('finish-btn')) {
            b.disabled = true;
            b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ حفظ التقدم...';
        }
    });

    try {
        const xpReward = currentLessonObj?.xpReward || 50;
        const res = await fetch(`${API_URL}/users/${uid}/progress`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lessonId, xpReward, score: currentQuizScore, answers: currentQuizAnswers })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            currentUser.completedLessons = data.completedLessons;
            currentUser.xp = data.xp;
            currentUser.quizScores = data.quizScores;
            currentUser.quizAnswers = data.quizAnswers;
            localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));

            // Navigate back HOME first, then show celebration
            navigateTo('dashboard');
            showCompletionCelebration(xpReward);
        } else {
            alert("⚠️ فشل حفظ التقدم: " + (data.msg || data.error || "خطأ غير معروف"));
        }
    } catch (e) {
        console.error("Complete Lesson Error:", e);
        alert("⚠️ حدث خطأ في الاتصال بالسيرفر أثناء حفظ التقدم.");
    } finally {
        finishBtns.forEach(b => {
            if (b.classList.contains('finish-btn')) {
                b.disabled = false;
                b.innerHTML = '<i class="fas fa-flag-checkered"></i> إنهاء الدرس وحفظ التقدم';
            }
        });
    }
}

function showCompletionCelebration(xp) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(7,6,14,0.9);z-index:3000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease;';
    overlay.innerHTML = `
        <div style="text-align:center; animation:fadeInScale 0.5s ease;">
            <div style="font-size:60px; margin-bottom:16px;">🎉</div>
            <h2 style="font-size:28px; font-weight:900; margin-bottom:8px;">أحسنت يا بطل!</h2>
            <p style="color:var(--text-secondary); margin-bottom:20px;">أكملت الدرس بنجاح</p>
            <div style="display:flex; gap:20px; justify-content:center; margin-bottom:24px;">
                <div style="background:var(--bg-card); padding:16px 24px; border-radius:12px;">
                    <div style="color:var(--xp-gold); font-size:24px; font-weight:800;">+${xp}</div>
                    <div style="font-size:12px; color:var(--text-muted);">نقاط XP</div>
                </div>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:20px;">(انقر في أي مكان للإغلاق والمتابعة)</div>
        </div>`;
    overlay.onclick = () => { overlay.remove(); navigateTo('dashboard'); };
    document.body.appendChild(overlay);
}

// ── Navigation ────────────────────────────────────────────────
function navigateTo(viewId, menuItem) {
    // If leaving a lesson/quiz in progress, auto-submit result.
    if (viewId !== 'lesson' && currentQuizAttempt && currentQuizAttempt.status === 'in-progress') {
        submitNativeQuiz();
    }
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById('view-' + viewId);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.menu li').forEach(li => li.classList.remove('active'));
    if (menuItem) menuItem.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    // Render page-specific content
    if (viewId === 'progress') renderProgressPage();
    if (viewId === 'achievements') renderAchievements();
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'chat-human') {
        switchHumanChat('group');
        const badge = document.getElementById('unread-human-total');
        if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
    }
}

// ── Progress Page ─────────────────────────────────────────────
function renderProgressPage() {
    if (!currentUser) return;
    const completed = currentUser.completedLessons || [];
    const total = lessonsList.length;
    const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    // Ring
    const circle = document.getElementById('progress-ring-circle');
    if (circle) { const offset = 314 - (314 * pct / 100); circle.setAttribute('stroke-dashoffset', offset); }
    setEl('ring-pct', 'textContent', pct + '%');
    setEl('progress-total-xp', 'textContent', currentUser.xp || 0);
    setEl('progress-completed-count', 'textContent', completed.length);
    // Unit details
    const container = document.getElementById('progress-units-detail');
    container.innerHTML = '';
    unitsList.forEach(u => {
        const done = u.lessons.filter(l => completed.includes(l.id)).length;
        const uPct = u.lessons.length > 0 ? Math.round((done / u.lessons.length) * 100) : 0;
        container.innerHTML += `
            <div class="card" style="margin-bottom:12px;">
                <div class="flex justify-between items-center mb-8">
                    <span class="fw-700">${u.title}</span>
                    <span class="badge badge-primary">${uPct}%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${uPct}%;"></div></div>
                <p class="fs-sm text-muted" style="margin-top:6px;">${done} / ${u.lessons.length} دروس مكتملة</p>
            </div>`;
    });
}

// ── Achievements Page ─────────────────────────────────────────
function renderAchievements() {
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
        const unlocked = currentUser ? a.condition(currentUser) : false;
        grid.innerHTML += `
            <div class="achievement-card ${unlocked ? '' : 'locked'}">
                <div class="achievement-icon">${a.icon}</div>
                <h4 class="fw-700" style="font-size:14px;">${a.title}</h4>
                <p class="fs-sm text-muted">${a.desc}</p>
                ${unlocked ? '<div class="badge badge-success mt-16" style="font-size:10px;"><i class="fas fa-check"></i> مُنجَز</div>' : '<div class="badge badge-warning mt-16" style="font-size:10px;"><i class="fas fa-lock"></i> مقفول</div>'}
            </div>`;
    });
}

// ── Chat ──────────────────────────────────────────────────────
let currentSessionId = null;

async function startNewChatUI() {
    if (!currentUser) return;
    try {
        const h = document.getElementById('chat-history');
        h.innerHTML = `<div class="msg bot"><i class="fas fa-spinner fa-spin"></i> بجهّز لك محادثة جديدة...</div>`;

        const res = await fetch(`${API_URL}/chat/session/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        const data = await res.json();
        if (data.success) {
            currentSessionId = data.sessionId;
            chatMessages = [];
            h.innerHTML = `<div class="msg bot">جاهز للفهم العميق؟ 💪 اسأل أي سؤال، وسنستكشف الإجابة معًا!</div>`;
        }
    } catch (e) { console.error('New Chat Error:', e); }
}

async function openChatHistory() {
    if (!currentUser) return;
    const h = document.getElementById('chat-history');
    h.innerHTML = `<div class="msg bot"><i class="fas fa-history"></i> جارِ تحميل سجل المحادثات...</div>`;

    try {
        const res = await fetch(`${API_URL}/chat/history/${currentUser.id}`);
        const sessions = await res.json();

        if (sessions && sessions.length > 0) {
            h.innerHTML = `<h4 class="mb-16">سجل المحادثات (آخر 15 يوم)</h4>`;
            sessions.forEach(s => {
                const date = new Date(s.createdAt).toLocaleString('ar-EG');
                const lastMsg = s.messages.length > 0 ? s.messages[s.messages.length - 1].text.substring(0, 40) + '...' : 'محادثة فارغة';

                const card = document.createElement('div');
                card.className = 'card mb-12';
                card.style.cursor = 'pointer';
                card.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div class="fs-sm fw-700">${date}</div>
                        <div class="badge badge-primary">${s.messages.length} رسالة</div>
                    </div>
                    <div class="fs-xs text-muted mt-8">${lastMsg}</div>
                `;
                card.onclick = () => loadSession(s);
                h.appendChild(card);
            });
        } else {
            h.innerHTML = `<div class="msg bot">لا يوجد محادثات سابقة مخزنة حالياً.</div>`;
        }
    } catch (e) { h.innerHTML = `<div class="msg bot text-danger">حدث خطأ أثناء تحميل السجل.</div>`; }
}

function loadSession(session) {
    const h = document.getElementById('chat-history');
    currentSessionId = session.id;
    chatMessages = session.messages.map(m => ({ isUser: m.isUser, text: m.text }));
    h.innerHTML = ``;
    chatMessages.forEach(m => {
        const type = m.isUser ? 'user' : 'bot';
        const formatted = m.text.replace(/\n/g, '<br>');
        const div = document.createElement('div');
        div.className = `msg ${type}`;
        div.innerHTML = formatted;
        h.appendChild(div);

        // Render math if any
        if (!m.isUser && window.renderMathInElement) {
            renderMathInElement(div, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        }
    });
    h.scrollTop = h.scrollHeight;
}

function toggleChat() {
    const modal = document.getElementById('chat-modal');
    const wasActive = modal.classList.contains('active');
    modal.classList.toggle('active');

    // User Requirement: Opening and Closing triggers New Chat
    if (!wasActive) {
        startNewChatUI();
    }
}
async function insertMath(sym) { const f = document.getElementById('chat-field'); f.value += sym; f.focus(); }

async function sendMsg() {
    const f = document.getElementById('chat-field');
    const val = f.value.trim();
    if (!val) return;
    const h = document.getElementById('chat-history');

    // User Message
    h.innerHTML += `<div class="msg user">${escapeHtml(val)}</div>`;
    chatMessages.push({ isUser: true, text: val });
    f.value = '';
    h.scrollTop = h.scrollHeight;

    // Typing indicator
    const typingId = 'typing-' + Date.now();
    setTimeout(() => {
        if (!document.getElementById(typingId)) {
            h.innerHTML += `<div id="${typingId}" class="msg bot" style="opacity:0.6;"><i class="fas fa-ellipsis-h fa-beat-fade"></i> يكتب...</div>`;
            h.scrollTop = h.scrollHeight;
        }
    }, 100);

    try {
        // Get student grade name for context
        let studentGrade = 'غير محدد';
        if (currentUser?.classId && platformDB?.classes?.[currentUser.classId]) {
            studentGrade = platformDB.classes[currentUser.classId].name;
        }

        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: val,
                history: chatMessages.slice(-10),
                studentGrade: studentGrade,
                userId: currentUser?.id,
                sessionId: currentSessionId
            })
        });

        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        if (res.ok) {
            const data = await res.json();
            const reply = data.reply;

            const botMsg = document.createElement('div');
            botMsg.className = 'msg bot';
            // Use marked if available, otherwise fallback
            botMsg.innerHTML = (window.marked) ? marked.parse(reply) : reply.replace(/\n/g, '<br>');
            h.appendChild(botMsg);

            // Render Math with KaTeX
            if (window.renderMathInElement) {
                renderMathInElement(botMsg, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            }

            chatMessages.push({ isUser: false, text: reply });
        } else {
            h.innerHTML += `<div class="msg bot" style="color:var(--danger);">⚠️ تعذر الاتصال بالمعلم الذكي. حاول مرة أخرى.</div>`;
        }

    } catch (e) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        console.error('Chat Error:', e);
        h.innerHTML += `<div class="msg bot" style="color:var(--danger);">⚠️ حدث خطأ في الاتصال بالخادم.</div>`;
    }

    h.scrollTop = h.scrollHeight;
    localStorage.setItem(CHAT_KEY, h.innerHTML);
}
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// ── Video Embed Fallback (Error 153 / blocked embeds) ─────────
function setupVideoFallback() {
    const videoFrame = document.getElementById('lesson-video-frame');
    const container = videoFrame?.parentElement;
    if (!container) return;
    if (document.getElementById('video-embed-fallback')) return;
    videoFrame.style.display = 'none';
    const overlay = document.createElement('div');
    overlay.id = 'video-embed-fallback';
    overlay.style.cssText = `
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        background:var(--bg-elevated); border-radius:16px; border:2px dashed var(--border);
        min-height:320px; padding:40px 20px; text-align:center; gap:16px;
    `;
    overlay.innerHTML = `
        <div style="font-size:56px; line-height:1;">⚠️</div>
        <h3 style="font-size:18px; font-weight:800; color:var(--text-primary); margin:0;">
            الفيديو غير متاح للتشغيل حالياً
        </h3>
        <p style="color:var(--text-secondary); font-size:14px; max-width:420px; margin:0; line-height:1.8;">
            إعدادات هذا الفيديو لا تسمح بتشغيله داخل المنصة.<br>
            يرجى التواصل مع المعلم لتحديث إعدادات الفيديو.
        </p>
        <div style="background:var(--bg-secondary); border-radius:12px; padding:16px 24px; max-width:400px;">
            <p style="color:var(--text-muted); font-size:13px; margin:0; line-height:1.7;">
                💡 <strong style="color:var(--text-secondary);">ملاحظة للمعلم:</strong><br>
                افتح YouTube Studio ← اختر الفيديو ← الإعدادات ← فعّل "السماح بالتضمين"
            </p>
        </div>
    `;
    container.appendChild(overlay);
}

// ── Video Invalid Link Fallback ───────────────────────────────
function setupVideoInvalidFallback() {
    const videoFrame = document.getElementById('lesson-video-frame');
    const container = videoFrame?.parentElement;
    if (!container) return;
    if (document.getElementById('video-embed-fallback')) return;
    const overlay = document.createElement('div');
    overlay.id = 'video-embed-fallback';
    overlay.style.cssText = `
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        background:var(--bg-elevated); border-radius:16px; border:2px dashed var(--border);
        min-height:320px; padding:40px 20px; text-align:center; gap:16px;
    `;
    overlay.innerHTML = `
        <div style="font-size:56px; line-height:1;">🔗</div>
        <h3 style="font-size:18px; font-weight:800; color:var(--text-primary); margin:0;">
            رابط الفيديو غير صالح
        </h3>
        <p style="color:var(--text-secondary); font-size:14px; max-width:420px; margin:0; line-height:1.8;">
            لم نتمكن من التعرف على رابط الفيديو المُدخل.<br>
            يرجى التأكد من إدخال رابط YouTube صحيح.
        </p>
        <div style="background:var(--bg-secondary); border-radius:12px; padding:16px 24px; max-width:440px; text-align:right;">
            <p style="color:var(--text-muted); font-size:13px; margin:0; line-height:2;">
                <strong style="color:var(--text-secondary);">الصيغ المدعومة:</strong><br>
                ✅ youtube.com/watch?v=xxxxx<br>
                ✅ youtu.be/xxxxx<br>
                ✅ youtube.com/shorts/xxxxx<br>
                ✅ youtube.com/live/xxxxx
            </p>
        </div>
    `;
    container.appendChild(overlay);
}

function handleImageError(img) {
    img.classList.add('hidden');
    const fallback = document.getElementById('mindmap-fallback');
    if (fallback) fallback.classList.remove('hidden');
}

// ── Notifications ─────────────────────────────────────────────
function toggleNotifications() { document.getElementById('notif-panel').classList.toggle('open'); }

// ── Helper ────────────────────────────────────────────────────
function setEl(id, prop, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (prop === 'textContent') el.textContent = value;
    else if (prop.startsWith('style.')) el.style[prop.split('.')[1]] = value;
    else el[prop] = value;
}

// ── Native Quiz Logic ───────────────────────────────────────────
function renderNativeQuiz(quiz, container) {
    const lessonId = currentLessonObj?.id;
    const userId = currentUser?.id || currentUser?._id;

    if (!lessonId || !userId) {
        container.innerHTML = `<div class="text-center p-32 text-warning">🛠️ يرجى تسجيل الدخول مجدداً لاستكمال الاختبار.</div>`;
        return;
    }

    container.innerHTML = `<div class="text-center p-32"><i class="fas fa-spinner fa-spin"></i> جارٍ تحميل حالة الاختبار...</div>`;

    fetch(`${API_URL}/quiz/attempts/${userId}/${lessonId}`)
        .then(res => res.json())
        .then(attempt => {
            currentQuizAttempt = attempt;
            if (attempt && attempt.status === 'completed') {
                renderCompletedQuiz(attempt, container, quiz);
            } else if (attempt && attempt.status === 'in-progress') {
                // If we fetch an in-progress attempt on page load, the student left earlier and returned. Lock it immediately!
                container.innerHTML = `<div class="text-center p-32"><i class="fas fa-lock text-warning fa-2x mb-8"></i><br>تم اكتشاف محاولة غير مكتملة. سيتم تقييمها الآن...</div>`;

                let calculatedScore = 0;
                let finalAnswers = attempt.answers || Array(quiz.questions.length).fill('');
                quiz.questions.forEach((q, idx) => {
                    if (finalAnswers[idx] === q.answer) calculatedScore++;
                });
                attempt.status = 'completed';
                attempt.score = `${calculatedScore} / ${quiz.questions.length}`;
                attempt.answers = finalAnswers;

                fetch(`${API_URL}/quiz/attempts/${userId}/${lessonId}/submit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ score: attempt.score, answers: attempt.answers, deviceId: getDeviceId() })
                }).then(() => {
                    renderCompletedQuiz(attempt, container, quiz);
                }).catch(e => {
                    console.error('Auto-submit error:', e);
                    renderCompletedQuiz(attempt, container, quiz);
                });

            } else {
                renderStartQuizScreen(container, quiz);
            }
        })
        .catch(err => {
            console.error('Quiz Fetch Error:', err);
            container.innerHTML = `<div class="text-center p-32 text-danger">⚠️ فشل تحميل الاختبار. يرجى التحديث.</div>`;
        });
}

function renderStartQuizScreen(container, quiz) {
    const quizData = currentLessonObj.quizZone || {};
    const duration = quizData.duration || currentLessonObj.duration || 30;
    const deadline = quizData.deadline ? new Date(quizData.deadline) : null;
    const now = new Date();

    if (deadline && now > deadline) {
        container.innerHTML = `
            <div class="card p-32 text-center" style="background:rgba(255,255,255,0.02); border:1px solid var(--danger); border-radius:20px; margin-top:20px;">
                <div style="font-size:64px; margin-bottom:20px;">🚫</div>
                <h2 class="fw-800 mb-16 text-danger">عفواً، انتهى موعد الاختبار</h2>
                <p class="text-muted mb-24">
                    لقد كان آخر موعد لدخول هذا الاختبار هو:<br>
                    <strong class="text-white">${deadline.toLocaleString('ar-EG')}</strong>
                </p>
                <button class="btn btn-primary" onclick="navigateTo('dashboard')">العودة للرئيسية</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="card p-32 text-center" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1); border-radius:20px; margin-top:20px;">
            <div style="font-size:64px; margin-bottom:20px;">📝</div>
            <h2 class="fw-800 mb-16">جاهز للاختبار؟</h2>
            <p class="text-muted mb-24" style="max-width:400px; margin-left:auto; margin-right:auto; line-height:1.8;">
                هذا الاختبار يحتوي على <strong>${quiz.questions.length}</strong> سؤال.<br>
                لديك محاولة واحدة فقط، والوقت المتاح هو <strong>${duration}</strong> دقيقة.<br>
                ${deadline ? `<span class="text-warning">آخر موعد للدخول: ${deadline.toLocaleString('ar-EG')}</span><br>` : ''}
                <span class="text-danger">⚠️ لا تخرج من الصفحة أو تغلق التبويب أثناء الحل.</span>
            </p>
            <div class="flex flex-col gap-12" style="max-width:300px; margin:0 auto;">
                <button class="btn btn-primary btn-lg w-full" onclick="startQuizAttempt()" style="padding:18px; font-size:18px;">
                    <i class="fas fa-rocket"></i> ابدأ الاختبار الآن
                </button>
            </div>
        </div>
    `;
}

async function startQuizAttempt() {
    const lessonId = currentLessonObj.id;
    const quizData = currentLessonObj.quizZone || {};
    const durationMins = quizData.duration || currentLessonObj.duration || 30;
    const initialSeconds = durationMins * 60;
    const deviceId = getDeviceId();

    try {
        const res = await fetch(`${API_URL}/quiz/attempts/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, lessonId, deviceId, initialTime: initialSeconds })
        });
        const data = await res.json();

        if (data.success) {
            currentQuizAttempt = data.attempt;
            document.getElementById('quiz-container').innerHTML = '';
            renderInProgressQuiz(currentQuizAttempt, document.getElementById('quiz-container'), currentLessonObj.quizZone.nativeData);
        } else if (data.msg === 'MultipleDevice') {
            alert('⚠️ الغش ممنوع! تم اكتشاف محاولة دخول من جهاز آخر. يرجى المتابعة من الجهاز الأول فقط.');
        } else if (data.msg === 'AlreadyCompleted') {
            currentQuizAttempt = data.attempt;
            document.getElementById('quiz-container').innerHTML = '';
            renderCompletedQuiz(currentQuizAttempt, document.getElementById('quiz-container'), currentLessonObj.quizZone.nativeData);
        }
    } catch (e) { console.error('Start quiz error:', e); }
}

function getDeviceId() {
    let dev = localStorage.getItem('numi_device_fingerprint');
    if (!dev) {
        dev = 'dev_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('numi_device_fingerprint', dev);
    }
    return dev;
}

function renderInProgressQuiz(attempt, container, quiz) {
    const questionsPerPage = 5;
    currentQuizGroup = 0;
    totalQuizGroups = Math.ceil(quiz.questions.length / questionsPerPage);

    // Use individual quiz duration if set, then lesson duration, then default 30
    const durationMins = currentLessonObj.quizZone?.duration || currentLessonObj.duration || 30;
    quizSecondsRemaining = attempt.remainingTime || (durationMins * 60);

    container.innerHTML = `
        <div class="card p-24" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1); border-radius:15px; margin-top:20px;">
            <div class="flex justify-between items-center mb-20 p-12" style="background:rgba(0,0,0,0.2); border-radius:12px;">
                <div class="fw-700" id="quiz-timer-display" style="font-size:20px; color:var(--warning);">
                    <i class="fas fa-clock"></i> <span>--:--</span>
                </div>
                <div class="badge badge-primary">محاولة جارية</div>
            </div>
            <div id="quiz-questions-area"></div>
            <div class="flex justify-between items-center mt-32 gap-16" id="quiz-nav-btns">
                 <button class="btn btn-ghost hidden" id="prev-quiz-btn" onclick="changeQuizGroup(-1)">السابق</button>
                 <button class="btn btn-primary flex-1" id="next-quiz-btn" onclick="changeQuizGroup(1)">
                    ${totalQuizGroups > 1 ? 'المجموعة التالية <i class="fas fa-arrow-left" style="margin-right:8px;"></i>' : '<i class="fas fa-check-double" style="margin-right:8px;"></i> إرسال الإجابات وعرض النتيجة'}
                 </button>
            </div>
            <div id="quiz-result-area" class="mt-24 hidden"></div>
        </div>
    `;

    const area = document.getElementById('quiz-questions-area');
    quiz.questions.forEach((q, idx) => {
        const groupIndex = Math.floor(idx / questionsPerPage);
        let html = `<div class="question-block mb-32 p-16 quiz-group-${groupIndex} ${groupIndex === 0 ? '' : 'hidden'}" data-type="${q.type}" data-answer="${q.answer}" style="border-radius:12px; transition:0.3s; border:1px solid transparent;">
            <h4 class="fw-700 mb-16" style="line-height:1.6; font-size:17px;">س${idx + 1}: ${q.question}</h4>`;
        if (q.type === 'mcq') {
            html += `<div class="options-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">`;
            q.options.forEach(opt => {
                html += `<label class="option-label" style="display:flex; align-items:center; gap:12px; padding:15px; background:rgba(255,255,255,0.05); border-radius:10px; cursor:pointer; transition:0.3s; border:1px solid rgba(255,255,255,0.05);">
                    <input type="radio" onchange="syncQuizProgess()" name="q${idx}" value="${opt}" style="width:20px; height:20px;"> <span>${opt}</span>
                </label>`;
            });
            html += `</div>`;
        } else if (q.type === 'boolean') {
            html += `<div class="flex gap-16"><label class="option-label p-16 flex-1" style="background:rgba(46,213,115,0.05); border-radius:10px; cursor:pointer; text-align:center; border:1px solid rgba(46,213,115,0.1);">
                <input type="radio" onchange="syncQuizProgess()" name="q${idx}" value="صح" style="display:none;"> <i class="fas fa-check-circle"></i> صح</label>
                <label class="option-label p-16 flex-1" style="background:rgba(255,71,87,0.05); border-radius:10px; cursor:pointer; text-align:center; border:1px solid rgba(255,71,87,0.1);">
                <input type="radio" onchange="syncQuizProgess()" name="q${idx}" value="خطأ" style="display:none;"> <i class="fas fa-times-circle"></i> خطأ</label></div>`;
        } else {
            html += `<input type="text" class="form-control" oninput="syncQuizProgess()" name="q${idx}" placeholder="اكتب إجابتك هنا..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); padding:16px; width:100%; color:white; border-radius:10px;">`;
        }
        html += `</div>`;
        area.innerHTML += html;
    });

    // Populate existing answers
    if (attempt.answers && attempt.answers.length > 0) {
        attempt.answers.forEach((ans, idx) => {
            if (!ans) return;
            const block = area.querySelectorAll('.question-block')[idx];
            if (!block) return;
            const type = block.dataset.type;
            if (type === 'mcq' || type === 'boolean') {
                const input = block.querySelector(`input[value="${ans}"]`);
                if (input) input.checked = true;
            } else {
                const input = block.querySelector('input');
                if (input) input.value = ans;
            }
        });
    }

    if (!document.getElementById('quiz-native-css')) {
        const style = document.createElement('style');
        style.id = 'quiz-native-css';
        style.innerHTML = `
            .option-label:has(input:checked) { background: var(--primary) !important; color: white; border-color: var(--primary); box-shadow: 0 4px 15px rgba(109,58,238,0.3); }
            .question-correct { border-color: var(--success) !important; background: rgba(46,213,115,0.05) !important; }
            .question-wrong { border-color: var(--danger) !important; background: rgba(255,71,87,0.05) !important; }
        `;
        document.head.appendChild(style);
    }

    startQuizTimer();
    addAntiCheatListeners();
}

function renderCompletedQuiz(attempt, container, quiz) {
    container.innerHTML = `
        <div class="card p-24" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1); border-radius:15px; margin-top:20px;">
            <div id="prev-score-alert" class="mb-24 p-16 text-center" style="background:var(--success-glow); border:2px solid var(--success); border-radius:12px;">
                <h4 class="fw-800 text-success" style="font-size:22px;">تم إنهاء كويز هذا الدرس</h4>
                <div class="fw-900 mt-8" style="font-size:32px; color:var(--text-primary);">درجتك المحققة: ${attempt.score}</div>
                <p class="fs-sm text-muted mt-8">لا يمكن إعادة حل هذا الاختبار، محاولة واحدة فقط لكل طالب.</p>
            </div>
            <div id="quiz-questions-area"></div>
            <div id="quiz-result-area" class="mt-24"></div>
        </div>
    `;

    const area = document.getElementById('quiz-questions-area');
    quiz.questions.forEach((q, idx) => {
        let html = `<div class="question-block mb-32 p-16" data-type="${q.type}" data-answer="${q.answer}" style="border-radius:12px; border:1px solid rgba(255,255,255,0.05); opacity:0.8;">
            <h4 class="fw-700 mb-16" style="line-height:1.6; font-size:17px;">س${idx + 1}: ${q.question}</h4>`;
        const ans = (attempt.answers || [])[idx] || '';
        const isCorrect = ans === q.answer;

        if (q.type === 'mcq' || q.type === 'boolean') {
            html += `<div class="options-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">`;
            const options = q.type === 'mcq' ? q.options : ['صح', 'خطأ'];
            options.forEach(opt => {
                const checked = opt === ans;
                const optCorrect = opt === q.answer;
                html += `<label class="option-label" style="display:flex; align-items:center; gap:12px; padding:15px; background:${checked ? (isCorrect ? 'var(--success-glow)' : 'var(--danger-glow)') : 'rgba(255,255,255,0.05)'}; border-radius:10px; border:1px solid ${checked ? (isCorrect ? 'var(--success)' : 'var(--danger)') : 'rgba(255,255,255,0.05)'}">
                    <input type="radio" disabled ${checked ? 'checked' : ''} style="width:20px; height:20px;"> <span>${opt} ${optCorrect ? '✅' : (checked && !isCorrect ? '❌' : '')}</span>
                </label>`;
            });
            html += `</div>`;
        } else {
            html += `<div class="p-16" style="background:rgba(0,0,0,0.2); border-radius:10px; border:1px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}">
                إجابتك: ${ans || 'لم يتم الحل'} ${isCorrect ? '✅' : '❌'}<br>
                <small class="text-success mt-8 block">الإجابة الصحيحة: ${q.answer}</small>
            </div>`;
        }
        html += `</div>`;
        area.innerHTML += html;
    });
}

function startQuizTimer() {
    if (currentQuizAttempt && currentQuizAttempt.status === 'completed') return;
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    updateTimerUI();
    quizTimerInterval = setInterval(() => {
        quizSecondsRemaining--;
        updateTimerUI();
        if (quizSecondsRemaining % 15 === 0) syncQuizProgess();
        if (quizSecondsRemaining <= 0) {
            clearInterval(quizTimerInterval);
            alert('⏱️ انتهى وقت الاختبار! سيتم تسليم إجاباتك تلقائياً.');
            submitNativeQuiz();
        }
    }, 1000);
}

function updateTimerUI() {
    const el = document.getElementById('quiz-timer-display');
    if (!el) return;
    const m = Math.floor(quizSecondsRemaining / 60);
    const s = quizSecondsRemaining % 60;
    el.querySelector('span').textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (quizSecondsRemaining < 60) el.style.color = 'var(--danger)';
}

async function syncQuizProgess() {
    if (!currentQuizAttempt) return;
    const blocks = document.querySelectorAll('.question-block');
    const answers = Array.from(blocks).map(block => {
        const type = block.dataset.type;
        if (type === 'mcq' || type === 'boolean') {
            const sel = block.querySelector('input:checked');
            return sel ? sel.value : '';
        } else {
            const input = block.querySelector('input');
            return input ? input.value.trim() : '';
        }
    });
    try {
        await fetch(`${API_URL}/quiz/attempts/${currentUser.id}/${currentLessonObj.id}/sync`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers, remainingTime: quizSecondsRemaining, deviceId: getDeviceId() })
        });
    } catch (e) { }
}

function addAntiCheatListeners() {
    const quizKey = `quiz_active_${currentUser.id}_${currentLessonObj.id}`;
    const token = Date.now().toString();
    localStorage.setItem(quizKey, token);
    window.onstorage = (e) => {
        if (e.key === quizKey && e.newValue !== token) {
            alert('⚠️ تنبيه غش: تم فتح الاختبار في نافذة أخرى! سيتم إغلاق هذه المحاولة.');
            location.reload();
        }
    };
    window.onbeforeunload = (e) => {
        if (quizSecondsRemaining > 0 && currentQuizAttempt && currentQuizAttempt.status === 'in-progress') {
            return "هل أنت متأكد من مغادرة صفحة الاختبار؟ سيستمر الوقت في العد.";
        }
    };
}

function changeQuizGroup(delta) {
    const nextGroup = currentQuizGroup + delta;
    if (nextGroup < 0) return;
    if (nextGroup >= totalQuizGroups) { submitNativeQuiz(); return; }
    document.querySelectorAll(`.quiz-group-${currentQuizGroup}`).forEach(el => el.classList.add('hidden'));
    currentQuizGroup = nextGroup;
    document.querySelectorAll(`.quiz-group-${currentQuizGroup}`).forEach(el => el.classList.remove('hidden'));
    const prevBtn = document.getElementById('prev-quiz-btn');
    const nextBtn = document.getElementById('next-quiz-btn');
    if (currentQuizGroup > 0) prevBtn.classList.remove('hidden'); else prevBtn.classList.add('hidden');
    if (currentQuizGroup === totalQuizGroups - 1) {
        nextBtn.innerHTML = '<i class="fas fa-check-double" style="margin-right:8px;"></i> إرسال الإجابات وعرض النتيجة';
    } else {
        nextBtn.innerHTML = 'المجموعة التالية <i class="fas fa-arrow-left" style="margin-right:8px;"></i>';
    }
}

async function submitNativeQuiz(isAutoLoad = false) {
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
    }
    const timerDisp = document.getElementById('quiz-timer-display');
    if (timerDisp) {
        timerDisp.classList.add('hidden');
        timerDisp.querySelector('span').textContent = "تم التسليم";
    }

    const blocks = document.querySelectorAll('.question-block');
    let score = 0;
    currentQuizAnswers = [];
    blocks.forEach(b => b.classList.remove('hidden'));
    const navBtns = document.getElementById('quiz-nav-btns');
    if (navBtns) navBtns.classList.add('hidden');

    blocks.forEach((block, idx) => {
        const type = block.dataset.type;
        const correct = block.dataset.answer;
        let ans = '';
        block.querySelectorAll('input').forEach(i => i.disabled = true);
        block.style.pointerEvents = 'none';
        if (type === 'mcq' || type === 'boolean') {
            const sel = block.querySelector('input:checked');
            ans = sel ? sel.value : '';
        } else {
            const input = block.querySelector('input');
            ans = input ? input.value.trim() : '';
        }
        currentQuizAnswers.push(ans);
        if (ans === correct) {
            score++;
            block.classList.add('question-correct');
        } else {
            block.classList.add('question-wrong');
            const tip = document.createElement('div');
            tip.style.cssText = 'color:var(--success); font-weight:700; margin-top:10px; font-size:14px;';
            tip.innerHTML = `<i class="fas fa-check"></i> الإجابة الصحيحة: ${correct}`;
            block.appendChild(tip);
        }
    });

    const result = document.getElementById('quiz-result-area');
    result.classList.remove('hidden');
    currentQuizScore = `${score} / ${blocks.length}`;

    if (isAutoLoad) {
        result.innerHTML = `
            <div class="text-center p-32" style="background:rgba(255,255,255,0.02); border:2px solid var(--success); border-radius:20px;">
                <h2 class="fw-800 mb-8">لقد أكملت هذا الاختبار مسبقاً 🎉</h2>
                <div style="font-size:60px; font-weight:900; color:var(--success)">${currentQuizScore}</div>
            </div>
        `;
        return;
    }

    try {
        await fetch(`${API_URL}/quiz/attempts/${uid}/${currentLessonObj.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: currentQuizScore, answers: currentQuizAnswers, deviceId: getDeviceId() })
        });
        if (currentQuizAttempt) {
            currentQuizAttempt.status = 'completed';
            currentQuizAttempt.score = currentQuizScore;
            currentQuizAttempt.answers = currentQuizAnswers;
        }

        // Transform UI into Completed View immediately
        setTimeout(() => {
            renderCompletedQuiz(currentQuizAttempt, document.getElementById('quiz-container'), currentLessonObj.quizZone.nativeData);
        }, 1500);

    } catch (e) { console.error('Quiz submit error:', e); }

    result.innerHTML = `
        <div class="text-center p-32" style="background:rgba(255,255,255,0.02); border:2px solid var(--success); border-radius:20px;">
            <h2 class="fw-800 mb-8">عمل رائع! تم حفظ النتيجة 🎉</h2>
            <div style="font-size:60px; font-weight:900; color:var(--success)">${currentQuizScore}</div>
            <p class="text-muted mt-8">تم تسجيل محاولتك بنجاح.</p>
        </div>
    `;
}

// ─── Human Chat Logic ──────────────────────────────────────────
let humanSocket;
let currentHumanChatType = 'group'; // 'group' or 'private'

function initHumanChatSocket() {
    if (!currentUser || typeof io === 'undefined') return;
    if (humanSocket) return;

    humanSocket = io(API_URL.replace('/api', ''));

    humanSocket.on('connect', () => {
        // Individual room for unread badges
        humanSocket.emit('join', currentUser.id);
        // Joint room for private chat with admin
        const privateRoom = [currentUser.id, 'admin_main'].sort().join('_');
        humanSocket.emit('join', privateRoom);
        // Group room
        if (currentUser.groupId) humanSocket.emit('join', currentUser.groupId);
    });

    humanSocket.on('new_message', (data) => {
        const isGroupMatch = data.type === 'group' && currentHumanChatType === 'group' && currentUser.groupId === data.message.groupId;
        const isPrivateMatch = data.type === 'private' && currentHumanChatType === 'private' && (data.message.senderId === 'admin_main' || data.message.receiverId === 'admin_main');

        if (isGroupMatch || isPrivateMatch) {
            appendHumanMessage(data.message);
            // Mark as read if viewing and message is from admin or group mate
            if (data.message.senderId !== currentUser.id) {
                humanSocket.emit('mark_read', { msgId: data.message._id, type: data.type, userId: currentUser.id });
            }
        } else {
            incrementStudentUnreadBadge();
        }
    });

    humanSocket.on('user_typing', (data) => {
        if (data.userName === currentUser.name) return;
        const status = document.getElementById('hchat-status');
        if (data.isTyping) {
            status.textContent = `${data.userName} يكتب الآن...`;
            status.style.color = 'var(--primary-light)';
        } else {
            status.textContent = currentHumanChatType === 'group' ? 'دردشة جماعية' : 'دردشة خاصة';
            status.style.color = 'var(--text-muted)';
        }
    });

    humanSocket.on('unread_badge', () => {
        incrementStudentUnreadBadge();
    });
}

function incrementStudentUnreadBadge() {
    const badge = document.getElementById('unread-human-total');
    if (badge) {
        let count = parseInt(badge.textContent) || 0;
        badge.textContent = count + 1;
        badge.style.display = 'block';
    }
}

function switchHumanChat(type) {
    currentHumanChatType = type;
    document.querySelectorAll('.chat-tab-human').forEach(t => t.classList.remove('active'));
    const tabEl = document.getElementById(`tab-${type}-chat`);
    if (tabEl) tabEl.classList.add('active');

    const title = document.getElementById('hchat-title');
    const avatar = document.getElementById('hchat-avatar');
    const status = document.getElementById('hchat-status');

    if (type === 'group') {
        const groupName = platformDB?.classes?.[currentUser?.classId]?.groups?.[currentUser?.groupId]?.name || 'دردشة المجموعة';
        const groupTabName = document.getElementById('chat-group-name');
        if (groupTabName) groupTabName.textContent = groupName;
        title.textContent = groupName;
        avatar.textContent = 'G';
        avatar.style.background = 'var(--primary)';
        status.textContent = 'دردشة جماعية';
    } else {
        title.textContent = 'مستر Numi (المدير)';
        avatar.innerHTML = '<i class="fas fa-user-shield"></i>';
        avatar.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
        status.textContent = 'دردشة خاصة';
    }

    loadHumanMessages();
}

async function loadHumanMessages() {
    if (!currentUser) return;
    const msgCont = document.getElementById('hchat-messages');
    msgCont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> جارٍ التحميل...</div>';

    try {
        const url = currentHumanChatType === 'group'
            ? `/chat/group/${currentUser.groupId}`
            : `/chat/private/${currentUser.id}/admin_main`;

        const res = await fetch(`${API_URL}${url}`);
        const data = await res.json();

        if (data.success) {
            msgCont.innerHTML = '';
            if (data.messages.length === 0) {
                msgCont.innerHTML = '<div style="align-self:center; background:rgba(0,0,0,0.3); padding:5px 15px; border-radius:20px; font-size:12px; color:var(--text-muted); margin-bottom:10px;">لا توجد رسائل سابقة. ابدأ المحادثة الآن!</div>';
            } else {
                data.messages.forEach(m => appendHumanMessage(m));
            }
        }
    } catch (e) {
        console.error('Human chat load error:', e);
        msgCont.innerHTML = '<div style="padding:20px; color:var(--danger-color);">فشل تحميل الرسائل</div>';
    }
}

function appendHumanMessage(msg) {
    const msgCont = document.getElementById('hchat-messages');

    // Prevent duplicates
    if (msg._id && document.getElementById(`msg-${msg._id}`)) return;

    const isSentByMe = msg.senderId === currentUser.id;
    const time = new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const bubble = document.createElement('div');
    if (msg._id) bubble.id = `msg-${msg._id}`;
    bubble.style = `
        max-width: 75%;
        padding: 12px 18px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.6;
        margin-bottom: 5px;
        position: relative;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        ${isSentByMe
            ? 'align-self: flex-start; background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border-bottom-right-radius: 4px;'
            : 'align-self: flex-end; background: var(--bg-elevated); color: white; border-bottom-left-radius: 4px;'
        }
    `;

    let replyHtml = '';
    if (msg.replyTo) {
        replyHtml = `<div style="background:rgba(0,0,0,0.1); border-right:3px solid var(--primary); padding:5px 10px; margin-bottom:5px; border-radius:4px; font-size:11px; color:var(--text-muted); line-height:1.2;"><strong>${msg.replyTo.senderName}:</strong> ${msg.replyTo.message.substring(0, 30)}...</div>`;
    }

    bubble.innerHTML = `
        <div style="font-size:11px; margin-bottom:2px; font-weight:800; color:${isSentByMe ? 'rgba(255,255,255,0.8)' : 'var(--primary-light)'}; display:${currentHumanChatType === 'group' && !isSentByMe ? 'block' : 'none'};">
            ${msg.senderName}
        </div>
        ${replyHtml}
        ${msg.message}
        <span style="font-size:10px; opacity:0.5; margin-top:5px; display:block; text-align:left;">${time}</span>
    `;
    msgCont.appendChild(bubble);
    msgCont.scrollTop = msgCont.scrollHeight;
}

let typingHumanTimeout;
function onHumanTyping() {
    if (!humanSocket || !currentUser) return;
    const room = currentHumanChatType === 'group' ? currentUser.groupId : [currentUser.id, 'admin_main'].sort().join('_');
    humanSocket.emit('typing', { room, userName: currentUser.name, isTyping: true });

    clearTimeout(typingHumanTimeout);
    typingHumanTimeout = setTimeout(() => {
        humanSocket.emit('typing', { room, userName: currentUser.name, isTyping: false });
    }, 2000);
}

async function sendHumanMessage() {
    const input = document.getElementById('hchat-input');
    const message = input ? input.value.trim() : '';
    if (!message || !currentUser) return;

    if (currentHumanChatType === 'group' && !currentUser.groupId) {
        alert('عفواً، لا توجد مجموعة مرتبطة بحسابك.');
        return;
    }

    const payload = {
        senderId: currentUser.id || currentUser._id,
        senderName: currentUser.name || 'طالب',
        message
    };

    if (currentHumanChatType === 'group') payload.groupId = currentUser.groupId;
    else payload.receiverId = 'admin_main';

    try {
        const routeGroup = currentHumanChatType === 'group' ? '/chat/group' : '/chat/private';
        const res = await fetch(`${API_URL}${routeGroup}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.text();
            console.error('Server error on sending message:', errData);
            alert('تعذر إرسال الرسالة. يرجى المحاولة لاحقاً.');
            return;
        }

        const data = await res.json();
        if (data.success && input) {
            input.value = '';
            input.focus();
            if (data.message) {
                appendHumanMessage(data.message);
            }
        }
    } catch (e) {
        console.error("sendHumanMessage Network Error: ", e);
        alert('تأكد من الاتصال بالإنترنت، حدث خطأ في الاتصال بالسيرفر.');
    }
}

// ── Live Classes ────────────────────────────────────────────────
async function loadStudentLiveClasses(u) {
    const container = document.getElementById('student-live-classes-container');
    if (!container) return;
    try {
        const res = await fetch(`${API_URL}/live-classes?classId=${u.classId}&groupId=${u.groupId}`);
        const data = await res.json();
        
        if (!data.success || !data.liveClasses || data.liveClasses.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">لا توجد حصص مباشرة مجدولة لك حالياً.</div>';
            return;
        }

        const now = new Date();
        container.innerHTML = data.liveClasses.map(c => {
            const classDate = new Date(`${c.date}T${c.time}`);
            const endTime = new Date(classDate.getTime() + c.duration * 60000);

            let actualStatus = c.status;
            if (actualStatus !== 'finished') {
                if (now > endTime) actualStatus = 'finished';
                else if (now >= classDate && now <= endTime) actualStatus = 'live';
                else actualStatus = 'scheduled';
            }

            if (actualStatus === 'finished') {
                return ''; // Hide finished classes for students
            }

            let badge = '';
            let btn = '';
            
            if (actualStatus === 'scheduled') {
                badge = '<span class="badge badge-warning">مجدولة قريبًا</span>';
                btn = `<button class="btn w-full" disabled style="opacity:0.5;cursor:not-allowed;"><i class="fas fa-clock"></i> انتظر الموعد</button>`;
            } else if (actualStatus === 'live') {
                badge = '<span class="badge badge-danger"><i class="fas fa-circle blink"></i> مباشر الآن</span>';
                btn = `<button class="btn w-full text-white" onclick="window.open('${c.link}', '_blank')" style="background:var(--danger);"><i class="fas fa-video"></i> الدخول للحصة</button>`;
            }

            return `
            <div class="card p-16" style="text-align:right; border-right: 4px solid ${actualStatus === 'live' ? 'var(--danger)' : 'var(--warning)'}; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h4 class="fw-800 m-0">${c.title}</h4>
                    ${badge}
                </div>
                <div class="fs-sm text-muted"><i class="fas fa-calendar-alt"></i> ${c.date} | <i class="fas fa-clock"></i> ${c.time}</div>
                <div class="mt-8">${btn}</div>
            </div>`;
        }).join('');

        if (container.innerHTML.trim() === '') {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">لا توجد حصص مباشرة متاحة حالياً.</div>';
        }

    } catch (e) {
        container.innerHTML = '<div style="color:var(--danger); grid-column:1/-1;">خطأ في جلب بيانات الحصص</div>';
    }
}

// ── Upcoming Live Class Card ─────────────────────────────────────
let _upcomingLiveLink = '';

async function renderUpcomingLiveCard() {
    const card = document.getElementById('upcoming-live-card');
    if (!card || !currentUser) return;

    // Only for groups with liveEnabled
    const isLiveEnabled = platformDB?.classes?.[currentUser.classId]?.groups?.[currentUser.groupId]?.liveEnabled;
    if (!isLiveEnabled) { card.style.display = 'none'; return; }

    try {
        const res = await fetch(`${API_URL}/live-classes?classId=${currentUser.classId}&groupId=${currentUser.groupId}`);
        const data = await res.json();
        if (!data.success) { card.style.display = 'none'; return; }

        const now = new Date();
        // Find the next non-finished class (closest upcoming or currently live)
        const upcoming = data.liveClasses
            .filter(c => {
                const start = new Date(`${c.date}T${c.time}`);
                const end   = new Date(start.getTime() + c.duration * 60000);
                return now < end; // not yet finished
            })
            .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time))[0];

        if (!upcoming) { card.style.display = 'none'; return; }

        const start = new Date(`${upcoming.date}T${upcoming.time}`);
        const end   = new Date(start.getTime() + upcoming.duration * 60000);
        const isLive = now >= start && now <= end;

        card.style.display = 'block';
        card.style.borderRight = `4px solid ${isLive ? 'var(--danger)' : 'var(--warning)'}`;
        _upcomingLiveLink = upcoming.link;

        document.getElementById('upcoming-live-title').textContent = upcoming.title;
        document.getElementById('upcoming-live-datetime').textContent =
            `${upcoming.date}  |  ${upcoming.time}  (${upcoming.duration} دقيقة)`;

        const badge = document.getElementById('upcoming-live-badge');
        const btn   = document.getElementById('upcoming-live-btn');

        if (isLive) {
            badge.textContent = '🔴 مباشر الآن';
            badge.className = 'badge badge-danger';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = '<i class="fas fa-video"></i> انضم الآن';
        } else {
            // Show countdown
            const diffMs  = start - now;
            const diffMin = Math.floor(diffMs / 60000);
            const diffHr  = Math.floor(diffMin / 60);
            const remMin  = diffMin % 60;
            const countdownTxt = diffHr > 0 ? `بعد ${diffHr}س ${remMin}د` : `بعد ${diffMin} دقيقة`;
            badge.textContent = `⏰ ${countdownTxt}`;
            badge.className = 'badge badge-warning';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.innerHTML = '<i class="fas fa-clock"></i> انتظر الموعد';
        }
    } catch(e) {
        card.style.display = 'none';
    }
}

function joinUpcomingLive() {
    if (_upcomingLiveLink) window.open(_upcomingLiveLink, '_blank');
}



