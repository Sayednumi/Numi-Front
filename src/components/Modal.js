/**
 * Modal Component
 * Generates a reusable modal structure.
 * 
 * @param {string} modalId - The ID of the modal container
 * @param {string} content - The inner HTML content of the modal (title, forms, buttons)
 * @param {string} maxWidth - Optional max-width for the modal-content
 */
function renderModal(modalId, content, maxWidth = '') {
    return `
    <div class="modal" id="${modalId}">
        <div class="modal-content" ${maxWidth ? `style="max-width:${maxWidth};"` : ''}>
            ${content}
        </div>
    </div>
    `;
}

/**
 * Returns the inner HTML content specifically for the Admin Account Modal.
 */
function getAdminModalContent() {
    return `
            <h2 style="margin-bottom: 20px;" id="adminModalTitle">إضافة مدير جديد للمنصة</h2>
            <form id="adminAccountForm" onsubmit="handleAdminSubmit(event)">
                <input type="hidden" id="admin-id">
                <div class="form-group">
                    <label>اسم المدير</label>
                    <input type="text" id="admin-name" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>رقم الهاتف (الاسم المستخدم)</label>
                    <input type="text" id="admin-phone" class="form-control" required maxlength="11">
                </div>
                <div class="form-group">
                    <label>كلمة المرور</label>
                    <input type="text" id="admin-password" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>صلاحيات المدير التفصيلية:</label>

                    <div style="margin-top:10px; padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:var(--primary); display:block; margin-bottom:8px;"><i class="fas fa-user-graduate"></i> إدارة الطلاب والحسابات</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk" value="view_students" checked> استعراض بيانات الطلاب</label>
                            <label><input type="checkbox" class="perm-chk" value="add_student" checked> إضافة طلاب جدد</label>
                            <label><input type="checkbox" class="perm-chk" value="edit_student" checked> تعديل الطلاب وكلمات السر</label>
                            <label><input type="checkbox" class="perm-chk" value="delete_student" checked> حذف/حظر الطلاب</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:var(--accent); display:block; margin-bottom:8px;"><i class="fas fa-book-open"></i> إدارة المحتوى الدراسي</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk" value="view_structure" checked> رؤية الصفوف والمقررات</label>
                            <label><input type="checkbox" class="perm-chk" value="manage_structure" checked> إنشاء/حذف صفوف ومقررات</label>
                            <label><input type="checkbox" class="perm-chk" value="manage_all_groups"> التحكم بجميع المجموعات</label>
                            <label><input type="checkbox" class="perm-chk" value="manage_lessons" checked> بناء وإدارة وتعديل الدروس</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:#f59e0b; display:block; margin-bottom:8px;"><i class="fas fa-video"></i> التفاعل المباشر والتواصل</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk" value="view_live" checked> الإطلاع على الحصص المباشرة</label>
                            <label><input type="checkbox" class="perm-chk" value="manage_live" checked> جدولة وحذف الحصص المباشرة</label>
                            <label><input type="checkbox" class="perm-chk" value="view_chat" checked> الإطلاع على رسائل المجموعات</label>
                            <label><input type="checkbox" class="perm-chk" value="send_chat" checked> إرسال رسائل في المجموعات</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:var(--success); display:block; margin-bottom:8px;"><i class="fas fa-brain"></i> بنك الأسئلة والذكاء الاصطناعي</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk" value="view_qbank" checked> الإطلاع على بنك الأسئلة</label>
                            <label><input type="checkbox" class="perm-chk" value="generate_ai" checked> توليد أسئلة بالذكاء الاصطناعي</label>
                            <label><input type="checkbox" class="perm-chk" value="manage_qbank" checked> إضافة وتعديل أسئلة البنك</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:#ec4899; display:block; margin-bottom:8px;"><i class="fas fa-gamepad"></i> الأنشطة التفاعلية وبنك الألعاب</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk" value="view_games" checked> الإطلاع على بنك الألعاب (Kahoot)</label>
                            <label><input type="checkbox" class="perm-chk" value="manage_games" checked> إضافة وتحكم في ألعاب البنك</label>
                            <label><input type="checkbox" class="perm-chk" value="view_teacher_platforms" checked> رؤية منصات المعلم الخارجية</label>
                            <label><input type="checkbox" class="perm-chk" value="manage_teacher_platforms" checked> إضافة/تعديل مشاركات المنصات</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                        <strong style="color:var(--danger); display:block; margin-bottom:8px;"><i class="fas fa-shield-alt"></i> الإدارة العامة والتقارير</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk" id="manage-all-groups-chk" value="manage_all_groups" onchange="document.getElementById('admin-group-assignment').style.display=this.checked?'none':'block'"> التحكم بجميع المجموعات</label>
                            <label><input type="checkbox" class="perm-chk" value="view_dashboard" checked> استعراض إحصائيات المنصة</label>
                            <label><input type="checkbox" class="perm-chk" value="view_reports" checked> رؤية درجات وتقارير الاختبارات</label>
                            <label><input type="checkbox" class="perm-chk" value="reset_quiz" checked> التحكم في إعادة اختبار الطلاب</label>
                            <label><input type="checkbox" class="perm-chk" value="manage_teachers"> إدارة المعلمين (إضافة/تعديل معلم)</label>
                            <label><input type="checkbox" class="perm-chk" value="manage_admins"> إدارة المشرفين (خطورة عالية)</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-top:10px; display:block;" id="admin-group-assignment">
                        <strong style="color:var(--primary); display:block; margin-bottom:8px;"><i class="fas fa-layer-group"></i> تخصيص الوصول للمجموعات</strong>
                        <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">اختر المجموعات التي يمكن لهذا المسؤول إدارتها (اضغط Ctrl لتحديد أكثر من مجموعة). إذا تم تفعيل "التحكم بجميع المجموعات"، فسيتم تجاهل هذا الاختيار.</p>
                        <select id="admin-allowed-groups" class="form-control" multiple style="height:120px; font-size:13px;"></select>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top:20px;">
                    <button type="button" class="btn btn-danger" onclick="closeModal('adminAccountModal')">إلغاء</button>
                    <button type="submit" class="btn"><i class="fas fa-user-shield"></i> إنشاء حساب مدير</button>
                </div>
            </form>
    `;
}

