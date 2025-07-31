// routes/transaction.js
const express = require('express');
const transactionController = require('../controllers/transactionController');

const router = express.Router();

router.get('/history', transactionController.getHistory);
router.get('/:id', transactionController.getTransactionById);
router.get('/:id/status', transactionController.getTransactionStatus);
router.post('/webhook', transactionController.handleWebhook);

module.exports = router;