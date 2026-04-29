/**
 * Numi Admin State Store
 * Reactive-like state management for the admin dashboard.
 */

class Store {
    constructor() {
        this.state = {
            db: { classes: {} },
            currentUser: null,
            liveClasses: [],
            students: [],
            teachers: [],
            organizations: [],
            loading: {},
            activeSection: 'dashboard'
        };
        this.listeners = [];
        this.init();
    }

    init() {
        const session = localStorage.getItem('numi_session_user');
        if (session) {
            this.state.currentUser = JSON.parse(session);
        }
        const cachedDb = localStorage.getItem('numi_db_cache');
        if (cachedDb) {
            this.state.db = JSON.parse(cachedDb);
        }
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    updateDb(path, value) {
        // Simple path-based update helper (e.g., "classes.classId.name")
        const parts = path.split('.');
        let current = this.state.db;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        this.notify();
        this.persistCache();
    }

    persistCache() {
        localStorage.setItem('numi_db_cache', JSON.stringify(this.state.db));
    }

    setLoading(key, isLoading) {
        this.state.loading[key] = isLoading;
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }
}

const GLOBAL_STORE = new Store();
window.GLOBAL_STORE = GLOBAL_STORE;
export default GLOBAL_STORE;
