function renderDashboardCards() {
    const cardsData = [
        {
            title: "إجمالي الصفوف",
            id: "stats-classes",
            icon: "fas fa-layer-group fa-2x",
            color: "var(--primary)",
            target: "classes"
        },
        {
            title: "إجمالي المجموعات",
            id: "stats-groups",
            icon: "fas fa-users-rectangle fa-2x",
            color: "var(--accent)",
            target: "groups"
        },
        {
            title: "إجمالي الطلاب",
            id: "stats-students",
            icon: "fas fa-user-graduate fa-2x",
            color: "var(--success)",
            target: "students"
        },
        {
            title: "إجمالي الدروس",
            id: "stats-lessons",
            icon: "fas fa-file-video fa-2x",
            color: "var(--danger)",
            target: "lessons"
        }
    ];

    const cardsHtml = cardsData.map(card => `
        <div class="card clickable" onclick="showSection('${card.target}')">
            <div class="card-header">
                <h3>${card.title}</h3>
                <i class="${card.icon}" style="color: ${card.color};"></i>
            </div>
            <h2 id="${card.id}">0</h2>
        </div>
    `).join('');

    return `
        <div class="grid">
            ${cardsHtml}
        </div>
    `;
}
