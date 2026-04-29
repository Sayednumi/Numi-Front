/**
 * Schedule Service
 * Handles fetching and rendering of schedule widgets.
 */
import API_CLIENT from '../api/api-client.js';
import GLOBAL_STORE from './Store.js';

const ScheduleService = {
    async loadSchedule() {
        if (GLOBAL_STORE.state.loading.schedule) return;
        
        GLOBAL_STORE.setLoading('schedule', true);
        try {
            const session = GLOBAL_STORE.state.currentUser;
            const teacherId = session.id || session._id || 'admin_main';
            
            const data = await API_CLIENT.get(`/live-classes?teacherId=${teacherId}`);
            if (data.success) {
                GLOBAL_STORE.setState({ liveClasses: data.liveClasses || [] });
            }
        } catch (error) {
            console.error('Failed to load schedule:', error);
            // We could set an error state here if needed
        } finally {
            GLOBAL_STORE.setLoading('schedule', false);
        }
    },

    // Rendering logic (to be called by UI components)
    getTodayClasses() {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        return (GLOBAL_STORE.state.liveClasses || [])
            .filter(c => c && c.date === todayStr)
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }
};

window.ScheduleService = ScheduleService;
export default ScheduleService;