/**
 * Returns the inner HTML content specifically for the Teacher Modal.
 */
function getTeacherModalContent() {
    return `
            <h2 style="margin-bottom: 20px;" id="teacherModalTitle">إضافة معلم جديد</h2>
            <form id="teacherForm" onsubmit="handleTeacherSubmit(event)">
                <input type="hidden" id="teacher-id">
                <div class="form-group">
                    <label>اسم المعلم</label>
                    <input type="text" id="teacher-name" class="form-control" required placeholder="مثال: أ. محمد أحمد">
                </div>
                <div class="form-group">
                    <label>رقم الهاتف (يستخدم للدخول)</label>
                    <input type="text" id="teacher-phone" class="form-control" required maxlength="11">
                </div>
                <div class="form-group">
                    <label>كلمة المرور</label>
                    <input type="text" id="teacher-password" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>تفعيل حساب المعلم</label>
                    <label class="switch"><input type="checkbox" id="teacher-active" checked><span class="slider"></span></label>
                </div>
                <div class="form-group" style="margin-top:15px; max-height: 400px; overflow-y: auto;">
                    <label>صلاحيات المعلم (ما يمكنه فعله في منصته):</label>

                    <div style="margin-top:10px; padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:var(--primary); display:block; margin-bottom:8px;"><i class="fas fa-user-graduate"></i> إدارة الطلاب والحسابات</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk-teacher" value="view_students" checked> استعراض بيانات الطلاب</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="add_student" checked> إضافة طلاب جدد</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="edit_student" checked> تعديل الطلاب وكلمات السر</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="delete_student" checked> حذف/حظر الطلاب</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:var(--accent); display:block; margin-bottom:8px;"><i class="fas fa-book-open"></i> إدارة المحتوى الدراسي</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk-teacher" value="view_structure" checked> رؤية الصفوف والمقررات</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="manage_structure" checked> إنشاء/حذف صفوف ومقررات</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="manage_lessons" checked> بناء وإدارة وتعديل الدروس</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:#f59e0b; display:block; margin-bottom:8px;"><i class="fas fa-video"></i> التفاعل المباشر والتواصل</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk-teacher" value="view_live" checked> الإطلاع على الحصص المباشرة</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="manage_live" checked> جدولة وحذف الحصص المباشرة</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="view_chat" checked> الإطلاع على رسائل المجموعات</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="send_chat" checked> إرسال رسائل في المجموعات</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:var(--success); display:block; margin-bottom:8px;"><i class="fas fa-brain"></i> بنك الأسئلة والذكاء الاصطناعي</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk-teacher" value="view_qbank" checked> الإطلاع على بنك الأسئلة</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="generate_ai" checked> توليد أسئلة بالذكاء الاصطناعي</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="manage_qbank" checked> إضافة وتعديل أسئلة البنك</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:10px;">
                        <strong style="color:#ec4899; display:block; margin-bottom:8px;"><i class="fas fa-gamepad"></i> الأنشطة التفاعلية وبنك الألعاب</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk-teacher" value="view_games" checked> الإطلاع على بنك الألعاب (Kahoot)</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="manage_games" checked> إضافة وتحكم في ألعاب البنك</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="view_teacher_platforms" checked> رؤية منصات المعلم الخارجية</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="manage_teacher_platforms" checked> إضافة/تعديل مشاركات المنصات</label>
                        </div>
                    </div>

                    <div style="padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                        <strong style="color:var(--danger); display:block; margin-bottom:8px;"><i class="fas fa-shield-alt"></i> التقارير</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
                            <label><input type="checkbox" class="perm-chk-teacher" value="view_dashboard" checked> استعراض إحصائيات المنصة</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="view_reports" checked> رؤية درجات وتقارير الاختبارات</label>
                            <label><input type="checkbox" class="perm-chk-teacher" value="reset_quiz" checked> التحكم في إعادة اختبار الطلاب</label>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top:20px;">
                    <button type="button" class="btn btn-danger" onclick="closeModal('teacherModal')">إلغاء</button>
                    <button type="submit" class="btn"><i class="fas fa-save"></i> حفظ بيانات المعلم</button>
                </div>
            </form>
    `;
}

