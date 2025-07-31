// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 'error',
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user still exists and is active
        const user = await User.findById(decoded.userId);
        if (!user || user.status !== 'active') {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid token or user not active'
            });
        }

        // Add user info to request
        req.user = {
            userId: decoded.userId,
            user: user
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

        console.error('Auth middleware error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Authentication failed'
        });
    }
};

module.exports = authMiddleware;