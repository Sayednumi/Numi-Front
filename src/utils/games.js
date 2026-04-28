const Games = {
    startQuiz: () => {
        const qz = document.getElementById('quiz-container');
        qz.innerHTML = `
            <div style="text-align: right; background: var(--bg-main); padding: 20px; border-radius: var(--radius-md);">
                <h3 style="margin-bottom: 15px; color: var(--text-main);">السؤال الأول: ما هي مشتقة الدالة f(x) = x² ؟</h3>
                <button class="btn" style="width:100%; margin:8px 0; justify-content: flex-start;" onclick="Games.answerQuiz(false)">أ) x³</button>
                <button class="btn" style="width:100%; margin:8px 0; justify-content: flex-start;" onclick="Games.answerQuiz(true)">ب) 2x</button>
                <button class="btn" style="width:100%; margin:8px 0; justify-content: flex-start;" onclick="Games.answerQuiz(false)">ج) x</button>
            </div>
        `;
    },
    answerQuiz: (isCorrect) => {
        const qz = document.getElementById('quiz-container');
        if (isCorrect) {
            qz.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.1); padding: 20px; border-radius: var(--radius-md); border: 1px solid #22c55e;">
                    <h3 style="color:#22c55e; margin-bottom: 10px;"><i class="fas fa-check-circle"></i> إجابة صحيحة ممتاز!</h3>
                    <p style="color: var(--text-muted);">حصلت على +20 XP !</p>
                </div>`;
            Auth.addXP(20);
            UI.updateProfile();
        } else {
            qz.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); padding: 20px; border-radius: var(--radius-md); border: 1px solid #ef4444;">
                    <h3 style="color:#ef4444; margin-bottom: 10px;"><i class="fas fa-times-circle"></i> إجابة خاطئة</h3>
                    <p style="color: var(--text-muted);">الرجاء مراجعة الشرح والمحاولة مجدداً.</p>
                    <button class="btn btn-primary" style="margin-top: 15px;" onclick="Games.startQuiz()">حاول مجدداً</button>
                </div>`;
        }
    }
};
