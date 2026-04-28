function renderAdminNavbar() {
    return `
        <div class="header">
            <div class="mobile-toggle" onclick="document.getElementById('sidebar').classList.toggle('show')">
                <i class="fas fa-bars"></i>
            </div>
            <h1 id="page-title">لوحة التحكم</h1>
            <div class="user-info" id="header-user-info" style="display: flex; align-items: center;">
                <span id="header-user-name">تحميل...</span>
                <i class="fas fa-user-circle fa-2x" style="vertical-align:middle;margin-right:10px;color:var(--primary);"></i>
            </div>
        </div>
    `;
}
