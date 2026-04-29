/**
 * DashboardCards Component
 * Renders the 4 summary stat cards at the top of the Admin Dashboard.
 *
 * Each card definition:
 *   { id, title, icon, color, section }
 *
 * The `id` is preserved exactly so existing JS code that updates
 * e.g. document.getElementById('stats-classes').textContent = X
 * continues to work without any changes.
 */

const DASHBOARD_CARDS = [
    { id: 'stats-classes',  title: 'إجمالي الصفوف', icon: 'fas fa-layer-group', color: 'var(--primary)', section: 'classes' },
    { id: 'stats-groups',   title: 'إجمالي المجموعات', icon: 'fas fa-users-rectangle', color: 'var(--accent)',  section: 'groups' },
    { id: 'stats-students', title: 'إجمالي الطلاب', icon: 'fas fa-user-graduate', color: 'var(--success)', section: 'students' },
    { id: 'stats-lessons',  title: 'إجمالي الدروس', icon: 'fas fa-file-video', color: 'var(--danger)',  section: 'lessons' }
];

const SUPER_ADMIN_CARDS = [
    ...DASHBOARD_CARDS,
    { id: 'stats-tenants',  title: 'إجمالي المدارس', icon: 'fas fa-school', color: 'var(--warning)', section: 'platform-management' },
    { id: 'stats-teachers', title: 'إجمالي المعلمين', icon: 'fas fa-chalkboard-teacher', color: '#6c5ce7', section: 'platform-management' },
    { id: 'stats-ai',       title: 'استخدام الذكاء الاصطناعي', icon: 'fas fa-robot', color: '#00cec9', section: 'platform-management' },
    { id: 'stats-subs',     title: 'الاشتراكات النشطة', icon: 'fas fa-credit-card', color: '#9b59b6', section: 'superAdminSubsSection' }
];

function renderDashboardCards(isSuperAdmin = false) {
    const list = isSuperAdmin ? SUPER_ADMIN_CARDS : DASHBOARD_CARDS;

    const cardsHTML = list.map(card => `
        <div class="card clickable" onclick="showSection('${card.section}')">
            <div class="card-header">
                <h3>${card.title}</h3>
                <i class="${card.icon} fa-2x" style="color: ${card.color};"></i>
            </div>
            <h2 id="${card.id}">0</h2>
        </div>
    `).join('');

    return `<div class="grid">${cardsHTML}</div>`;
}
