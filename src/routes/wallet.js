// routes/wallet.js
const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const walletController = require('../controllers/walletController');

const router = express.Router();

router.get('/balance', walletController.getBalance);
router.post('/deposit', validate(schemas.walletDeposit), walletController.deposit);
router.post('/withdraw', validate(schemas.walletWithdrawal), walletController.withdraw);
router.get('/history', walletController.getHistory);
router.get('/analytics', walletController.getAnalytics);

module.exports = router;