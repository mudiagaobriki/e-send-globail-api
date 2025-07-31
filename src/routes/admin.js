// routes/admin.js
const express = require('express');
const Joi = require('joi');
const { validate } = require('../middleware/validation');
const adminAuthMiddleware = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

const router = express.Router();

const updateUserStatusSchema = Joi.object({
    status: Joi.string().valid('active', 'suspended', 'blocked').required(),
    reason: Joi.string().max(200).optional()
});

const updateKycStatusSchema = Joi.object({
    kycStatus: Joi.string().valid('pending', 'submitted', 'verified', 'rejected').required(),
    kycLevel: Joi.number().integer().min(0).max(3).optional(),
    reason: Joi.string().max(200).optional()
});

router.use(adminAuthMiddleware);
router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.put('/users/:id/status', validate(updateUserStatusSchema), adminController.updateUserStatus);
router.put('/users/:id/kyc', validate(updateKycStatusSchema), adminController.updateKycStatus);
router.get('/transactions', adminController.getTransactions);
router.get('/transactions/:id', adminController.getTransactionDetails);
router.post('/transactions/:id/retry', adminController.retryTransaction);
router.get('/analytics', adminController.getAnalytics);

module.exports = router;