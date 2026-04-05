const DB_USERS = [
    { id: "2024001", phone: "01000000000", name: "طالب Numi", grade: "الصف الثالث الثانوي" },
    { id: "12345", phone: "01012345678", name: "أحمد محمد", grade: "الصف الثاني الثانوي" }
];

const Auth = {
    login: (phone, code) => {
        if (!phone || phone.length !== 11) return { success: false, msg: "يجب أن يكون رقم الهاتف 11 رقماً." };
        
        const user = DB_USERS.find(u => u.id === code && u.phone === phone);
        if (user) {
            let userData = StorageHelper.load('numi_user');
            if (!userData || userData.id !== user.id) {
               // Initialize new user
               userData = { ...user, xp: 0, streak: 1, completedLessons: [] };
               StorageHelper.save('numi_user', userData);
            }
            StorageHelper.save('numi_session', true); // Active session
            return { success: true, user: userData };
        }
        return { success: false, msg: "بيانات الدخول غير صحيحة. استخدم أكواد التجربة: 12345" };
    },
    logout: () => {
        StorageHelper.remove('numi_session');
    },
    isLoggedIn: () => !!StorageHelper.load('numi_session'),
    getCurrentUser: () => StorageHelper.load('numi_user'),
    updateUser: (data) => {
         let u = Auth.getCurrentUser();
         if (u) {
             u = { ...u, ...data };
             StorageHelper.save('numi_user', u);
         }
    },
    addXP: (amount) => {
         let u = Auth.getCurrentUser();
         if (u) {
             u.xp = (u.xp || 0) + amount;
             StorageHelper.save('numi_user', u);
         }
    }
};
