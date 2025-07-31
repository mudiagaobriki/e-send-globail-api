
// routes/auth.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { validate, schemas } = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again later.'
});


router.post('/register', authLimiter, validate(schemas.register), authController.register);
router.post('/login', authLimiter, validate(schemas.login), authController.login);
router.post('/verify-phone', authMiddleware, validate(schemas.verifyOTP), authController.verifyPhone);
router.post('/resend-otp', authMiddleware, authController.resendOTP);
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword), authController.resetPassword);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;