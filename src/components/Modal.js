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
