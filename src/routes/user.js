// routes/user.js
const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/profile', userController.getProfile);
router.put('/profile', validate(schemas.updateProfile), userController.updateProfile);
router.post('/upload-kyc', userController.uploadKycDocuments);
router.get('/referrals', userController.getReferrals);

module.exports = router;