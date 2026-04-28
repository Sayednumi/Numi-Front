function renderAdminSidebar() {
    return `
    <div class="sidebar" id="sidebar">
        <i class="fas fa-times mobile-close-btn" onclick="document.getElementById('sidebar').classList.remove('show')"></i>
        <div class="brand">Numi Platform</div>
        <ul class="menu" id="nav-menu">
            <li><a href="#" data-target="dashboard"><i class="fas fa-home"></i> لوحة المعلم</a></li>
            <li><a href="#" data-target="classes"><i class="fas fa-layer-group"></i> إدارة الصفوف</a></li>
            <li><a href="#" data-target="groups"><i class="fas fa-users-rectangle"></i> إدارة المجموعات</a></li>
            <li><a href="#" data-target="courses"><i class="fas fa-book"></i> إدارة المقررات</a></li>
            <li><a href="#" data-target="units"><i class="fas fa-cubes"></i> إدارة الوحدات</a></li>
            <li><a href="#" data-target="lessons"><i class="fas fa-file-video"></i> إدارة الدروس</a></li>
            <li><a href="#" data-target="video-zone"><i class="fas fa-play-circle"></i> Video Zone</a></li>
            <li><a href="#" data-target="podcast-zone"><i class="fas fa-podcast"></i> Wood Podcast Zone</a></li>
            <li><a href="#" data-target="mindscape-zone"><i class="fas fa-project-diagram"></i> Mindscape</a></li>
            <li><a href="#" data-target="game-zone"><i class="fas fa-gamepad"></i> Game Zone</a></li>
            <li><a href="#" data-target="game-bank-section" onclick="renderGameBankSection()"><i class="fas fa-archive" style="color:#f59e0b;"></i> <span style="color:#f59e0b; font-weight:700;">بنك الألعاب</span></a></li>
            <li><a href="#" data-target="quiz-zone"><i class="fas fa-question-circle"></i> Quiz Zone</a></li>
            <li><a href="#" data-target="ailesson-zone"><i class="fas fa-magic"></i> الدرس (/lesson)</a></li>
            <li><a href="#" data-target="students"><i class="fas fa-user-graduate"></i> إدارة الطلاب</a></li>
            <li id="nav-platform-management" style="display:none; margin-top:15px; border-top:1px solid rgba(255,255,255,0.05); padding-top:15px;">
                <a href="#" data-target="platform-management" onclick="loadPlatformManagement()"><i class="fas fa-server" style="color:var(--danger)"></i> إدارة المنصة</a>
            </li>
            <li><a href="#" data-target="reports" onclick="initReports()"><i class="fas fa-chart-bar"></i> التقارير والنتائج</a></li>
            <li><a href="#" data-target="question-bank" onclick="renderQuestionBank()"><i class="fas fa-database"></i> بنك الأسئلة</a></li>
            <li><a href="#" data-target="chat" onclick="renderChatHierarchy()"><i class="fas fa-comments"></i> الدردشة</a></li>
            <li><a href="#" data-target="teacher-platforms" onclick="loadTeacherPlatforms()"><i class="fas fa-th-large"></i> المنصات المساعدة</a></li>
            <li><a href="#" data-target="live-classes" onclick="loadLiveClasses()"><i class="fas fa-video"></i> الحصص المباشرة</a></li>
            <li style="margin-top: auto; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                <a href="#" onclick="logoutAdmin()" style="color: var(--danger);">
                    <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
                </a>
            </li>
        </ul>
    </div>
    `;
}
