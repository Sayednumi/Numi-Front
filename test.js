

        // Check authentication
        const SESSION_KEY = 'numi_session_user';
        const sessionSaved = localStorage.getItem(SESSION_KEY);
        if (!sessionSaved || JSON.parse(sessionSaved).role !== 'admin') {
            window.location.href = 'index.html';
        }

        function logoutAdmin() {
            localStorage.removeItem(SESSION_KEY);
            window.location.href = 'index.html';
        }

        // Database connection to Node.js backend
        const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:5000/api'
            : 'https://numi-production-7484.up.railway.app/api';
        let db = { classes: {} };
        let socket = null;
        try {
            socket = io(API_URL.replace('/api', ''));
            socket.on('new_message', (data) => {
                const { type, message } = data;
                if (currentChatType === 'group' && type === 'group' && message.groupId === currentChatId) {
                    appendMessageAdmin(message);
                } else if (currentChatType === 'student' && type === 'private' && (message.senderId === currentChatId || message.receiverId === currentChatId)) {
                    appendMessageAdmin(message);
                }
            });
        } catch(e) { console.warn('Socket uninitialized'); }

        async function fetchDB() {
            try {
                const res = await fetch(`${API_URL}/platform-data`);
                if(res.ok) {
                    const data = await res.json();
                    if(data && data.classes) db = data;
                }
            } catch (err) {
                console.error("Failed to load DB from backend, falling back to empty/cache", err);
            }
        }

        async function saveDB() {
            // Update UI elements synchronously
            updateStats(); 
            refreshAllDropdowns(); 
            buildNavLessonSelectors();
            try {
                // Save to Backend
                await fetch(`${API_URL}/platform-data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(db)
                });
            } catch (err) {
                console.error("Failed to save DB to backend", err);
            }
        }
        function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

        // Navigation
        const menuLinks = document.querySelectorAll('.menu a');
        const sections = document.querySelectorAll('.section');
        const pageTitle = document.getElementById('page-title');

        menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const target = link.getAttribute('data-target');
                showSection(target);
            });
        });

        function showSection(targetId) {
            menuLinks.forEach(l => l.classList.remove('active'));
            const link = document.querySelector(`.menu a[data-target="${targetId}"]`);
            if (link) link.classList.add('active');
            
            sections.forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.add('active');
            
            pageTitle.innerText = link ? link.innerText : 'لوحة التحكم';
            
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar')?.classList.remove('show');
            }
            if (targetId === 'dashboard') updateStats();
            if (targetId === 'students') loadStudents();
            if (targetId === 'chat') renderChatHierarchy();
        }

        // Main initialization
        window.onload = async () => {
            await fetchDB();
            await loadStudents();
            await initHonorBoard();
            updateStats();
            refreshAllDropdowns();
            renderClasses();
            renderGroups();
            renderCourses();
            renderUnits();
            renderLessons();
            buildNavLessonSelectors();
        };

        // ── Students from MongoDB ────────────────────────────────────────────
        let allStudents = [];

        async function loadStudents() {
            try {
                await fetchDB(); // Refresh classes/groups names first
                const res = await fetch(`${API_URL}/users`);
                if (res.ok) {
                    allStudents = await res.json();
                    renderStudents();
                    document.getElementById('stats-students').innerText = allStudents.filter(u => u.role === 'student').length;
                }
            } catch (err) {
                console.error('Failed to load students', err);
            }
        }

        function renderStudents() {
            const search = (document.getElementById('student-search')?.value || '').toLowerCase();
            const statusFilter = document.getElementById('student-filter-status')?.value || '';
            const tbody = document.getElementById('students-list');
            const abody = document.getElementById('admins-list');
            
            // Render Admins
            const admins = allStudents.filter(u => u.role === 'admin');
            if (abody) {
                if (!admins.length) {
                    abody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">لا يوجد مديرون آخرون</td></tr>`;
                } else {
                    abody.innerHTML = admins.map(u => {
                        let permsObj = u.permissions || {};
                        let permsAr = [];
                        if(permsObj.view_students || Object.keys(permsObj).length === 0) permsAr.push('استعراض الطلاب');
                        if(permsObj.edit_student || permsObj.delete_student) permsAr.push('تعديل وحذف طلاب');
                        if(permsObj.manage_structure) permsAr.push('تعديل الهيكل');
                        if(permsObj.manage_lessons) permsAr.push('إدارة الدروس');
                        if(permsObj.view_qbank || Object.keys(permsObj).length === 0) permsAr.push('بنك الأسئلة');
                        if(permsObj.view_reports) permsAr.push('التقارير');
                        if(permsObj.manage_admins) permsAr.push('إدارة المديرين');
                        if(permsAr.length === 0) permsAr.push('بدون صلاحيات');
                        
                        let permsHtml = permsAr.map(p => `<span style="background:rgba(109,58,238,0.2); border:1px solid rgba(109,58,238,0.4); color:#fff; padding:2px 6px; border-radius:4px; font-size:11px; margin-bottom:4px; display:inline-block; margin-left:4px;">${p}</span>`).join('');

                        return `
                        <tr>
                            <td>${u.name}</td>
                            <td>${u.phone}</td>
                            <td>${u.password || '******'}</td>
                            <td><div style="display:flex; flex-wrap:wrap; gap:4px;">${permsHtml}</div></td>
                            <td>
                                <button class="btn btn-sm" style="background:#3b82f6; color:white;" onclick="editAdmin('${u.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger" onclick="deleteStudent('${u.id}','${u.name}')" title="حذف"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                        `;
                    }).join('');
                }
            }

            // Render Students
            let filtered = allStudents.filter(u => u.role === 'student');
            if (search) filtered = filtered.filter(u =>
                (u.name || '').toLowerCase().includes(search) || (u.id || '').toLowerCase().includes(search) || (u.phone || '').includes(search)
            );
            if (statusFilter) filtered = filtered.filter(u => u.status === statusFilter);

            if (!filtered.length) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:30px;">لا يوجد طلاب مطابقون</td></tr>`;
                const countEl = document.getElementById('students-count');
                if (countEl) countEl.textContent = '';
                return;
            }
            if (tbody) {
                tbody.innerHTML = filtered.map(u => {
                    const avatarHtml = u.avatar
                        ? `<img src="${u.avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--primary-light);" title="${u.name || ''}">` 
                        : `<div style="width:40px;height:40px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;border:2px solid var(--border);color:var(--text-muted);">${(u.name || '?').charAt(0)}</div>`;
                    return `
                    <tr>
                        <td><input type="checkbox" class="student-select" value="${u.id}" onchange="updateBulkBar()"></td>
                        <td style="text-align:center;">${avatarHtml}</td>
                        <td>${u.name || '-'}</td>
                        <td><code style="color:var(--primary);">${u.password || '---'}</code></td>
                        <td>${u.phone || '-'}</td>
                        <td style="color:var(--text-secondary);">${u.parentPhone || '<span style="color:var(--text-muted);font-size:11px;">غير مسجل</span>'}</td>
                        <td style="font-size:12px;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${u.school || ''}">${u.school || '<span style="color:var(--text-muted);font-size:11px;">غير مسجل</span>'}</td>
                        <td>${db.classes[u.classId]?.name || u.classId || '-'}</td>
                        <td>${db.classes[u.classId]?.groups[u.groupId]?.name || u.groupId || '-'}</td>
                        <td>${u.xp || 0} ⭐</td>
                        <td>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <label class="switch">
                                    <input type="checkbox" ${u.status === 'active' ? 'checked' : ''} onchange="toggleStudentStatus('${u.id}', '${u.status}')">
                                    <span class="slider"></span>
                                </label>
                                <span style="font-size:13px; color:${u.status === 'active' ? 'var(--success)' : '#f39c12'}; font-weight:800;">
                                    ${u.status === 'active' ? 'نشط' : (u.status === 'inactive' ? 'غير نشط' : 'موقوف')}
                                </span>
                            </div>
                        </td>
                        <td>
                            <label class="switch">
                                <input type="checkbox" ${u.deviceId ? 'checked' : ''} onchange="toggleDeviceLock('${u.id}', this.checked)">
                                <span class="slider"></span>
                            </label>
                        </td>
                        <td>
                            <div class="item-actions">
                                <button class="btn btn-sm" onclick="resetDevice('${u.id}')" title="إعادة تعيين الجهاز">
                                    <i class="fas fa-mobile-alt"></i>
                                </button>
                                <button class="btn btn-sm" style="background:#3b82f6; color:white;" onclick="editStudent('${u.id}')" title="تعديل البيانات">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteStudent('${u.id}','${u.name}')" title="حذف">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
                }).join('');
            }
            const countEl = document.getElementById('students-count');
            if (countEl) countEl.textContent = `إجمالي النتائج: ${filtered.length} طالب`;
        }

        async function toggleStudentStatus(id, currentStatus) {
            // Treat anything not 'active' as a candidate for activation
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            try {
                const res = await fetch(`${API_URL}/users/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }) });
                if(!res.ok) throw new Error('فشل التحديث');
                await loadStudents();
                alert(`✅ تم ${newStatus === 'active' ? 'تفعيل' : 'إلغاء تفعيل'} حساب الطالب بنجاح.`);
            } catch(e) { alert('حدث خطأ: ' + e.message); }
        }

        async function approveStudent(id) {
            try {
                const res = await fetch(`${API_URL}/users/${id}`, { 
                    method: 'PUT', 
                    headers: {'Content-Type':'application/json'}, 
                    body: JSON.stringify({ status: 'active' }) 
                });
                if(res.ok) {
                    await loadStudents();
                    alert('✅ تم قبول الطالب بنجاح، يمكنه الآن دخول المنصة.');
                }
            } catch(e) { alert('حدث خطأ: ' + e.message); }
        }

        async function resetDevice(id) {
            if (!confirm('هل تريد إعادة تعيين قفل الجهاز لهذا الطالب؟')) return;
            try {
                await fetch(`${API_URL}/users/${id}/reset-device`, { method: 'PUT' });
                await loadStudents();
                alert('✅ تم إعادة تعيين قفل الجهاز.');
            } catch(e) { alert('حدث خطأ: ' + e.message); }
        }

        async function deleteStudent(id, name) {
            if (!confirm(`هل تريد حذف الطالب "${name}" نهائيًا؟`)) return;
            try {
                await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
                await loadStudents();
            } catch(e) { alert('حدث خطأ: ' + e.message); }
        }

        // --- Bulk Actions ---
        function toggleSelectAll(checked) {
            document.querySelectorAll('.student-select').forEach(cb => {
                cb.checked = checked;
            });
            updateBulkBar();
        }

        function updateBulkBar() {
            const selected = document.querySelectorAll('.student-select:checked');
            const bar = document.getElementById('bulk-actions-bar');
            const count = document.getElementById('selected-count');
            if (selected.length > 0) {
                bar.style.display = 'flex';
                count.textContent = selected.length;
            } else {
                bar.style.display = 'none';
                document.getElementById('select-all-students').checked = false;
            }
        }

        async function bulkStatusUpdate(status) {
            const ids = Array.from(document.querySelectorAll('.student-select:checked')).map(cb => cb.value);
            if (!confirm(`هل تريد تغيير حالة ${ids.length} طالب إلى ${status === 'active' ? 'نشط' : 'غير نشط'}؟`)) return;
            
            try {
                for (let id of ids) {
                    await fetch(`${API_URL}/users/${id}`, { 
                        method: 'PUT', 
                        headers: {'Content-Type':'application/json'}, 
                        body: JSON.stringify({ status }) 
                    });
                }
                alert('✅ تم تحديث الحالات بنجاح.');
                await loadStudents();
                updateBulkBar();
            } catch(e) { alert('حدث خطأ: ' + e.message); }
        }

        async function bulkDeleteStudents() {
            const ids = Array.from(document.querySelectorAll('.student-select:checked')).map(cb => cb.value);
            if (!confirm(`⚠️ تحذير: هل أنت متأكد من حذف ${ids.length} طالب نهائيًا؟ لا يمكن التراجع!`)) return;

            try {
                for (let id of ids) {
                    await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
                }
                alert('✅ تم حذف الطلاب المختارين بنجاح.');
                await loadStudents();
                updateBulkBar();
            } catch(e) { alert('حدث خطأ: ' + e.message); }
        }

        async function toggleDeviceLock(id, locked) {
            try {
                await fetch(`${API_URL}/users/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ deviceId: locked ? '' : '' }) });
            } catch(e) {}
        }

        function openStudentModal() {
            document.getElementById('studentModalTitle').innerText = 'إضافة طالب جديد';
            document.getElementById('student-id').value = '';
            document.getElementById('studentForm').reset();
            openModal('studentModal');
        }

        async function editStudent(id) {
            const u = allStudents.find(user => user.id === id);
            if (!u) return;

            document.getElementById('studentModalTitle').innerText = 'تعديل بيانات الطالب';
            document.getElementById('student-id').value = u.id;
            document.getElementById('student-name-field').value = u.name || '';
            document.getElementById('student-phone-field').value = u.phone || '';
            document.getElementById('student-password-field').value = u.password || '';
            document.getElementById('student-parent-phone-field').value = u.parentPhone || '';
            document.getElementById('student-school-field').value = u.school || '';
            document.getElementById('student-class-field').value = u.classId || '';
            updateModalDrop('student-group-field', u.classId);
            document.getElementById('student-group-field').value = u.groupId || '';

            // Avatar preview
            const avatarImg = document.getElementById('student-modal-avatar-img');
            const avatarIcon = document.getElementById('student-modal-avatar-icon');
            document.getElementById('student-avatar-data').value = u.avatar || '';
            if (u.avatar) {
                avatarImg.src = u.avatar;
                avatarImg.style.display = 'block';
                avatarIcon.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarIcon.style.display = 'block';
                avatarIcon.innerHTML = `<span style="font-size:30px;font-weight:800;">${(u.name||'?').charAt(0)}</span>`;
            }

            openModal('studentModal');
        }

        function previewStudentAvatar(input) {
            if (!input.files || !input.files[0]) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = 150; canvas.height = 150;
                    const ctx = canvas.getContext('2d');
                    const size = Math.min(img.width, img.height);
                    ctx.drawImage(img, (img.width-size)/2, (img.height-size)/2, size, size, 0, 0, 150, 150);
                    const base64 = canvas.toDataURL('image/jpeg', 0.75);
                    document.getElementById('student-avatar-data').value = base64;
                    document.getElementById('student-modal-avatar-img').src = base64;
                    document.getElementById('student-modal-avatar-img').style.display = 'block';
                    document.getElementById('student-modal-avatar-icon').style.display = 'none';
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }

        async function handleStudentSubmit(e) {
            e.preventDefault();
            const editId = document.getElementById('student-id').value;
            const name = document.getElementById('student-name-field').value.trim();
            const phone = document.getElementById('student-phone-field').value.trim();
            const password = document.getElementById('student-password-field').value.trim();
            const classId = document.getElementById('student-class-field').value.trim();
            const groupId = document.getElementById('student-group-field').value.trim();
            const parentPhone = document.getElementById('student-parent-phone-field').value.trim();
            const school = document.getElementById('student-school-field').value.trim();
            const avatar = document.getElementById('student-avatar-data').value;
            
            if (password.length < 8) {
                alert('عذراً، يجب أن تتكون كلمة المرور من 8 رموز أو حروف أو أرقام على الأقل.');
                return;
            }

            const payload = {
                id: editId || phone,
                name, phone, password, classId, groupId,
                parentPhone, school,
                role: 'student', status: 'active'
            };
            if (avatar) payload.avatar = avatar;

            const method = editId ? 'PUT' : 'POST';
            const url = editId ? `${API_URL}/users/${editId}` : `${API_URL}/users`;

            try {
                const res = await fetch(url, { 
                    method: method, 
                    headers: {'Content-Type':'application/json'}, 
                    body: JSON.stringify(payload) 
                });
                const data = await res.json();
                if (data.success) { 
                    closeModal('studentModal'); 
                    await loadStudents(); 
                    alert(`✅ تم ${editId ? 'تحديث' : 'إضافة'} الطالب بنجاح.`);
                } else {
                    alert('❌ فشل العملية: ' + (data.msg || data.error || 'خطأ غير معروف'));
                }
            } catch(e) { 
                alert('❌ حدث خطأ في الاتصال بالخادم: ' + e.message);
            }
        }

        function openAddAdminModal() {
            document.getElementById('adminAccountForm').reset();
            document.getElementById('admin-id').value = '';
            document.getElementById('adminModalTitle').innerText = 'إضافة مدير جديد للمنصة';
            openModal('adminAccountModal');
        }

        function editAdmin(id) {
            const u = allStudents.find(x => x.id === id);
            if (!u) return;
            
            document.getElementById('admin-id').value = u.id;
            document.getElementById('admin-name').value = u.name;
            document.getElementById('admin-phone').value = u.phone;
            document.getElementById('admin-password').value = u.password || '';
            
            let permsObj = u.permissions || {};
            const isLegacy = Object.keys(permsObj).length === 0 || permsObj.dashboard !== undefined;
            
            document.querySelectorAll('.perm-chk').forEach(chk => {
                if(isLegacy) {
                    chk.checked = true; // For legacy ones, enable all by default on edit to avoid locking out, except manage_admins
                    if(chk.value === 'manage_admins') chk.checked = false;
                } else {
                    chk.checked = !!permsObj[chk.value];
                }
            });
            
            document.getElementById('adminModalTitle').innerText = 'تعديل بيانات وصلاحيات المدير تفصيلياً';
            openModal('adminAccountModal');
        }

        async function handleAdminSubmit(e) {
            e.preventDefault();
            const editId = document.getElementById('admin-id').value;
            const name = document.getElementById('admin-name').value.trim();
            const phone = document.getElementById('admin-phone').value.trim();
            const password = document.getElementById('admin-password').value.trim();
            
            const permissions = {};
            document.querySelectorAll('.perm-chk').forEach(chk => {
                permissions[chk.value] = chk.checked;
            });

            const payload = { id: editId || phone, name, phone, password, role: 'admin', status: 'active', permissions };
            const method = editId ? 'PUT' : 'POST';
            const url = editId ? `${API_URL}/users/${editId}` : `${API_URL}/users`;

            try {
                const res = await fetch(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
                const data = await res.json();
                if (data.success) { 
                    closeModal('adminAccountModal'); 
                    await loadStudents(); // refresh all
                    alert(`✅ تم ${editId ? 'تحديث بيانات' : 'إضافة'} المدير بنجاح.`);
                } else {
                    alert('❌ فشل العملية: ' + (data.msg || data.error));
                }
            } catch(e) { alert('❌ حدث خطأ في الاتصال بالخادم: ' + e.message); }
        }

        async function updateStats() {
            try {
                let classList = Object.keys(db.classes || {});
                let groupCount = 0;
                let lessonCount = 0;
                
                const table = document.getElementById('platform-overview-table');
                if (table) table.innerHTML = '';

                classList.forEach(cid => {
                    const cls = db.classes[cid];
                    let groups = Object.keys(cls.groups || {}).length;
                    groupCount += groups;
                    
                    let coursesCount = 0;
                    for(let gid in cls.groups) {
                        let grp = cls.groups[gid];
                        coursesCount += Object.keys(grp.courses || {}).length;
                        for(let crid in grp.courses) {
                            for(let t of ['term1','term2']) {
                                let units = grp.courses[crid][t]?.units || {};
                                for(let uid in units) {
                                    let l = units[uid].lessons || {};
                                    lessonCount += Object.keys(l).length;
                                }
                            }
                        }
                    }

                    if (table) {
                        const studentCount = allStudents.filter(s => s.classId === cid).length;
                        table.innerHTML += `
                            <tr>
                                <td>${cls.name}</td>
                                <td>${groups}</td>
                                <td>${coursesCount}</td>
                                <td>${studentCount}</td>
                            </tr>
                        `;
                    }
                });

                document.getElementById('stats-classes').innerText = classList.length;
                if(document.getElementById('stats-groups')) document.getElementById('stats-groups').innerText = groupCount;
                document.getElementById('stats-lessons').innerText = lessonCount;
                document.getElementById('stats-students').innerText = allStudents.filter(u => u.role === 'student').length;
            } catch (e) { console.error("Update Stats Error", e); }
        }

        // Modals Toggle
        function openModal(id) { document.getElementById(id).classList.add('active'); }
        function closeModal(id) { 
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove('active');
            
            const form = document.getElementById(id.replace('Modal','Form'));
            if (form) form.reset();
            
            const idField = document.getElementById(id.split('M')[0]+'-id');
            if (idField) idField.value = '';
        }

        // Helpers for Dropdowns
        function refreshAllDropdowns() {
            const classSelects = document.querySelectorAll('.fill-classes, .filter-select');
            classSelects.forEach(select => {
                const pre = select.value;
                select.innerHTML = select.classList.contains('filter-select') ? '<option value="">اختر الصف...</option>' : '<option value="" disabled selected>اختر الصف...</option>';
                for(let id in db.classes) {
                    select.innerHTML += `<option value="${id}">${db.classes[id].name}</option>`;
                }
                if(pre && db.classes[pre]) select.value = pre;
            });
        }

        function updateFilterDrop(targetId, classId, type = 'group') {
            const target = document.getElementById(targetId);
            target.innerHTML = '<option value="">الكل</option>';
            if(type === 'group') {
                if(!classId || !db.classes[classId] || !db.classes[classId].groups) return;
                const groups = db.classes[classId].groups;
                for(let id in groups) target.innerHTML += `<option value="${id}">${groups[id].name}</option>`;
            } else if(type === 'unit') {
                // Here classId is actually the groupId from previous drop
                // We need the classId too, so let's find it
                const cid = document.getElementById('report-filter-class').value;
                if(!cid || !classId || !db.classes[cid].groups[classId]) return;
                const grp = db.classes[cid].groups[classId];
                for(let crid in grp.courses) {
                    for(let t of ['term1','term2']) {
                        const units = grp.courses[crid][t].units || {};
                        for(let uid in units) target.innerHTML += `<option value="${uid}">${units[uid].title} (${t === 'term1' ? 'ت1' : 'ت2'})</option>`;
                    }
                }
            } else if(type === 'lesson') {
                // Here classId is the unitId
                const cid = document.getElementById('report-filter-class').value;
                const gid = document.getElementById('report-filter-group').value;
                if(!cid || !gid) return;
                const grp = db.classes[cid].groups[gid];
                for(let crid in grp.courses) {
                    for(let t of ['term1','term2']) {
                        const units = grp.courses[crid][t].units || {};
                        if(units[classId]) {
                            const lessons = units[classId].lessons || {};
                            for(let lid in lessons) target.innerHTML += `<option value="${lid}">${lessons[lid].title}</option>`;
                        }
                    }
                }
            }
        }

        function updateFilterDropCourse(targetId, classId, groupId) {
            const target = document.getElementById(targetId);
            target.innerHTML = '<option value="">الكل</option>';
            if(!groupId || !db.classes[classId].groups[groupId].courses) return;
            const courses = db.classes[classId].groups[groupId].courses;
            for(let id in courses) target.innerHTML += `<option value="${id}">${courses[id].name}</option>`;
        }

        function updateFilterDropUnit(targetId, classId, groupId, courseId, term) {
            const target = document.getElementById(targetId);
            target.innerHTML = '<option value="">الكل</option>';
            if(!courseId || !db.classes[classId].groups[groupId].courses[courseId][term]) return;
            const units = db.classes[classId].groups[groupId].courses[courseId][term].units || {};
            for(let id in units) target.innerHTML += `<option value="${id}">${units[id].title}</option>`;
        }

        function updateModalDrop(targetId, classId) {
            const target = document.getElementById(targetId);
            target.innerHTML = '<option value="" disabled selected>اختر المجموعة...</option>';
            if(!classId || !db.classes[classId] || !db.classes[classId].groups) return;
            const groups = db.classes[classId].groups;
            for(let id in groups) target.innerHTML += `<option value="${id}">${groups[id].name}</option>`;
        }
        function updateModalDropCourse(targetId, classId, groupId) {
            const target = document.getElementById(targetId);
            target.innerHTML = '<option value="" disabled selected>اختر المقرر...</option>';
            if(!groupId || !db.classes[classId].groups[groupId].courses) return;
            const courses = db.classes[classId].groups[groupId].courses;
            for(let id in courses) target.innerHTML += `<option value="${id}">${courses[id].name}</option>`;
        }
        function updateModalDropUnit(targetId, classId, groupId, courseId, term) {
            const target = document.getElementById(targetId);
            target.innerHTML = '<option value="" disabled selected>اختر الوحدة...</option>';
            if(!courseId || !db.classes[classId].groups[groupId].courses[courseId][term]) return;
            const units = db.classes[classId].groups[groupId].courses[courseId][term].units || {};
            for(let id in units) target.innerHTML += `<option value="${id}">${units[id].title}</option>`;
        }

        // --- Class Management ---
        function handleClassSubmit(e) {
            e.preventDefault();
            const id = document.getElementById('class-id').value || generateId();
            const name = document.getElementById('class-name').value;
            if(!db.classes[id]) db.classes[id] = { groups: {} };
            db.classes[id].name = name;
            saveDB(); renderClasses(); closeModal('classModal');
        }
        function renderClasses() {
            const list = document.getElementById('classes-list');
            list.innerHTML = '';
            for(let id in db.classes) {
                list.innerHTML += `<div class="item-row">
                    <div><strong>${db.classes[id].name}</strong></div>
                    <div class="item-actions">
                        <button class="btn btn-sm" onclick="editClass('${id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteClass('${id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
            }
        }
        function editClass(id) { document.getElementById('class-id').value = id; document.getElementById('class-name').value = db.classes[id].name; document.getElementById('classModalTitle').innerText = "تعديل الصف"; openModal('classModal'); }
        function deleteClass(id) { if(confirm('هل أنت متأكد؟')) { delete db.classes[id]; saveDB(); renderClasses(); } }

        // --- Group Management ---
        function handleGroupSubmit(e) {
            e.preventDefault();
            const id = document.getElementById('group-id').value || generateId();
            const classId = document.getElementById('group-class-id').value;
            const name = document.getElementById('group-name').value;
            if(!db.classes[classId].groups) db.classes[classId].groups = {};
            if(!db.classes[classId].groups[id]) db.classes[classId].groups[id] = { courses: {} };
            db.classes[classId].groups[id].name = name;
            saveDB(); renderGroups(); closeModal('groupModal');
        }
        function renderGroups() {
            const list = document.getElementById('groups-list');
            const classFilter = document.getElementById('group-filter-class').value;
            list.innerHTML = '';
            for(let cid in db.classes) {
                if(classFilter && classFilter !== cid) continue;
                let groups = db.classes[cid].groups || {};
                for(let gid in groups) {
                    list.innerHTML += `<div class="item-row">
                        <div><strong>${groups[gid].name}</strong> <small style="color:var(--text-muted);">(${db.classes[cid].name})</small></div>
                        <div class="item-actions">
                            <button class="btn btn-sm" onclick="editGroup('${cid}','${gid}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="deleteGroup('${cid}','${gid}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>`;
                }
            }
        }
        function editGroup(cid, gid) {
            document.getElementById('group-id').value = gid;
            document.getElementById('group-class-id').value = cid;
            document.getElementById('group-name').value = db.classes[cid].groups[gid].name;
            document.getElementById('groupModalTitle').innerText = "تعديل المجموعة";
            openModal('groupModal');
        }
        function deleteGroup(cid, gid) { if(confirm('هل أنت متأكد؟')) { delete db.classes[cid].groups[gid]; saveDB(); renderGroups(); } }

        // --- Course Management ---
        function handleCourseSubmit(e) {
            e.preventDefault();
            const id = document.getElementById('course-id').value || generateId();
            const cid = document.getElementById('course-class-id').value;
            const gid = document.getElementById('course-group-id').value;
            const name = document.getElementById('course-name').value;
            if(!db.classes[cid].groups[gid].courses) db.classes[cid].groups[gid].courses = {};
            if(!db.classes[cid].groups[gid].courses[id]) db.classes[cid].groups[gid].courses[id] = { term1: {units:{}}, term2: {units:{}} };
            db.classes[cid].groups[gid].courses[id].name = name;
            saveDB(); renderCourses(); closeModal('courseModal');
        }
        function renderCourses() {
            const list = document.getElementById('courses-list');
            const cFilter = document.getElementById('course-filter-class').value;
            const gFilter = document.getElementById('course-filter-group').value;
            list.innerHTML = '';
            for(let cid in db.classes) {
                if(cFilter && cFilter !== cid) continue;
                let groups = db.classes[cid].groups || {};
                for(let gid in groups) {
                    if(gFilter && gFilter !== gid) continue;
                    let courses = groups[gid].courses || {};
                    for(let csid in courses) {
                        list.innerHTML += `<div class="item-row">
                            <div><strong>${courses[csid].name}</strong> <small style="color:var(--text-muted);">(${groups[gid].name} - ${db.classes[cid].name})</small></div>
                            <div class="item-actions">
                                <button class="btn btn-sm" onclick="editCourse('${cid}','${gid}','${csid}')"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger" onclick="deleteCourse('${cid}','${gid}','${csid}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>`;
                    }
                }
            }
        }
        function editCourse(cid, gid, csid) {
            document.getElementById('course-id').value = csid;
            document.getElementById('course-class-id').value = cid;
            updateModalDrop('course-group-id', cid);
            document.getElementById('course-group-id').value = gid;
            document.getElementById('course-name').value = db.classes[cid].groups[gid].courses[csid].name;
            document.getElementById('courseModalTitle').innerText = "تعديل المقرر";
            openModal('courseModal');
        }
        function deleteCourse(cid, gid, csid) { if(confirm('هل أنت متأكد؟')) { delete db.classes[cid].groups[gid].courses[csid]; saveDB(); renderCourses(); } }

        // --- Unit Management ---
        function handleUnitSubmit(e) {
            e.preventDefault();
            const id = document.getElementById('unit-id').value || generateId();
            const cid = document.getElementById('unit-class-id').value;
            const gid = document.getElementById('unit-group-id').value;
            const csid = document.getElementById('unit-course-id').value;
            const term = document.getElementById('unit-term').value;
            const title = document.getElementById('unit-title').value;
            const desc = document.getElementById('unit-desc').value;
            const order = document.getElementById('unit-order').value;
            const locked = document.getElementById('unit-locked').checked;
            
            let tObj = db.classes[cid].groups[gid].courses[csid][term];
            if(!tObj.units) tObj.units = {};
            if(!tObj.units[id]) tObj.units[id] = { lessons: {} };
            
            tObj.units[id] = { ...tObj.units[id], title, desc, order, locked };
            saveDB(); renderUnits(); closeModal('unitModal');
        }
        function renderUnits() {
            const list = document.getElementById('units-list');
            const cF = document.getElementById('unit-filter-class').value;
            const gF = document.getElementById('unit-filter-group').value;
            const csF = document.getElementById('unit-filter-course').value;
            const tF = document.getElementById('unit-filter-term').value;
            list.innerHTML = '';

            for(let cid in db.classes) {
                if(cF && cF !== cid) continue;
                for(let gid in db.classes[cid].groups) {
                    if(gF && gF !== gid) continue;
                    for(let csid in db.classes[cid].groups[gid].courses) {
                        if(csF && csF !== csid) continue;
                        let tObj = db.classes[cid].groups[gid].courses[csid][tF];
                        if(!tObj || !tObj.units) continue;
                        for(let uid in tObj.units) {
                            let u = tObj.units[uid];
                            list.innerHTML += `<div class="item-row">
                                <div><strong>${u.title}</strong> <small style="color:var(--text-muted);">(ترتيب: ${u.order} | قفل: ${u.locked ? 'نعم' : 'لا'})</small></div>
                                <div class="item-actions">
                                    <button class="btn btn-sm" onclick="editUnit('${cid}','${gid}','${csid}','${tF}','${uid}')"><i class="fas fa-edit"></i></button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteUnit('${cid}','${gid}','${csid}','${tF}','${uid}')"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>`;
                        }
                    }
                }
            }
        }
        function editUnit(cid, gid, csid, tF, uid) {
            document.getElementById('unit-id').value = uid;
            document.getElementById('unit-class-id').value = cid;
            updateModalDrop('unit-group-id', cid); document.getElementById('unit-group-id').value = gid;
            updateModalDropCourse('unit-course-id', cid, gid); document.getElementById('unit-course-id').value = csid;
            document.getElementById('unit-term').value = tF;
            
            let u = db.classes[cid].groups[gid].courses[csid][tF].units[uid];
            document.getElementById('unit-title').value = u.title;
            document.getElementById('unit-desc').value = u.desc;
            document.getElementById('unit-order').value = u.order;
            document.getElementById('unit-locked').checked = u.locked;
            document.getElementById('unitModalTitle').innerText = "تعديل الوحدة";
            openModal('unitModal');
        }
        function deleteUnit(cid, gid, csid, tF, uid) { if(confirm('هل أنت متأكد؟')) { delete db.classes[cid].groups[gid].courses[csid][tF].units[uid]; saveDB(); renderUnits(); } }

        // --- Lesson Management ---
        function handleLessonSubmit(e) {
            e.preventDefault();
            const id = document.getElementById('lesson-id').value || generateId();
            const cid = document.getElementById('lesson-class-id').value;
            const gid = document.getElementById('lesson-group-id').value;
            const csid = document.getElementById('lesson-course-id').value;
            const term = document.getElementById('lesson-term').value;
            const uid = document.getElementById('lesson-unit-id').value;
            
            const title = document.getElementById('lesson-title').value;
            const desc = document.getElementById('lesson-desc').value;
            const order = document.getElementById('lesson-order').value;
            const locked = document.getElementById('lesson-locked').checked;
            
            let uObj = db.classes[cid].groups[gid].courses[csid][term].units[uid];
            if(!uObj.lessons) uObj.lessons = {};
            if(!uObj.lessons[id]) uObj.lessons[id] = { videoZone:{}, podcastZone:{}, mindscapeZone:{}, gameZone:{}, quizZone:{} };
            
            uObj.lessons[id] = { ...uObj.lessons[id], title, desc, order, locked };
            saveDB(); renderLessons(); closeModal('lessonModal');
        }
        function renderLessons() {
            const list = document.getElementById('lessons-list');
            const cF = document.getElementById('lesson-filter-class').value;
            const gF = document.getElementById('lesson-filter-group').value;
            const csF = document.getElementById('lesson-filter-course').value;
            const tF = document.getElementById('lesson-filter-term').value;
            const uF = document.getElementById('lesson-filter-unit').value;
            list.innerHTML = '';

            for(let cid in db.classes) {
                if(cF && cF !== cid) continue;
                for(let gid in db.classes[cid].groups) {
                    if(gF && gF !== gid) continue;
                    for(let csid in db.classes[cid].groups[gid].courses) {
                        if(csF && csF !== csid) continue;
                        let tObj = db.classes[cid].groups[gid].courses[csid][tF];
                        if(!tObj || !tObj.units) continue;
                        for(let uid in tObj.units) {
                            if(uF && uF !== uid) continue;
                            let lessons = tObj.units[uid].lessons || {};
                            for(let lid in lessons) {
                                let l = lessons[lid];
                                list.innerHTML += `<div class="item-row">
                                    <div><strong>${l.title}</strong> <small style="color:var(--text-muted);">(ترتيب: ${l.order} | قفل: ${l.locked ? 'نعم' : 'لا'})</small></div>
                                    <div class="item-actions">
                                        <button class="btn btn-sm" onclick="editLesson('${cid}','${gid}','${csid}','${tF}','${uid}','${lid}')"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteLesson('${cid}','${gid}','${csid}','${tF}','${uid}','${lid}')"><i class="fas fa-trash"></i></button>
                                    </div>
                                </div>`;
                            }
                        }
                    }
                }
            }
        }
        function editLesson(cid, gid, csid, tF, uid, lid) {
            document.getElementById('lesson-id').value = lid;
            document.getElementById('lesson-class-id').value = cid;
            updateModalDrop('lesson-group-id', cid); document.getElementById('lesson-group-id').value = gid;
            updateModalDropCourse('lesson-course-id', cid, gid); document.getElementById('lesson-course-id').value = csid;
            document.getElementById('lesson-term').value = tF;
            updateModalDropUnit('lesson-unit-id', cid, gid, csid, tF); document.getElementById('lesson-unit-id').value = uid;
            
            let l = db.classes[cid].groups[gid].courses[csid][tF].units[uid].lessons[lid];
            document.getElementById('lesson-title').value = l.title;
            document.getElementById('lesson-desc').value = l.desc;
            document.getElementById('lesson-order').value = l.order;
            document.getElementById('lesson-locked').checked = l.locked;
            document.getElementById('lessonModalTitle').innerText = "تعديل الدرس";
            openModal('lessonModal');
        }
        function deleteLesson(cid, gid, csid, tF, uid, lid) { if(confirm('هل أنت متأكد؟')) { delete db.classes[cid].groups[gid].courses[csid][tF].units[uid].lessons[lid]; saveDB(); renderLessons(); } }

        // --- Content Zones ---
        function buildNavLessonSelectors() {
            const selects = document.querySelectorAll('.lesson-selector');
            selects.forEach(sel => {
                sel.innerHTML = '<option value="">اختر الدرس...</option>';
                for(let cid in db.classes) {
                    for(let gid in db.classes[cid].groups) {
                        for(let csid in db.classes[cid].groups[gid].courses) {
                            for(let t of ['term1', 'term2']) {
                                let u = db.classes[cid].groups[gid].courses[csid][t]?.units || {};
                                for(let uid in u) {
                                    let l = u[uid].lessons || {};
                                    for(let lid in l) {
                                        sel.innerHTML += `<option value="${cid},${gid},${csid},${t},${uid},${lid}">${l[lid].title} (${db.classes[cid].name})</option>`;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        function getLessonRef(pathStr) {
            if(!pathStr) return null;
            let p = pathStr.split(',');
            return db.classes[p[0]].groups[p[1]].courses[p[2]][p[3]].units[p[4]].lessons[p[5]];
        }

        function toggleQuizMode(mode) {
            const linkMode = document.getElementById('quiz-link-mode');
            const nativeMode = document.getElementById('quiz-native-mode');
            const btnLink = document.getElementById('btn-quiz-link');
            const btnNative = document.getElementById('btn-quiz-native');

            if(mode === 'link') {
                linkMode.style.display = 'block';
                nativeMode.style.display = 'none';
                btnLink.style.background = 'var(--primary)';
                btnNative.style.background = '#444';
            } else {
                linkMode.style.display = 'none';
                nativeMode.style.display = 'block';
                btnLink.style.background = '#444';
                btnNative.style.background = 'var(--primary)';
            }
        }

        function removeQuestionFromPreview(index) {
            if(!confirm('هل تريد إزالة هذا السؤال من الاختبار الحالي؟ (لن يحذف من بنك الأسئلة)')) return;
            const raw = document.getElementById('quiz-native-data').value;
            if (!raw) return;
            try {
                let parsed = JSON.parse(raw);
                let questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
                questions.splice(index, 1);
                
                if (Array.isArray(parsed)) {
                    parsed = questions;
                } else {
                    parsed.questions = questions;
                }
                document.getElementById('quiz-native-data').value = JSON.stringify(parsed);
                renderQuizPreview(questions);
            } catch(e) { }
        }

        function renderQuizPreview(questions) {
            const preview = document.getElementById('ai-quiz-preview');
            preview.innerHTML = `<h5><i class="fas fa-check-circle text-success"></i> أسئلة الاختبار (${questions.length}):</h5>`;
            const letters = ['أ','ب','ج','د','هـ','و'];
            questions.forEach((q, i) => {
                const opts = q.options || q.choices || [];
                let optionsHtml = '';
                if(opts.length) {
                    optionsHtml = `<ul style="list-style:none; padding:8px 10px 0;">${opts.map((o,oi) => `<li><i class="far fa-circle"></i> ${letters[oi]||''}- ${o}</li>`).join('')}</ul>`;
                }
                preview.innerHTML += `
                    <div class="card" style="background:rgba(255,255,255,0.05); padding:12px; margin-bottom:10px; font-size:14px; position:relative;">
                        <button type="button" onclick="removeQuestionFromPreview(${i})" 
                                style="position:absolute; left:10px; top:10px; background:rgba(255,71,87,0.15); border:1px solid rgba(255,71,87,0.4); color:var(--danger); border-radius:6px; padding:4px 10px; cursor:pointer; font-size:12px;" 
                                title="إزالة السؤال من هذا الاختبار">
                            <i class="fas fa-trash-alt"></i> إزالة
                        </button>
                        <div style="margin-left:70px;">
                            <strong>س${i+1}: ${q.question}</strong>
                            ${optionsHtml}
                            <div class="text-success" style="font-size:12px; margin-top:8px;"><i class="fas fa-key"></i> الإجابة: ${q.answer || q.correct || ''}</div>
                        </div>
                    </div>`;
            });
        }

        async function generateAIQuiz() {
            const text = document.getElementById('ai-quiz-text').value.trim();
            if(!text) return alert('برجاء كتابة الأسئلة أولاً');
            
            const btn = document.getElementById('btn-generate-ai');
            const preview = document.getElementById('ai-quiz-preview');
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التوليد...';
            preview.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-magic fa-spin"></i> أقوم بتحويل أسئلتك إلى اختبار الآن...</div>';

            try {
                const res = await fetch(`${API_URL}/quiz/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, language: 'auto' })
                });
                const data = await res.json();
                
                if (data.quizzes && data.quizzes[0]) {
                    const quiz = data.quizzes[0];
                    document.getElementById('quiz-native-data').value = JSON.stringify(quiz);
                    renderQuizPreview(quiz.questions);
                }
            } catch (e) {
                alert('حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.');
                preview.innerHTML = '';
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-microchip"></i> توليد الاختبار الآن';
            }
        }

        function loadZoneData(zone) {
            const prefix = zone.replace('Zone', '').toLowerCase();
            const selEl = document.getElementById(`${prefix}-lesson-select`);
            const lPath = selEl.value;

            if (!lPath) return document.getElementById(`${prefix}Form`).reset();

            const l = getLessonRef(lPath);
            if (!l) return document.getElementById(`${prefix}Form`).reset();

            const data = l[zone] || {};
            const titleEl = document.getElementById(`${prefix}-title`);
            if (titleEl) titleEl.value = data.title || '';

            if (zone === 'quizZone') {
                document.getElementById('quiz-url').value = data.url || '';
                document.getElementById('quiz-duration').value = data.duration || '';
                document.getElementById('quiz-deadline').value = data.deadline || '';
                document.getElementById('quiz-native-data').value = data.nativeData ? JSON.stringify(data.nativeData) : '';
                if (data.nativeData) {
                    toggleQuizMode('native');
                    let rawQs = Array.isArray(data.nativeData) ? data.nativeData : (data.nativeData.questions || []);
                    renderQuizPreview(rawQs);
                } else {
                    toggleQuizMode('link');
                    document.getElementById('ai-quiz-preview').innerHTML = '';
                }
            } else {
                const urlEl = document.getElementById(`${prefix}-url`);
                if (urlEl) urlEl.value = data.url || '';
            }

            if (zone === 'videoZone') {
                const wm = document.getElementById('video-watermark');
                if (wm) wm.value = data.watermark || '';
                const drm = document.getElementById('video-drm');
                if (drm) drm.checked = data.drm || false;
                const lrn = document.getElementById('video-learn-file');
                if (lrn) lrn.value = data.learnFile || '';
            }

            if (zone === 'gameZone') {
                updateGamePreview(`${prefix}-preview`, data.url || '');
            } else {
                updatePreview(`${prefix}-preview`, data.url || '');
            }
        }

        async function saveZoneData(e, zone) {
            e.preventDefault();
            const prefix = zone.replace('Zone', '').toLowerCase();
            const selEl = document.getElementById(`${prefix}-lesson-select`);
            const lPath = selEl.value;

            if (!lPath) return alert('برجاء اختيار الدرس أولاً');

            try {
                const l = getLessonRef(lPath);
                if (!l) return alert('خطأ: لم يتم العثور على بيانات الدرس. جرب تحديث الصفحة.');

                let data = {
                    title: document.getElementById(`${prefix}-title`)?.value || '',
                    url:   document.getElementById(`${prefix}-url`)?.value || ''
                };

                if (zone === 'quizZone') {
                    const str = document.getElementById('quiz-native-data')?.value;
                    if (str) {
                        try { data.nativeData = JSON.parse(str); } catch(_) {}
                    }
                    data.duration = document.getElementById('quiz-duration')?.value || '';
                    data.deadline = document.getElementById('quiz-deadline')?.value || '';
                }

                if (zone === 'videoZone') {
                    data.watermark = document.getElementById('video-watermark')?.value || '';
                    data.drm       = document.getElementById('video-drm')?.checked || false;
                    data.learnFile = document.getElementById('video-learn-file')?.value.trim() || '';
                }

                l[zone] = data;

                await saveDB();

                // Re-select the option because saveDB rebuilt the dropdowns!
                setTimeout(() => {
                    const freshSel = document.getElementById(`${prefix}-lesson-select`);
                    if (freshSel) freshSel.value = lPath;
                }, 50);

                alert('تم حفظ التعديلات بنجاح ✅');
            } catch (err) {
                console.error('saveZoneData error:', err);
                alert('حدث خطأ أثناء الحفظ: ' + err.message);
            }
        }

        function deleteZoneData(zone) {
            const prefix = zone.replace('Zone', '').toLowerCase();
            const lPath = document.getElementById(`${prefix}-lesson-select`).value;
            if(!lPath) return alert('برجاء اختيار الدرس أولاً');
            
            if(!confirm(`هل أنت متأكد من حذف محتوى هذا القسم لهذا الدرس؟`)) return;
            
            const l = getLessonRef(lPath);
            if(l) {
                l[zone] = {}; // مسح البيانات
                saveDB();
                loadZoneData(zone); // تحديث الحقول والمعاينة
                alert('تم حذف المحتوى بنجاح!');
            }
        }

        function updatePreview(containerId, url) {
            const container = document.getElementById(containerId);
            if(!container) return;
            if(!url) { container.innerHTML = ''; return; }
            
            // If user pasted an entire <iframe> code, extract the src link
            let finalUrl = url.trim();
            if (finalUrl.toLowerCase().startsWith('<iframe')) {
                const match = finalUrl.match(/src=["']([^"']+)["']/i);
                if (match) {
                    finalUrl = match[1];
                }
            }
            
            if(finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be')) {
                // Extract video ID and convert to embed format
                const str = finalUrl;
                let vidId = null;
                if (/^[\w-]{11}$/.test(str)) vidId = str;
                else {
                    const m = str.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/);
                    if (m) vidId = m[1];
                }
                if (!vidId) {
                    container.innerHTML = `<div style="padding:40px;text-align:center;color:#e74c3c;">⚠️ رابط YouTube غير صالح</div>`;
                    return;
                }
                const embed = `https://www.youtube-nocookie.com/embed/${vidId}`;
                container.innerHTML = `<iframe src="${embed}" allowfullscreen style="width:100%;height:100%;border:none;"></iframe>`;
            } else {
                let outUrl = finalUrl;
                // Google Drive Detection
                if (outUrl.includes('drive.google.com')) {
                    outUrl = outUrl.replace(/\/view.*/, '/preview');
                }
                // OneDrive & SharePoint Detection
                else if (outUrl.includes('onedrive.live.com') || outUrl.includes('1drv.ms') || outUrl.includes('sharepoint.com')) {
                    if (outUrl.includes('view.aspx')) outUrl = outUrl.replace('view.aspx', 'embed');
                    else if (outUrl.includes('embed.aspx')) {
                        // Already a perfect embed link
                    } else {
                        const separator = outUrl.includes('?') ? '&' : '?';
                        outUrl = outUrl.includes('action=embedview') ? outUrl : outUrl + separator + 'action=embedview';
                    }
                }
                container.innerHTML = `<iframe src="${outUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            }
        }

        function updateGamePreview(containerId, urlsText) {
            const container = document.getElementById(containerId);
            if(!container) return;
            if(!urlsText) { container.innerHTML = ''; return; }
            
            container.innerHTML = '';
            const urls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
            urls.forEach(url => {
                let finalUrl = url;
                if (finalUrl.toLowerCase().startsWith('<iframe')) {
                    const match = finalUrl.match(/src=["']([^"']+)["']/i);
                    if (match) finalUrl = match[1];
                }
                const wrapper = document.createElement('div');
                wrapper.style.marginBottom = '15px';
                wrapper.innerHTML = `<iframe src="${finalUrl}" style="width:100%;height:300px;border:1px solid #ddd;border-radius:10px;"></iframe>`;
                container.appendChild(wrapper);
            });
        }

        function updateQuizPreview(containerId, urlsText) {
            const container = document.getElementById(containerId);
            if(!container) return;
            if(!urlsText) { container.innerHTML = ''; return; }
            
            container.innerHTML = '';
            const urls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
            urls.forEach(url => {
                let finalUrl = url;
                if (finalUrl.toLowerCase().startsWith('<iframe')) {
                    const match = finalUrl.match(/src=["']([^"']+)["']/i);
                    if (match) finalUrl = match[1];
                }
                const wrapper = document.createElement('div');
                wrapper.style.marginBottom = '15px';
                wrapper.innerHTML = `<iframe src="${finalUrl}" style="width:100%;height:300px;border:1px solid #ddd;border-radius:10px;"></iframe>`;
                container.appendChild(wrapper);
            });
        }

        // Reports & Results
        function initReports() {
            refreshAllDropdowns();
            const clsDrop = document.getElementById('report-filter-class');
            if(clsDrop) {
                clsDrop.innerHTML = '<option value="">اختر الصف...</option>';
                for(let id in db.classes) {
                    clsDrop.innerHTML += `<option value="${id}">${db.classes[id].name}</option>`;
                }
            }
        }

        async function fetchLessonReport(lessonId) {
            if(!lessonId) return;
            const body = document.getElementById('reports-table-body');
            body.innerHTML = '<tr><td colspan="6" class="text-center">جارِ تحميل النتائج...</td></tr>';
            try {
                const res = await fetch(`${API_URL}/admin/reports/${lessonId}`);
                const data = await res.json();
                
                if (data.error) throw new Error(data.error);
                if (!Array.isArray(data)) throw new Error("تنسيق البيانات غير مدعوم.");

                body.innerHTML = '';
                if(data.length === 0) {
                    body.innerHTML = '<tr><td colspan="6" class="text-center text-danger">لا توجد نتائج لهذا الدرس بعد.</td></tr>';
                    return;
                }

                // Group attempts by student userId
                const studentsGroups = {};
                data.forEach(att => {
                    const key = att.userId;
                    const aNum = att.attemptNum || 1; // Default to 1 for old records
                    if(!studentsGroups[key]) {
                        studentsGroups[key] = {
                            name: att.studentName,
                            phone: att.studentPhone,
                            userId: att.userId,
                            attempts: {}
                        };
                    }
                    studentsGroups[key].attempts[aNum] = att;
                });

                for(let uid in studentsGroups) {
                    const s = studentsGroups[uid];
                    const att1 = s.attempts[1];
                    const lastDate = att1 ? (att1.endTime ? new Date(att1.endTime).toLocaleString('ar-EG') : 'بدأ الحل الآن') : '---';
                    body.innerHTML += `
                        <tr>
                            <td class="fw-700">${s.name}</td>
                            <td class="fs-sm opacity-70">${s.phone}</td>
                            <td>
                                ${att1 ? `<span class="text-primary fw-800" style="font-size:16px;">${att1.score || 'تحت الحل'}</span>` : '<span class="opacity-30">---</span>'}
                            </td>
                            <td class="fs-sm opacity-70">${lastDate}</td>
                            <td>
                                ${att1 ? `
                                    <button class="btn btn-sm btn-success" style="padding:6px 15px; font-size:12px;" onclick="reviewStudentQuiz('${att1._id}')">
                                        <i class="fas fa-eye"></i> مراجعة الإجابات
                                    </button>
                                ` : '<span class="opacity-30">---</span>'}
                            </td>
                        </tr>
                    `;
                }
                window.currentReportData = data;
            } catch (e) { 
                console.error(e); 
                body.innerHTML = `<tr><td colspan="5" class="text-center text-danger">⚠️ خطأ في تحميل البيانات:<br><small>${e.message || e}</small></td></tr>`; 
            }
        }



        async function reviewStudentQuiz(attemptId) {
            const attempt = window.currentReportData.find(a => a._id === attemptId);
            if(!attempt) return;
            
            let targetLesson = null;
            let found = false;
            for(let cid in db.classes) {
                for(let gid in db.classes[cid].groups) {
                    for(let crid in db.classes[cid].groups[gid].courses) {
                        for(let t of ['term1','term2']) {
                            const units = db.classes[cid].groups[gid].courses[crid][t]?.units || {};
                            for(let uid in units) {
                                if(units[uid].lessons && units[uid].lessons[attempt.lessonId]) {
                                    targetLesson = units[uid].lessons[attempt.lessonId];
                                    found = true; break;
                                }
                            }
                            if(found) break;
                        }
                        if(found) break;
                    }
                    if(found) break;
                }
                if(found) break;
            }

            if(!targetLesson) {
                alert("⚠️ لم يتم العثور على هذا الدرس في قاعدة البيانات. قد يكون قد تم حذفه أو نقله.");
                return;
            }

            if(!targetLesson.quizZone || !targetLesson.quizZone.nativeData) {
                alert("ℹ️ هذا الاختبار يعتمد على 'رابط خارجي'؛ مراجعة الإجابات التفصيلية متاحة فقط للاختبارات التي تم إنشاؤها داخل المنصة.");
                return;
            }

            try {
                const quiz = targetLesson.quizZone.nativeData;
                document.getElementById('review-student-name').innerText = `إجابات الطالب: ${attempt.studentName}`;
                document.getElementById('review-start-time').innerText = attempt.startTime ? new Date(attempt.startTime).toLocaleString('ar-EG') : 'غير متوفر';
                document.getElementById('review-end-time').innerText = attempt.endTime ? new Date(attempt.endTime).toLocaleString('ar-EG') : 'غير متوفر';
                document.getElementById('review-total-questions').innerText = quiz.questions ? quiz.questions.length : '0';

                const scoreParts = attempt.score ? attempt.score.split(' / ') : ['0','0'];
                const correctCount = parseInt(scoreParts[0]) || 0;
                const totalCount = parseInt(scoreParts[1]) || 1;
                const pct = Math.round((correctCount / totalCount) * 100);
                
                document.getElementById('review-pct-text').textContent = pct + '%';
                const offset = 283 - (283 * pct / 100);
                document.getElementById('review-pct-ring').setAttribute('stroke-dashoffset', offset);

                const list = document.getElementById('review-questions-list');
                list.innerHTML = '';
                
                if (quiz.questions && Array.isArray(quiz.questions)) {
                    quiz.questions.forEach((q, i) => {
                        const studentAns = (attempt.answers && attempt.answers[i]) || 'لم يتم الحل';
                        const isCorrect = studentAns === q.answer;
                        list.innerHTML += `
                            <div style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 12px; border: 1px solid ${isCorrect ? 'rgba(46,213,115,0.3)' : 'rgba(255,71,87,0.3)'};">
                                <div class="fw-700 mb-8" style="font-size:15px;">س${i+1}: ${q.question}</div>
                                <div class="fs-sm">
                                    <span style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}">📍 إجابة الطالب: ${studentAns}</span><br>
                                    ${!isCorrect ? `<span style="color: var(--success); font-weight:700;">✅ الإجابة الصحيحة: ${q.answer}</span>` : ''}
                                </div>
                            </div>
                        `;
                    });
                } else {
                    list.innerHTML = '<div class="text-center p-20">لا توجد أسئلة لعرضها لهذا الاختبار.</div>';
                }

                openModal('quizReviewModal');
            } catch (err) {
                console.error(err);
                alert("⚠️ حدث خطأ أثناء معالجة بيانات المراجعة.");
            }
        }
        async function fetchProgressReport() {
            const container = document.getElementById('progress-report-container');
            const tbody = document.getElementById('progress-table-body');
            const classFilter = document.getElementById('progress-filter-class').value;
            const groupFilter = document.getElementById('progress-filter-group').value;

            container.style.display = 'block';
            tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> جارٍ تحميل البيانات...</td></tr>';
            try {
                const res = await fetch(`${API_URL}/users`);
                const students = await res.json();
                
                const allLessons = [];
                for(let cid in db.classes) {
                    for(let gid in db.classes[cid].groups) {
                        for(let crid in db.classes[cid].groups[gid].courses) {
                            for(let t of ['term1','term2']) {
                                const units = db.classes[cid].groups[gid].courses[crid][t]?.units || {};
                                for(let uid in units) {
                                    for(let lid in units[uid].lessons) {
                                        allLessons.push({ ...units[uid].lessons[lid], id: lid });
                                    }
                                }
                            }
                        }
                    }
                }

                tbody.innerHTML = '';
                let hasStudents = false;
                students.forEach(s => {
                    if (s.role === 'admin') return;
                    
                    if (classFilter && s.classId !== classFilter) return;
                    if (groupFilter && s.groupId !== groupFilter) return;

                    hasStudents = true;
                    const completed = s.completedLessons || [];
                    const lastId = completed[completed.length - 1];
                    const lastLesson = allLessons.find(l => l.id === lastId);
                    const lastLessonName = lastLesson ? lastLesson.title : 'لم يبدأ بعد';
                    
                    const clsName = db.classes[s.classId]?.name || 'غير محدد';
                    const grpName = db.classes[s.classId]?.groups?.[s.groupId]?.name || 'غير محدد';

                    let studentTotalLessonsCount = 0;
                    const cls = db.classes[s.classId];
                    if (cls && cls.groups && cls.groups[s.groupId]) {
                        const grp = cls.groups[s.groupId];
                        for(let crid in grp.courses) {
                            for(let t of ['term1','term2']) {
                                const units = grp.courses[crid][t]?.units || {};
                                for(let uid in units) {
                                    studentTotalLessonsCount += Object.keys(units[uid].lessons || {}).length;
                                }
                            }
                        }
                    }

                    tbody.innerHTML += `
                        <tr>
                            <td class="fw-700">${s.name}</td>
                            <td class="fs-sm opacity-70">${s.phone}</td>
                            <td><span class="badge" style="background:rgba(255,255,255,0.1);">${clsName} / ${grpName}</span></td>
                            <td>
                                <div class="fw-800" style="color:var(--primary); font-size:15px; margin-bottom:5px;">${lastLessonName}</div>
                                <div class="fs-sm text-muted">
                                    <span style="color:var(--success); font-weight:bold; font-size:14px;">${completed.length}</span> إنجاز / <span style="font-weight:bold; font-size:14px;">${studentTotalLessonsCount}</span> إجمالي الدروس
                                </div>
                            </td>
                        </tr>
                    `;
                });
                
                if (!hasStudents) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">لا يوجد طلاب مطابقين للبحث</td></tr>';
            } catch (err) {
                console.error(err);
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">حدث خطأ في جلب البيانات</td></tr>';
            }
        }
        function renderQuestionBank() {
            const container = document.getElementById('question-bank-content');
            container.innerHTML = '<div class="text-center" style="padding:20px;"><i class="fas fa-spinner fa-spin"></i> جارٍ تحميل بنك الأسئلة...</div>';

            const letters = ['أ','ب','ج','د','هـ','و'];
            let html = '';
            let clsIdx = 0;
            let hasAny = false;

            for(let cid in db.classes) {
                const clsName = db.classes[cid]?.name || 'صف بدون اسم';
                const clsBodyId = `qb-cls-body-${clsIdx}`;
                const clsIconId = `qb-cls-icon-${clsIdx}`;

                let lessonsHtml = '';
                let clsTotalQ = 0;
                let lessonCount = 0;
                let gi = 0;

                for(let gid in db.classes[cid].groups) {
                    for(let crid in db.classes[cid].groups[gid].courses) {
                        for(let t of ['term1','term2']) {
                            const units = db.classes[cid].groups[gid].courses[crid][t]?.units || {};
                            for(let uid in units) {
                                const lessons = units[uid].lessons || {};
                                for(let lid in lessons) {
                                    const lesson = lessons[lid];
                                    const quizZone = lesson?.quizZone;
                                    if (!quizZone || quizZone.hiddenFromBank) continue;

                                    let nd = quizZone.nativeData;
                                    if (!nd) continue;
                                    if (typeof nd === 'string') { try { nd = JSON.parse(nd); } catch(e) { continue; } }

                                    let allQuestions = Array.isArray(nd) ? nd : (nd.questions || []);
                                    if (!allQuestions.length) continue;

                                    const bodyId = `qb-body-${clsIdx}-${gi}`;
                                    const iconId = `qb-icon-${clsIdx}-${gi}`;
                                    const grpName = db.classes[cid]?.groups?.[gid]?.name || '';
                                    const pathStr = `'${cid}','${gid}','${crid}','${t}','${uid}','${lid}'`;

                                    let questionsHtml = '';
                                    let visibleCount = 0;
                                    
                                    allQuestions.forEach((q, qi) => {
                                        if (q.hiddenFromBank) return;
                                        visibleCount++;
                                        const opts = q.options || q.choices || [];
                                        questionsHtml += `
                                            <div id="qb-qcard-${cid}-${lid}-${qi}" style="background:rgba(255,255,255,0.04); border-radius:10px; padding:15px; border:1px solid rgba(255,255,255,0.06); margin-bottom:10px;">
                                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                                                    <div class="fw-700" style="font-size:15px; flex:1;">
                                                        <span style="color:var(--primary); margin-left:6px;">${visibleCount}.</span>${q.question}
                                                    </div>
                                                    <button onclick="deleteQBQuestion(${pathStr}, ${qi})"
                                                            style="background:rgba(255,71,87,0.15); border:1px solid rgba(255,71,87,0.4); color:var(--danger);
                                                                   border-radius:6px; padding:4px 10px; cursor:pointer; font-size:12px; white-space:nowrap; margin-right:8px;"
                                                            title="حذف هذا السؤال">
                                                        <i class="fas fa-trash-alt"></i>
                                                    </button>
                                                </div>
                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                                    ${opts.map((opt, oi) => {
                                                        const label = letters[oi] || (oi+1);
                                                        const isCorrect = opt === q.answer || oi === q.correctIndex || label === q.answer || opt === q.correct;
                                                        return `<div style="padding:8px 12px; border-radius:8px; font-size:14px;
                                                            background:${isCorrect ? 'rgba(46,213,115,0.15)' : 'rgba(255,255,255,0.04)'};
                                                            border:1px solid ${isCorrect ? 'rgba(46,213,115,0.4)' : 'rgba(255,255,255,0.08)'};
                                                            color:${isCorrect ? 'var(--success)' : 'inherit'};
                                                            font-weight:${isCorrect ? '700' : '400'};">
                                                            ${isCorrect ? '✅' : ''} <strong>${label}-</strong> ${opt}
                                                        </div>`;
                                                    }).join('')}
                                                </div>
                                                <div style="margin-top:10px; font-size:13px; color:var(--success); font-weight:700;">
                                                    <i class="fas fa-check-circle"></i> الإجابة الصحيحة: ${q.answer || q.correct || '—'}
                                                </div>
                                            </div>`;
                                    });

                                    if (visibleCount === 0) continue;
                                    
                                    hasAny = true;
                                    clsTotalQ += visibleCount;
                                    lessonCount++;

                                    lessonsHtml += `
                                        <div style="margin-bottom:10px; border:1px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden;">
                                            <div style="background:rgba(255,255,255,0.05); padding:12px 18px;
                                                        display:flex; justify-content:space-between; align-items:center;">
                                                <div onclick="toggleQBSection('${bodyId}','${iconId}')"
                                                     style="flex:1; cursor:pointer; user-select:none; display:flex; align-items:center; gap:10px;"
                                                     onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                                                    <div>
                                                        <div class="fw-700" style="font-size:15px;">
                                                            <i class="fas fa-file-alt" style="color:var(--primary); margin-left:8px; font-size:13px;"></i>${lesson.title || 'درس بدون اسم'}
                                                        </div>
                                                        ${grpName ? `<div class="fs-sm text-muted" style="margin-top:2px;"><i class="fas fa-users fa-sm"></i> ${grpName}</div>` : ''}
                                                    </div>
                                                </div>
                                                <div style="display:flex; align-items:center; gap:8px;">
                                                    <span class="badge" style="background:rgba(109,58,238,0.3); font-size:12px;">${visibleCount} سؤال</span>
                                                    <button onclick="deleteQBLesson(${pathStr})"
                                                            style="background:rgba(255,71,87,0.15); border:1px solid rgba(255,71,87,0.4); color:var(--danger);
                                                                   border-radius:6px; padding:4px 10px; cursor:pointer; font-size:12px;"
                                                            title="حذف كل أسئلة هذا الدرس">
                                                        <i class="fas fa-trash"></i> حذف الكل
                                                    </button>
                                                    <i id="${iconId}" class="fas fa-chevron-left" style="color:var(--primary); transition:transform 0.3s; font-size:12px; cursor:pointer;"
                                                       onclick="toggleQBSection('${bodyId}','${iconId}')"></i>
                                                </div>
                                            </div>
                                            <div id="${bodyId}" style="display:none; padding:15px; flex-direction:column;">
                                                ${questionsHtml}
                                            </div>
                                        </div>`;
                                    gi++;
                                }
                            }
                        }
                    }
                }

                if (lessonsHtml) {
                    html += `
                    <div style="margin-bottom:20px; border:2px solid rgba(109,58,238,0.5); border-radius:16px; overflow:hidden;">
                        <div onclick="toggleQBSection('${clsBodyId}','${clsIconId}')"
                             style="background:linear-gradient(135deg,rgba(109,58,238,0.6),rgba(109,58,238,0.3));
                                    padding:18px 22px; display:flex; justify-content:space-between; align-items:center;
                                    cursor:pointer; user-select:none;"
                             onmouseover="this.style.background='linear-gradient(135deg,rgba(109,58,238,0.8),rgba(109,58,238,0.5))'"
                             onmouseout="this.style.background='linear-gradient(135deg,rgba(109,58,238,0.6),rgba(109,58,238,0.3))'">
                            <div>
                                <div class="fw-800" style="font-size:20px;">
                                    <i class="fas fa-layer-group" style="margin-left:10px; color:#e0d0ff;"></i>${clsName}
                                </div>
                                <div class="fs-sm" style="color:rgba(255,255,255,0.7); margin-top:4px;">
                                    ${lessonCount} درس &nbsp;•&nbsp; ${clsTotalQ} سؤال إجمالي
                                </div>
                            </div>
                            <i id="${clsIconId}" class="fas fa-chevron-down" style="color:white; font-size:20px; transition:transform 0.3s;"></i>
                        </div>
                        <div id="${clsBodyId}" style="display:none; padding:15px; flex-direction:column;">
                            ${lessonsHtml}
                        </div>
                    </div>`;
                    clsIdx++;
                }
            }

            if (!hasAny) {
                container.innerHTML = `
                    <div class="text-center" style="padding:60px; color:var(--text-muted);">
                        <i class="fas fa-inbox fa-3x" style="opacity:0.3; display:block; margin-bottom:15px;"></i>
                        <p>لا توجد أسئلة محفوظة حتى الآن.</p>
                        <p class="fs-sm">قم بتوليد اختبار من قسم Quiz Zone أولاً.</p>
                    </div>`;
                return;
            }
            container.innerHTML = html;
        }

        function deleteQBQuestion(cid, gid, crid, t, uid, lid, qIdx) {
            if (!confirm('هل تريد حذف هذا السؤال من بنك الأسئلة؟\\n(ملاحظة: سيظل موجوداً في الاختبار الأساسي للدرس)')) return;
            try {
                const lesson = db.classes[cid].groups[gid].courses[crid][t].units[uid].lessons[lid];
                let nd = lesson.quizZone.nativeData;
                if (typeof nd === 'string') nd = JSON.parse(nd);
                let questions = Array.isArray(nd) ? nd : (nd.questions || []);
                
                questions[qIdx].hiddenFromBank = true;
                
                if (Array.isArray(nd)) {
                    lesson.quizZone.nativeData = questions;
                } else {
                    nd.questions = questions;
                    lesson.quizZone.nativeData = nd;
                }
                saveDB();
                renderQuestionBank();
            } catch(e) { alert('حدث خطأ أثناء الحذف: ' + e.message); }
        }

        function deleteQBLesson(cid, gid, crid, t, uid, lid) {
            const lesson = db.classes[cid]?.groups?.[gid]?.courses?.[crid]?.[t]?.units?.[uid]?.lessons?.[lid];
            const title = lesson?.title || 'هذا الدرس';
            if (!confirm(`هل تريد إخفاء كل أسئلة "${title}" من بنك الأسئلة؟\\n(ملاحظة: ستظل موجودة في الاختبار الأساسي للدرس)`)) return;
            try {
                db.classes[cid].groups[gid].courses[crid][t].units[uid].lessons[lid].quizZone.hiddenFromBank = true;
                saveDB();
                renderQuestionBank();
            } catch(e) { alert('حدث خطأ أثناء الحذف: ' + e.message); }
        }

        function toggleQBSection(bodyId, iconId) {
            const body = document.getElementById(bodyId);
            const icon = document.getElementById(iconId);
            if (!body) return;

            const isOpen = body.style.display === 'flex';
            body.style.display = isOpen ? 'none' : 'flex';
            if (icon) {
                icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }

        // ── Question Bank Picker ───────────────────────────────────────
        let _qbAllQuestions = []; // flat list of all questions with metadata

        function openQBPicker() {
            _qbAllQuestions = [];
            const content = document.getElementById('qbp-content');
            const counter = document.getElementById('qbp-count');
            counter.textContent = '0';
            content.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i> جارٍ تحميل الأسئلة...</div>';
            openModal('qbPickerModal');

            const letters = ['أ','ب','ج','د','هـ','و'];
            let html = '';
            let qIdx = 0;
            let clsPickIdx = 0;

            for(let cid in db.classes) {
                const clsName = db.classes[cid]?.name || '';
                const clsBodyId = `qbp-cls-${clsPickIdx}`;
                const clsIconId = `qbp-cls-icon-${clsPickIdx}`;
                let lessonsHtml = '';
                let clsTotalQ = 0;
                let lessonPickIdx = 0;

                for(let gid in db.classes[cid].groups) {
                    for(let crid in db.classes[cid].groups[gid].courses) {
                        for(let t of ['term1','term2']) {
                            const units = db.classes[cid].groups[gid].courses[crid][t]?.units || {};
                            for(let uid in units) {
                                const lessons = units[uid].lessons || {};
                                for(let lid in lessons) {
                                    const lesson = lessons[lid];
                                    const quizZone = lesson?.quizZone;
                                    if (!quizZone?.nativeData || quizZone.hiddenFromBank) continue;

                                    let nd = quizZone.nativeData;
                                    if (typeof nd === 'string') { try { nd = JSON.parse(nd); } catch(e) { continue; } }

                                    let allQs = Array.isArray(nd) ? nd : (nd.questions || []);
                                    if (!allQs.length) continue;

                                    const lesBodyId = `qbp-les-${clsPickIdx}-${lessonPickIdx}`;
                                    const lesIconId = `qbp-les-icon-${clsPickIdx}-${lessonPickIdx}`;

                                    let questionsHtml = '';
                                    let visibleCount = 0;
                                    
                                    allQs.forEach((q, qi) => {
                                        if (q.hiddenFromBank) return;
                                        visibleCount++;
                                        const globalIdx = qIdx++;
                                        _qbAllQuestions.push(q);
                                        const opts = q.options || q.choices || [];
                                        const optsHtml = opts.map((o, oi) => {
                                            const lbl = letters[oi] || (oi+1);
                                            return `<span style="margin-left:10px; font-size:12px;">${lbl}- ${o}</span>`;
                                        }).join('');
                                        questionsHtml += `
                                            <div onclick="toggleQBPick(${globalIdx}, this)"
                                                 id="qbp-q-${globalIdx}"
                                                 style="padding:12px 14px; border-radius:10px; margin-bottom:8px; cursor:pointer;
                                                        border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03);
                                                        transition: all 0.2s;" data-selected="false">
                                                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                                    <div class="fw-700" style="font-size:14px; flex:1;">${qi+1}. ${q.question}</div>
                                                    <i class="fas fa-square" style="color:rgba(255,255,255,0.2); margin-right:10px; margin-top:3px; font-size:18px;" id="qbp-chk-${globalIdx}"></i>
                                                </div>
                                                <div style="margin-top:6px; color:var(--text-muted);">${optsHtml}</div>
                                                <div style="margin-top:4px; font-size:12px; color:var(--success); font-weight:700;">
                                                    ✅ ${q.answer || q.correct || ''}
                                                </div>
                                            </div>`;
                                    });

                                    if (visibleCount === 0) continue;
                                    clsTotalQ += visibleCount;

                                    lessonsHtml += `
                                        <div style="margin-bottom:8px; border:1px solid rgba(255,255,255,0.07); border-radius:10px; overflow:hidden;">
                                            <div onclick="toggleQBSection('${lesBodyId}','${lesIconId}')"
                                                 style="background:rgba(255,255,255,0.04); padding:10px 14px;
                                                        display:flex; justify-content:space-between; align-items:center;
                                                        cursor:pointer; user-select:none;"
                                                 onmouseover="this.style.background='rgba(109,58,238,0.2)'"
                                                 onmouseout="this.style.background='rgba(255,255,255,0.04)'">
                                                <div class="fw-700" style="font-size:14px;">
                                                    <i class="fas fa-file-alt" style="color:var(--primary); margin-left:6px; font-size:12px;"></i>${lesson.title}
                                                </div>
                                                <div style="display:flex; align-items:center; gap:8px;">
                                                    <span class="badge" style="background:rgba(109,58,238,0.3); font-size:11px;">${visibleCount} سؤال</span>
                                                    <i id="${lesIconId}" class="fas fa-chevron-left" style="color:var(--primary); font-size:11px; transition:transform 0.3s;"></i>
                                                </div>
                                            </div>
                                            <div id="${lesBodyId}" style="display:none; padding:12px; flex-direction:column;">
                                                ${questionsHtml}
                                            </div>
                                        </div>`;
                                    lessonPickIdx++;
                                }
                            }
                        }
                    }
                }

                if (lessonsHtml) {
                    html += `
                    <div style="margin-bottom:16px; border:2px solid rgba(109,58,238,0.4); border-radius:14px; overflow:hidden;">
                        <div onclick="toggleQBSection('${clsBodyId}','${clsIconId}')"
                             style="background:linear-gradient(135deg,rgba(109,58,238,0.55),rgba(109,58,238,0.25));
                                    padding:13px 18px; display:flex; justify-content:space-between; align-items:center;
                                    cursor:pointer; user-select:none;"
                             onmouseover="this.style.background='linear-gradient(135deg,rgba(109,58,238,0.75),rgba(109,58,238,0.45))'"
                             onmouseout="this.style.background='linear-gradient(135deg,rgba(109,58,238,0.55),rgba(109,58,238,0.25))'">
                            <div>
                                <div class="fw-800" style="font-size:16px;">
                                    <i class="fas fa-layer-group" style="margin-left:8px; color:#e0d0ff;"></i>${clsName}
                                </div>
                                <div class="fs-sm" style="color:rgba(255,255,255,0.65); margin-top:3px;">
                                    ${lessonPickIdx} درس • ${clsTotalQ} سؤال
                                </div>
                            </div>
                            <i id="${clsIconId}" class="fas fa-chevron-down" style="color:white; font-size:17px; transition:transform 0.3s;"></i>
                        </div>
                        <div id="${clsBodyId}" style="display:none; padding:12px; flex-direction:column;">
                            ${lessonsHtml}
                        </div>
                    </div>`;
                    clsPickIdx++;
                }
            }

            content.innerHTML = html || '<div class="text-center" style="padding:40px; color:var(--text-muted);">لا توجد أسئلة في البنك بعد.</div>';
        }

        function toggleQBPick(idx, el) {
            const isSelected = el.dataset.selected === 'true';
            el.dataset.selected = !isSelected;
            const chk = document.getElementById(`qbp-chk-${idx}`);

            if (!isSelected) {
                el.style.background = 'rgba(46,213,115,0.12)';
                el.style.border = '1px solid rgba(46,213,115,0.5)';
                chk.className = 'fas fa-check-square';
                chk.style.color = 'var(--success)';
            } else {
                el.style.background = 'rgba(255,255,255,0.03)';
                el.style.border = '1px solid rgba(255,255,255,0.08)';
                chk.className = 'fas fa-square';
                chk.style.color = 'rgba(255,255,255,0.2)';
            }

            const count = document.querySelectorAll('#qbp-content [data-selected="true"]').length;
            document.getElementById('qbp-count').textContent = count;
        }

        function importSelectedQuestions() {
            const selectedEls = document.querySelectorAll('#qbp-content [data-selected="true"]');
            if (selectedEls.length === 0) {
                alert('⚠️ لم تحدد أي أسئلة بعد!');
                return;
            }

            const indices = Array.from(selectedEls).map(el => parseInt(el.id.replace('qbp-q-', '')));
            const imported = indices.map(i => _qbAllQuestions[i]).filter(Boolean);

            // Merge with existing native data
            let existing = [];
            const raw = document.getElementById('quiz-native-data').value;
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    existing = Array.isArray(parsed) ? parsed : (parsed.questions || []);
                } catch(e) {}
            }

            const merged = [...existing, ...imported];
            document.getElementById('quiz-native-data').value = JSON.stringify({ questions: merged });

            renderQuizPreview(merged);

            closeModal('qbPickerModal');
            toggleQuizMode('native');
        }

        // ═══════════ HONOR BOARD ═══════════
        let honorBoardData = {}; // cached from backend

        async function initHonorBoard() {
            try {
                const res = await fetch(`${API_URL}/honor-board`);
                const data = await res.json();
                if (data.success) honorBoardData = data.honorBoard || {};
            } catch(e) { console.warn('honor board load failed', e); }
        }

        function loadHonorGroupFilter() {
            const classId = document.getElementById('honor-filter-class').value;
            const grpSel = document.getElementById('honor-filter-group');
            grpSel.innerHTML = '<option value="">اختر المجموعة...</option>';
            if (!classId || !db.classes[classId]) return;
            const groups = db.classes[classId].groups || {};
            for (let gid in groups) {
                grpSel.innerHTML += `<option value="${gid}">${groups[gid].name}</option>`;
            }
            document.getElementById('honor-students-container').style.display = 'none';
            document.getElementById('honor-board-preview').style.display = 'none';
            document.getElementById('honor-empty-msg').style.display = 'block';
        }

        async function loadHonorStudents() {
            const classId = document.getElementById('honor-filter-class').value;
            const groupId = document.getElementById('honor-filter-group').value;
            if (!classId || !groupId) return;

            const container = document.getElementById('honor-students-container');
            const list = document.getElementById('honor-students-list');
            const emptyMsg = document.getElementById('honor-empty-msg');
            const preview = document.getElementById('honor-board-preview');

            // Load students from this group
            const students = allStudents.filter(u => u.role === 'student' && u.classId === classId && u.groupId === groupId);
            if (students.length === 0) {
                list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);">لا يوجد طلاب في هذه المجموعة</div>';
                container.style.display = 'block';
                emptyMsg.style.display = 'none';
                preview.style.display = 'none';
                return;
            }

            // Current honor board for pre-checking
            const key = `${classId}_${groupId}`;
            const current = honorBoardData[key];
            const selectedIds = (current?.students || []).map(s => s.id);

            // Sort by XP descending
            students.sort((a, b) => (b.xp||0) - (a.xp||0));

            list.innerHTML = students.map(u => `
                <label style="display:flex;align-items:center;gap:12px;padding:10px 12px;cursor:pointer;border-radius:6px;transition:background 0.2s;" 
                       onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    <input type="checkbox" class="honor-chk" value="${u.id}" 
                           data-name="${u.name}" data-avatar="${u.avatar||''}" data-xp="${u.xp||0}"
                           ${selectedIds.includes(u.id) ? 'checked' : ''}
                           onchange="onHonorCheckboxChange(this)" style="width:16px;height:16px;accent-color:gold;">
                    ${u.avatar ? `<img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">` 
                               : `<div style="width:36px;height:36px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;">${(u.name||'?').charAt(0)}</div>`}
                    <div style="flex:1;">
                        <div style="font-weight:700;">${u.name}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${u.phone} • ${u.xp||0} XP ⭐</div>
                    </div>
                </label>`).join('');

            container.style.display = 'block';
            emptyMsg.style.display = 'none';
            updateHonorPreviewFromCheckboxes();
        }

        function onHonorCheckboxChange(chk) {
            const checked = document.querySelectorAll('.honor-chk:checked');
            if (checked.length > 3) {
                chk.checked = false;
                alert('⚠️ يمكنك اختيار 3 طلاب كحد أقصى فقط.');
                return;
            }
            updateHonorPreviewFromCheckboxes();
        }

        function updateHonorPreviewFromCheckboxes() {
            const preview = document.getElementById('honor-board-preview');
            const previewList = document.getElementById('honor-board-current');
            const checked = [...document.querySelectorAll('.honor-chk:checked')];
            
            if (checked.length === 0) {
                preview.style.display = 'none';
                return;
            }

            preview.style.display = 'block';
            const medals = ['🥇', '🥈', '🥉'];
            previewList.innerHTML = checked.map((chk, i) => {
                const name = chk.dataset.name;
                const avatar = chk.dataset.avatar;
                const id = chk.value;
                return `
                    <div style="display:flex;align-items:center;gap:8px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:8px;padding:8px 12px; position:relative;">
                        <span style="font-size:20px;">${medals[i] || '⭐'}</span>
                        ${avatar ? `<img src="${avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : `<div style="width:32px;height:32px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">${(name||'?').charAt(0)}</div>`}
                        <span style="font-weight:700; font-size:13px;">${name}</span>
                        <i class="fas fa-times-circle" onclick="removeFromHonorPreview('${id}')" style="cursor:pointer; color:var(--danger); margin-right:8px; font-size:16px;" title="إزالة"></i>
                    </div>`;
            }).join('');
        }

        function removeFromHonorPreview(id) {
            const chk = document.querySelector(`.honor-chk[value="${id}"]`);
            if (chk) {
                chk.checked = false;
                updateHonorPreviewFromCheckboxes();
            }
        }

        async function saveHonorBoard() {
            const classId = document.getElementById('honor-filter-class').value;
            const groupId = document.getElementById('honor-filter-group').value;
            if (!classId || !groupId) { alert('يرجى اختيار الصف والمجموعة أولاً.'); return; }

            const checked = [...document.querySelectorAll('.honor-chk:checked')];
            // Allow clicking save even with 0 if they want to clear it, 
            // but the prompt says modify/add/remove, so let's allow saving the state.
            const students = checked.map(chk => ({
                id: chk.value,
                name: chk.dataset.name,
                avatar: chk.dataset.avatar,
                xp: parseInt(chk.dataset.xp) || 0
            }));

            try {
                const res = await fetch(`${API_URL}/honor-board`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ classId, groupId, students })
                });
                const data = await res.json();
                if (data.success) {
                    const key = `${classId}_${groupId}`;
                    honorBoardData[key] = { classId, groupId, students, updatedAt: new Date().toISOString() };
                    alert('✅ تم حفظ تعديلات لوحة الشرف بنجاح!');
                } else {
                    alert('❌ فشل الحفظ: ' + data.msg);
                }
            } catch(e) { alert('❌ خطأ في الاتصال: ' + e.message); }
        }

        // ═══════════════ CHAT LOGIC ═══════════════
        let currentChatType = '';
        let currentChatId = '';
        let currentChatName = '';
        let replyToMsg = null;

        function renderChatHierarchy() {
            const list = document.getElementById('chat-nav-list');
            if (!list) return;

            let html = '';
            
            // Loop through classes
            for (let cid in db.classes) {
                const cls = db.classes[cid];
                html += `<div class="chat-nav-item level-1"><i class="fas fa-graduation-cap"></i> ${cls.name}</div>`;
                
                // Loop through groups in this class
                for (let gid in cls.groups) {
                    const grp = cls.groups[gid];
                    html += `
                        <div class="chat-nav-item level-2" onclick="toggleChatGroup('${cid}', '${gid}')">
                            <i class="fas fa-users-viewfinder"></i> ${grp.name}
                        </div>
                        <div id="chat-sub-${cid}-${gid}" style="display:none;">
                            <div class="chat-nav-item level-3" onclick="selectChatTarget('group', '${gid}', '${grp.name}')">
                                <i class="fas fa-comments"></i> دردشة المجموعة
                                <span id="unread-group-${gid}" class="unread-badge" style="display:none;">0</span>
                            </div>
                    `;
                    
                    // Filter students for this group
                    const students = allStudents.filter(s => s.role === 'student' && s.classId === cid && s.groupId === gid);
                    students.forEach(s => {
                        html += `
                            <div class="chat-nav-item level-3" onclick="selectChatTarget('student', '${s.id}', '${s.name}', '${s.avatar}')" style="display:flex; align-items:center; justify-content:space-between;">
                                <div><i class="fas fa-user"></i> ${s.name}</div>
                                <span id="unread-student-${s.id}" class="unread-badge" style="display:none;">0</span>
                            </div>
                        `;
                    });
                    
                    html += `</div>`; 
                }
            }

            if (!html) html = '<div style="padding:20px; text-align:center; color:var(--text-muted);">لا يوجد بيانات للعرض</div>';
            list.innerHTML = html;
        }

        function toggleChatGroup(cid, gid) {
            const sub = document.getElementById(`chat-sub-${cid}-${gid}`);
            if (sub) {
                const isHidden = sub.style.display === 'none';
                sub.style.display = isHidden ? 'block' : 'none';
                // Add active class to the level-2 item
                event.currentTarget.classList.toggle('active');
            }
        }

        function selectChatTarget(type, id, name, avatar = '') {
            currentChatType = type;
            currentChatId = id;
            currentChatName = name;

            // Clear unread badge
            const badgeId = type === 'group' ? `unread-group-${id}` : `unread-student-${id}`;
            const badge = document.getElementById(badgeId);
            if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
            
            // Join real-time room
            if (socket) {
                const room = type === 'group' ? id : ['admin_main', id].sort().join('_');
                socket.emit('join', room);
            }
            
            document.getElementById('chat-empty-state').style.display = 'none';
            document.getElementById('chat-active-state').style.display = 'flex';
            
            document.getElementById('chat-with-name').textContent = name;
            document.getElementById('chat-with-status').textContent = type === 'group' ? 'دردشة جماعية' : 'طالب';
            
            const avatarEl = document.getElementById('chat-avatar');
            if (avatar && avatar !== 'undefined') {
                avatarEl.innerHTML = `<img src="${avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                avatarEl.innerHTML = name.charAt(0);
                avatarEl.style.background = type === 'group' ? 'var(--primary)' : 'linear-gradient(135deg, #f59e0b, #ef4444)';
            }

            // Remove previous active classes
            document.querySelectorAll('.chat-nav-item').forEach(el => el.classList.remove('active'));
            try {
                if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');
            } catch(e) {}

            loadChatMessages();
            cancelReply();
        }

        async function loadChatMessages() {
            const msgCont = document.getElementById('chat-messages');
            msgCont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> جارٍ التحميل...</div>';

            try {
                const url = currentChatType === 'group' 
                    ? `/chat/group/${currentChatId}` 
                    : `/chat/private/admin_main/${currentChatId}`;
                
                const res = await fetch(`${API_URL}${url}`);
                const data = await res.json();
                
                if (data.success) {
                    renderMessages(data.messages);
                }
            } catch (e) { 
                console.error('Chat load error:', e); 
                msgCont.innerHTML = '<div style="padding:20px; color:var(--danger);">فشل في تحميل الرسائل</div>';
            }
        }

        function renderMessages(messages) {
            const msgCont = document.getElementById('chat-messages');
            msgCont.innerHTML = '';

            if (messages.length === 0) {
                msgCont.innerHTML = `
                    <div style="align-self:center; background:rgba(0,0,0,0.3); padding:5px 15px; border-radius:20px; font-size:12px; color:var(--text-muted); margin-bottom:10px;">
                        ابدأ المحادثة مع ${currentChatName}
                    </div>
                `;
                return;
            }

            messages.forEach(msg => appendMessageAdmin(msg));
        }

        function appendMessageAdmin(msg) {
            const msgCont = document.getElementById('chat-messages');
            
            // Remove empty state message if it is the only child or first message
            if (msgCont.children.length === 1 && msgCont.children[0].innerText.includes('ابدأ المحادثة')) {
                msgCont.innerHTML = '';
            }

            // Duplicate prevention
            if (document.getElementById(`msg-${msg._id}`)) return;

            const isSentByMe = msg.senderId === 'admin_main';
            const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            
            const container = document.createElement('div');
            container.style = "display:flex; flex-direction:column; width:100%; position:relative;";

            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${isSentByMe ? 'bubble-sent' : 'bubble-received'}`;
            bubble.id = `msg-${msg._id}`;
            if (msg.isPinned) bubble.style.border = '1px solid rgba(255,215,0,0.5)';

            let replyHtml = '';
            if (msg.replyTo) {
                replyHtml = `
                    <div style="background:rgba(0,0,0,0.1); border-right:3px solid var(--primary); padding:5px 10px; margin-bottom:5px; border-radius:4px; font-size:11px; color:var(--text-muted); line-height:1.2;">
                        <strong>${msg.replyTo.senderName}:</strong> ${msg.replyTo.message.substring(0, 30)}${msg.replyTo.message.length > 30 ? '...' : ''}
                    </div>
                `;
            }

            bubble.innerHTML = `
                ${msg.isPinned ? '<div style="font-size:10px; color:gold; margin-bottom:4px; font-weight:700;"><i class="fas fa-thumbtack"></i> مثبت</div>' : ''}
                <div style="font-size:11px; margin-bottom:2px; font-weight:800; color:${isSentByMe ? 'rgba(255,255,255,0.8)' : 'var(--primary)'}; display:${currentChatType === 'group' && !isSentByMe ? 'block' : 'none'};">
                    ${msg.senderName}
                </div>
                ${replyHtml}
                ${msg.message}
                <span class="bubble-time">${time}</span>
                <div class="msg-actions" style="position:absolute; ${isSentByMe ? 'left:-50px' : 'right:-50px'}; top:50%; transform:translateY(-50%); display:none; gap:10px; padding:0 10px;">
                    <i class="fas fa-reply" onclick="setReplyMsg('${msg._id}', '${msg.senderName}', '${msg.message}')" style="cursor:pointer; color:var(--text-muted); font-size:12px;" title="رد"></i>
                    <i class="fas fa-thumbtack" onclick="togglePin('${msg._id}')" style="cursor:pointer; color:${msg.isPinned ? 'gold' : 'var(--text-muted)'}; font-size:12px;" title="تثبيت"></i>
                    <i class="fas fa-trash" onclick="deleteMessage('${msg._id}')" style="cursor:pointer; color:var(--danger); font-size:12px;" title="حذف"></i>
                </div>
            `;

            bubble.onmouseover = () => bubble.querySelector('.msg-actions')?.style.setProperty('display', 'flex', 'important');
            bubble.onmouseout = () => bubble.querySelector('.msg-actions')?.style.setProperty('display', 'none', 'important');

            container.appendChild(bubble);
            msgCont.appendChild(container);
            msgCont.scrollTop = msgCont.scrollHeight;
        }

        function setReplyMsg(id, name, msg) {
            replyToMsg = { id, senderName: name, message: msg };
            const activeChat = document.getElementById('chat-active-state');
            const messagesArea = document.getElementById('chat-messages');

            let replyBar = document.getElementById('chat-reply-preview');
            if (!replyBar) {
                replyBar = document.createElement('div');
                replyBar.id = 'chat-reply-preview';
                replyBar.style = 'background:var(--card); padding:10px 25px; border-top:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; font-size:12px; z-index:11;';
                const inputArea = document.querySelector('.chat-input-area');
                activeChat.insertBefore(replyBar, inputArea);
            }
            replyBar.innerHTML = `
                <div style="border-right:3px solid var(--primary); padding-right:10px;">
                    <div style="color:var(--primary); font-weight:700;">الرد على ${name}</div>
                    <div style="color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:300px;">${msg}</div>
                </div>
                <i class="fas fa-times-circle" onclick="cancelReply()" style="cursor:pointer; color:var(--danger); font-size:18px;"></i>
            `;
        }

        function cancelReply() {
            replyToMsg = null;
            const replyBar = document.getElementById('chat-reply-preview');
            if (replyBar) replyBar.remove();
        }

        async function sendChatMessage() {
            const input = document.getElementById('chat-msg-input');
            const message = input.value.trim();
            if (!message) return;

            const payload = {
                senderId: 'admin_main',
                senderName: 'المدير العام',
                message,
                replyTo: replyToMsg
            };

            if (currentChatType === 'group') payload.groupId = currentChatId;
            else payload.receiverId = currentChatId;

            try {
                const url = currentChatType === 'group' ? '/chat/group' : '/chat/private';
                const res = await fetch(`${API_URL}${url}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    appendMessageAdmin(data.message);
                    input.value = '';
                    cancelReply();
                    input.focus();
                }
            } catch (e) { alert('خطأ في الإرسال: ' + e.message); }
        }

        // Real-time Typing Notification
        let typingTimeout;
        function onAdminTyping() {
            if (!socket || !currentChatId) return;
            const room = currentChatType === 'group' ? currentChatId : ['admin_main', currentChatId].sort().join('_');
            socket.emit('typing', { room, userName: 'المدير', isTyping: true });
            
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                socket.emit('typing', { room, userName: 'المدير', isTyping: false });
            }, 2000);
        }

        async function togglePin(msgId) {
            try {
                const res = await fetch(`${API_URL}/chat/${currentChatType}/${msgId}/pin`, { method: 'PUT' });
                const data = await res.json();
                if (data.success) {
                    await loadChatMessages();
                }
            } catch (e) { alert('خطأ في التثبيت: ' + e.message); }
        }

        async function deleteMessage(msgId) {
            if (!confirm('هل تريد حذف هذه الرسالة نهائياً؟')) return;
            try {
                const res = await fetch(`${API_URL}/chat/${currentChatType}/${msgId}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    await loadChatMessages();
                }
            } catch (e) { alert('خطأ في الحذف: ' + e.message); }
        }

        // ═══════════════════════════════════════════════════════════
        // ═══         TEACHER PLATFORMS MODULE                     ═══
        // ═══════════════════════════════════════════════════════════

        // Current logged-in admin/teacher ID used as teacherId
        const _adminUser = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
        const TEACHER_ID = _adminUser.id || _adminUser._id || 'admin_main';

        // Default platforms that always appear (not stored in DB)
        const DEFAULT_PLATFORMS = [
            { _id: 'default_notebooklm', name: 'NotebookLM', url: 'https://notebooklm.google.com', icon: '📓', isDefault: true },
            { _id: 'default_googledrive', name: 'Google Drive', url: 'https://drive.google.com', icon: '📁', isDefault: true },
            { _id: 'default_canva',       name: 'Canva',       url: 'https://www.canva.com',       icon: '🎨', isDefault: true }
        ];

        // Sites known to block iframes — open in new tab directly
        const IFRAME_BLOCKED_PATTERNS = [
            'notebooklm.google.com',
            'drive.google.com',
            'docs.google.com',
            'accounts.google.com',
            'canva.com',
            'facebook.com',
            'instagram.com',
            'twitter.com',
            'x.com'
        ];

        let _currentPlatformUrl  = '';
        let _currentPlatformName = '';

        function platformIsBlocked(url) {
            try {
                const host = new URL(url).hostname;
                return IFRAME_BLOCKED_PATTERNS.some(p => host.includes(p));
            } catch { return true; }
        }

        function getPlatformIcon(platform) {
            if (platform.icon) return platform.icon;
            const name = (platform.name || '').toLowerCase();
            if (name.includes('google') || name.includes('drive') || name.includes('docs')) return '📁';
            if (name.includes('canva'))    return '🎨';
            if (name.includes('notebook')) return '📓';
            if (name.includes('youtube'))  return '▶️';
            if (name.includes('zoom'))     return '📹';
            if (name.includes('meet'))     return '📹';
            if (name.includes('teams'))    return '💬';
            if (name.includes('classroom')) return '🏫';
            if (name.includes('kahoot'))   return '🎯';
            if (name.includes('quiziz'))   return '❓';
            if (name.includes('padlet'))   return '📌';
            return '🌐';
        }

        async function loadTeacherPlatforms() {
            const grid = document.getElementById('platforms-grid');
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
            try {
                const res  = await fetch(`${API_URL}/teacher-platforms?teacherId=${encodeURIComponent(TEACHER_ID)}`);
                const data = await res.json();
                const customPlatforms = data.success ? data.platforms : [];
                const allPlatforms = [...DEFAULT_PLATFORMS, ...customPlatforms];
                renderPlatformsGrid(allPlatforms);
            } catch (e) {
                renderPlatformsGrid(DEFAULT_PLATFORMS);
            }
        }

        function renderPlatformsGrid(platforms) {
            const grid = document.getElementById('platforms-grid');
            if (!platforms.length) {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-th-large fa-3x" style="opacity:0.2;"></i><p style="margin-top:15px;">لا توجد منصات بعد. اضغط «إضافة منصة» للبدء.</p></div>';
                return;
            }
            grid.innerHTML = platforms.map(p => `
                <div class="platform-card" onclick="openPlatform('${escHtml(p.url)}', '${escHtml(p.name)}')"
                     title="${escHtml(p.name)}">
                    ${!p.isDefault ? `<button class="platform-delete-btn" onclick="event.stopPropagation(); deletePlatform('${p._id}')" title="حذف"><i class="fas fa-times"></i></button>` : ''}
                    <div class="platform-icon">${getPlatformIcon(p)}</div>
                    <div class="platform-name">${escHtml(p.name)}</div>
                </div>
            `).join('');
        }

        function escHtml(str) {
            return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }

        function openPlatform(url, name) {
            _currentPlatformUrl  = url;
            _currentPlatformName = name;

            if (platformIsBlocked(url)) {
                // Open in new tab
                window.open(url, '_blank', 'noopener,noreferrer');
                return;
            }

            // Try to load in iframe
            const wrapper = document.getElementById('platform-iframe-wrapper');
            const iframe  = document.getElementById('platform-iframe');
            const title   = document.getElementById('platform-iframe-title');

            iframe.src     = url;
            title.textContent = name;
            wrapper.classList.add('active');
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Fallback: if iframe fails to load (X-Frame-Options), open in tab
            iframe.onerror = () => {
                wrapper.classList.remove('active');
                iframe.src = 'about:blank';
                window.open(url, '_blank', 'noopener,noreferrer');
            };
        }

        function closePlatformIframe() {
            const wrapper = document.getElementById('platform-iframe-wrapper');
            const iframe  = document.getElementById('platform-iframe');
            wrapper.classList.remove('active');
            iframe.src = 'about:blank';
        }

        function openCurrentPlatformTab() {
            if (_currentPlatformUrl) window.open(_currentPlatformUrl, '_blank', 'noopener,noreferrer');
        }

        async function handlePlatformSubmit(e) {
            e.preventDefault();
            const name = document.getElementById('platform-name-input').value.trim();
            const url  = document.getElementById('platform-url-input').value.trim();
            if (!name || !url) return;

            try {
                const res  = await fetch(`${API_URL}/teacher-platforms`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, url, teacherId: TEACHER_ID })
                });
                const data = await res.json();
                if (data.success) {
                    closeModal('platformModal');
                    document.getElementById('platformForm').reset();
                    loadTeacherPlatforms();
                } else {
                    alert('خطأ: ' + (data.msg || data.error));
                }
            } catch (err) {
                alert('خطأ في الاتصال بالخادم.');
            }
        }

        async function deletePlatform(id) {
            if (!confirm('هل تريد حذف هذه المنصة؟')) return;
            try {
                const res  = await fetch(`${API_URL}/teacher-platforms/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) loadTeacherPlatforms();
                else alert('خطأ أثناء الحذف.');
            } catch (err) {
                alert('خطأ في الاتصال.');
            }
        }

        // ═══════════════════════════════════════════════════════════

        // AI Lesson Generator
        async function generateAILesson() {
            const keywords = document.getElementById('ailesson-keywords').value.trim();
            if (!keywords) return alert('يرجى كتابة الكلمات المفتاحية لتوليد الدرس.');

            const btn = document.getElementById('btn-generate-ailesson');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ توليد الدرس... قد يستغرق ذلك دقيقة.';

            try {
                const res = await fetch(`${API_URL}/lesson/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keywords })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'فشل التوليد');

                if (data.success && data.html) {
                    document.getElementById('ailesson-html-data').value = data.html;
                    document.getElementById('ailesson-preview-iframe').srcdoc = data.html;
                    document.getElementById('ailesson-preview').style.display = 'block';
                    alert('✅ تم توليد الدرس بنجاح! لا تنسَ الضغط على "حفظ التغييرات" ليظهر للطلاب.');
                }
            } catch (e) {
                console.error(e);
                alert('خطأ أثناء توليد الدرس: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-microchip"></i> توليد الدرس الآن';
            }
        }
        
        // Add hooking to the loadZoneData to render preview automatically if ailessonZone exists
        const originalLoadZoneData = window.loadZoneData;
        window.loadZoneData = function(zoneType) {
            if(window.originalLoadZoneData) window.originalLoadZoneData(zoneType);
            
            // Custom setup for ailessonZone
            if (zoneType === 'ailessonZone') {
                const lPath = document.getElementById('ailesson-lesson-select').value;
                if (!lPath) return;
                
                const foundLesson = getLessonRef(lPath);

                document.getElementById('ailesson-html-data').value = '';
                document.getElementById('ailesson-preview').style.display = 'none';
                
                if (foundLesson && foundLesson.ailessonZone) {
                    if(foundLesson.ailessonZone.html) {
                        document.getElementById('ailesson-html-data').value = foundLesson.ailessonZone.html || '';
                        document.getElementById('ailesson-preview-iframe').srcdoc = foundLesson.ailessonZone.html || '';
                        document.getElementById('ailesson-preview').style.display = 'block';
                    }
                }
            }
        };

        const originalSaveZoneData = window.saveZoneData;
        window.saveZoneData = function(e, zoneType) {
            if (zoneType === 'ailessonZone') {
                e.preventDefault();
                const lPath = document.getElementById('ailesson-lesson-select').value;
                if (!lPath) return alert('يرجى اختيار الدرس أولاً.');
                const htmlVal = document.getElementById('ailesson-html-data').value;
                
                const l = getLessonRef(lPath);
                if (l) {
                    if (htmlVal) {
                        l.ailessonZone = { html: htmlVal };
                    } else {
                        l.ailessonZone = {};
                    }
                    saveDB();
                    alert('تم الحفظ بنجاح!');
                } else {
                    alert('خطأ في إيجاد مسار الدرس.');
                }
                return;
            }
            if (window.originalSaveZoneData) window.originalSaveZoneData(e, zoneType);
        };
    