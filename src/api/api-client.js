/**
 * Numi API Client
 * Handles all network requests with centralized configuration and error handling.
 */

const API_CLIENT = {
    baseUrl: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5000/api'
        : 'https://numi-production-7484.up.railway.app/api',

    getHeaders() {
        const session = JSON.parse(localStorage.getItem('numi_session_user') || '{}');
        return {
            'Content-Type': 'application/json',
            'x-user-id': session.id || ''
        };
    },

    async request(endpoint, options = {}) {
        const url = new URL(`${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`);
        
        // Auto-inject tenantId and scope
        const session = JSON.parse(localStorage.getItem('numi_session_user') || '{}');
        const isSuperAdmin = session.role === 'super_admin' || session.phone === '01110154093';
        
        url.searchParams.set('tenantId', isSuperAdmin ? 'global' : (session.id || 'main'));
        if (isSuperAdmin) url.searchParams.set('scope', 'global');

        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url.toString(), config);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP Error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Request Failed [${endpoint}]:`, error);
            throw error;
        }
    },

    get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};

window.API_CLIENT = API_CLIENT;
export default API_CLIENT;
