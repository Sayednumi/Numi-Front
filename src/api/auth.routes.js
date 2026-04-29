/**
 * ============================================================
 *  Numi Platform — Auth Routes (Mocked Express)
 *  File: src/api/auth.routes.js
 * ============================================================
 */
const AuthService = require('../services/AuthService');

// POST /api/v1/auth/login
function loginHandler(req, res) {
    try {
        const { email, password } = req.body;
        const result = AuthService.login(email, password);
        res.status(200).json(result);
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
}

module.exports = { loginHandler };
