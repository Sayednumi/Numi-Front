const UI = {
    showLogin: () => {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    },
    showApp: () => {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        UI.updateProfile();
        UI.loadNotes();
        UI.renderDashboard();
    },
    updateProfile: () => {
        const u = Auth.getCurrentUser();
        if (u) {
            document.getElementById('display-name').textContent = u.name;
            document.getElementById('display-id').textContent = u.id;
            document.getElementById('avatar-letter').textContent = u.name.charAt(0);
            document.getElementById('xp-display').innerHTML = `<i class="fas fa-star"></i> ${u.xp} نقطة`;
            document.getElementById('streak-display').innerHTML = `<i class="fas fa-fire"></i> ${u.streak} أيام`;
        }
    },
    navigateTo: (viewId, menuItem) => {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        const target = document.getElementById('view-' + viewId);
        if (target) target.classList.remove('hidden');

        if (menuItem) {
            document.querySelectorAll('.menu li').forEach(li => li.classList.remove('active'));
            menuItem.classList.add('active');
        }
        document.getElementById('sidebar').classList.remove('open'); // close on mobile
    },
    renderDashboard: () => {
        const u = Auth.getCurrentUser();
        const t1Total = LessonsManager.getLessonsByTerm('term1').length;
        const t1Completed = LessonsManager.getLessonsByTerm('term1').filter(l => u.completedLessons.includes(l.id)).length;
        const pct = t1Total > 0 ? (t1Completed / t1Total) * 100 : 0;
        document.getElementById('term1-progress-fill').style.width = `${pct}%`;
        document.getElementById('term1-progress-text').textContent = `مكتمل ${Math.round(pct)}%`;
    },
    loadLesson: (lessonId) => {
        const lesson = LessonsManager.getLesson(lessonId);
        if (!lesson) return;
        
        document.getElementById('lesson-page-title').textContent = lesson.title;
        document.getElementById('lesson-main-title').textContent = lesson.title;
        document.getElementById('lesson-meta').innerHTML = `<span><i class="far fa-clock"></i> ${lesson.duration}</span>`;
        // YouTube Embed update
        document.getElementById('lesson-video-frame').src = `https://www.youtube-nocookie.com/embed/${lesson.videoId}`;

        const u = Auth.getCurrentUser();
        const badge = document.getElementById('lesson-badge');
        
        if (u.completedLessons.includes(lessonId)) {
            badge.className = 'badge-completed';
            badge.innerHTML = '<i class="fas fa-check"></i> مكتمل';
        } else {
            badge.className = '';
            badge.innerHTML = '<button class="btn btn-primary" style="padding: 4px 12px; font-size: 11px;" id="btn-complete-lesson">إكمال الدرس</button>';
            
            // Re-bind completion handler safely
            setTimeout(() => {
                const completeBtn = document.getElementById('btn-complete-lesson');
                if(completeBtn) {
                    completeBtn.onclick = () => {
                        if (LessonsManager.completeLesson(lessonId)) {
                            UI.updateProfile();
                            UI.loadLesson(lessonId); // refresh
                            UI.renderDashboard();
                        }
                    };
                }
            }, 50);
        }

        UI.navigateTo('lesson');
    },
    switchSection: (secId, tabElem) => {
        document.querySelectorAll('.lesson-tabs .tab-item').forEach(li => li.classList.remove('active'));
        tabElem.classList.add('active');
        document.querySelectorAll('.lesson-section').forEach(s => s.classList.add('hidden'));
        document.getElementById('section-' + secId).classList.remove('hidden');
    },
    toggleChat: () => {
        document.getElementById('chat-modal').classList.toggle('active');
    },
    loadNotes: () => {
        const notes = StorageHelper.load('numi_notes');
        if (notes) document.getElementById('qn-textarea').value = notes;
    },
    showLoginError: (msg) => {
        const err = document.getElementById('login-error');
        err.textContent = msg;
        err.style.display = 'block';
    }
};
