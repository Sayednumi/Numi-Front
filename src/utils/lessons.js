let LessonsData = [];
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : 'https://numi-production-7484.up.railway.app/api';

const LessonsManager = {
    init: async () => {
        try {
            const res = await fetch(`${API_URL}/platform-data`);
            if (!res.ok) throw new Error("Failed to connect");
            const db = await res.json();
            LessonsData = [];
            // Flatten db structure: classes -> groups -> courses -> term -> units -> lessons
            if (db && db.classes) {
                for (const classId in db.classes) {
                    const classObj = db.classes[classId];
                    const groups = classObj.groups || {};
                    for (const groupId in groups) {
                        const courses = groups[groupId].courses || {};
                        for (const courseId in courses) {
                            for (const term of ['term1', 'term2']) {
                                const units = courses[courseId][term]?.units || {};
                                for (const unitId in units) {
                                    const unitObj = units[unitId];
                                    const lessons = unitObj.lessons || {};
                                    for (const lessonId in lessons) {
                                        const lessonObj = lessons[lessonId];
                                        // Merge database object with frontend expected fields
                                        LessonsData.push({
                                            ...lessonObj,
                                            id: lessonObj.id || lessonId,
                                            term: term,
                                            unit: unitObj.title || unitId,
                                            level: classObj.name || classId,
                                            // Handle cases where videoUrl might be stored instead of videoId directly in backend
                                            videoId: lessonObj.videoId || (lessonObj.videoUrl ? extractYouTubeID(lessonObj.videoUrl) : 'dQw4w9WgXcQ'),
                                            duration: lessonObj.duration || "25 دقيقة",
                                            xpReward: lessonObj.xpReward || 50
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    },
    getAll: () => LessonsData,
    getLesson: (id) => LessonsData.find(l => l.id === id),
    getLessonsByTerm: (term) => LessonsData.filter(l => l.term === term),
    completeLesson: (id) => {
        let u = Auth.getCurrentUser();
        if (u && !u.completedLessons.includes(id)) {
            u.completedLessons.push(id);
            Auth.updateUser(u);
            Auth.addXP(LessonsManager.getLesson(id)?.xpReward || 50);
            return true;
        }
        return false;
    }
};

function extractYouTubeID(url) {
    if (!url) return '';
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return (match && match[1]) ? match[1] : url;
}