/**
 * Returns the inner HTML content specifically for the Student Modal.
 */
function getStudentModalContent() {
    return `
            <h2 style="margin-bottom: 20px;" id="studentModalTitle">إضافة طالب جديد</h2>
            <form id="studentForm" onsubmit="handleStudentSubmit(event)">
                <input type="hidden" id="student-id">

                <!-- Avatar Upload -->
                <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:20px;">
                    <div style="position:relative; width:80px; height:80px; border-radius:50%; overflow:hidden; background:var(--bg-elevated); display:flex; align-items:center; justify-content:center; border:2px solid var(--primary-light); box-shadow:0 4px 15px rgba(0,0,0,0.3);">
                        <img id="student-modal-avatar-img" src="" alt="" style="width:100%;height:100%;object-fit:cover;display:none;">
                        <span id="student-modal-avatar-icon" style="font-size:30px; color:var(--text-muted);"><i class="fas fa-user"></i></span>
                    </div>
                    <label class="btn btn-ghost btn-sm mt-16" style="cursor:pointer; margin-top:10px; font-size:12px;">
                        تغيير الصورة الشخصية <i class="fas fa-camera"></i>
                        <input type="file" id="student-avatar-upload" accept="image/*" style="display:none;" onchange="previewStudentAvatar(this)">
                    </label>
                    <input type="hidden" id="student-avatar-data">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                    <div class="form-group">
                        <label>الاسم الكامل <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="student-name-field" class="form-control" required placeholder="مثال: أحمد محمد">
                    </div>
                    <div class="form-group">
                        <label>رقم الهاتف <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="student-phone-field" class="form-control" required placeholder="01XXXXXXXXX" maxlength="11">
                    </div>
                    <div class="form-group">
                        <label>كلمة المرور <span style="color:var(--danger)">*</span></label>
                        <div class="password-wrapper">
                            <input type="password" id="student-password-field" class="form-control" required placeholder="8 رموز أو حروف أو أرقام على الأقل">
                            <i class="fas fa-eye password-toggle" onclick="togglePass('student-password-field', this)"></i>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>رقم هاتف ولي الأمر</label>
                        <input type="text" id="student-parent-phone-field" class="form-control" placeholder="01XXXXXXXXX" maxlength="11">
                    </div>
                    <div class="form-group">
                        <label>اسم المدرسة</label>
                        <input type="text" id="student-school-field" class="form-control" placeholder="مثال: مدرسة النجاح">
                    </div>
                    <div class="form-group">
                        <label>الصف الدراسي <span style="color:var(--danger)">*</span></label>
                        <select id="student-class-field" class="form-control fill-classes" required
                            onchange="updateModalDrop('student-group-field', this.value)"></select>
                    </div>
                    <div class="form-group">
                        <label>المجموعة <span style="color:var(--danger)">*</span></label>
                        <select id="student-group-field" class="form-control" required>
                            <option value="" disabled selected>اختر الصف أولاً...</option>
                        </select>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top:20px;">
                    <button type="button" class="btn btn-danger" onclick="closeModal('studentModal')">إلغاء</button>
                    <button type="submit" class="btn"><i class="fas fa-save"></i> حفظ الطالب</button>
                </div>
            </form>
    `;
}
