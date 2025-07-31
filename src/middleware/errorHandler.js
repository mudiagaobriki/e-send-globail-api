// middleware/errorHandler.js
const Sentry = require('@sentry/node');

const errorHandler = (err, req, res, next) => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', err);
    }

    // Send error to Sentry
    Sentry.captureException(err);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid ID format'
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({
            status: 'error',
            message: `${field} already exists`
        });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({
            status: 'error',
            message: errors.join(', ')
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            status: 'error',
            message: 'Token expired'
        });
    }

    // Default error
    res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message || 'Internal server error'
    });
};

module.exports = errorHandler;