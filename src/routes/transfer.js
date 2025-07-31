// routes/transfer.js
const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const transferController = require('../controllers/transferController');

const router = express.Router();

router.get('/banks/:countryCode', transferController.getBanks);
router.post('/verify-account', transferController.verifyAccount);
router.post('/bank', validate(schemas.bankTransfer), transferController.bankTransfer);
router.post('/esend', validate(schemas.westcashTransfer), transferController.westcashTransfer);
router.post('/mobile-money', validate(schemas.mobileMoneyTransfer), transferController.mobileMoneyTransfer);
router.get('/quote', transferController.getQuote);
router.get('/recipients', transferController.getRecipients);

module.exports = router;