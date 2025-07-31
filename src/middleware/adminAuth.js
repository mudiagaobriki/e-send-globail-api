// middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuthMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 'error',
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.substring(7);

        // Check for admin secret key in headers for super admin access
        const adminSecret = req.header('X-Admin-Secret');
        if (adminSecret === process.env.ADMIN_SECRET_KEY) {
            req.user = { isAdmin: true, isSuperAdmin: true };
            return next();
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user exists and has admin privileges
        const user = await User.findById(decoded.userId);
        if (!user || user.status !== 'active') {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid token or user not active'
            });
        }

        // Check if user is admin (you might have an isAdmin field or role field)
        if (!user.isAdmin && user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Admin privileges required.'
            });
        }

        req.user = {
            userId: decoded.userId,
            user: user,
            isAdmin: true
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                message: 'Token expired'
            });
        }

        console.error('Admin auth middleware error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Authentication failed'
        });
    }
};

module.exports = adminAuthMiddleware;