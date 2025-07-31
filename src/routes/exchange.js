// routes/exchange.js
const express = require('express');
const exchangeController = require('../controllers/exchangeController');
const router = express.Router();

// Routes should NOT require authentication for basic rate checking
router.get('/rates', exchangeController.getRates);
router.get('/rates/:from/:to', exchangeController.getSpecificRate);
router.get('/supported-currencies', exchangeController.getSupportedCurrencies);

module.exports = router;