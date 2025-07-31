// controllers/exchangeController.js
const { exchangeRateService } = require('../services/exchangeRateService');

class ExchangeController {
    // @desc    Get current exchange rates
    async getRates(req, res) {
        try {
            const { base = 'NGN', currencies } = req.query;

            let targetCurrencies;
            if (currencies) {
                targetCurrencies = currencies.split(',');
            } else {
                targetCurrencies = exchangeRateService.getSupportedCurrencies()
                    .filter(curr => curr !== base);
            }

            const rates = await exchangeRateService.getMultipleRates(base, targetCurrencies);

            res.json({
                status: 'success',
                data: {
                    baseCurrency: base,
                    rates,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Get exchange rates error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch exchange rates'
            });
        }
    }

    // @desc    Get specific exchange rate
    async getSpecificRate(req, res) {
        try {
            const { from, to } = req.params;
            const { amount } = req.query;

            const rateData = await exchangeRateService.getRate(from, to);

            let result = {
                fromCurrency: from,
                toCurrency: to,
                rate: rateData.rate,
                lastUpdated: rateData.lastUpdated,
                provider: rateData.provider
            };

            if (amount) {
                const numAmount = parseFloat(amount);
                if (!isNaN(numAmount) && numAmount > 0) {
                    result.convertedAmount = numAmount * rateData.rate;
                    result.originalAmount = numAmount;
                }
            }

            res.json({
                status: 'success',
                data: result
            });

        } catch (error) {
            console.error('Get specific exchange rate error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch exchange rate'
            });
        }
    }

    // @desc    Get supported currencies
    async getSupportedCurrencies(req, res) {
        try {
            const currencies = exchangeRateService.getSupportedCurrencies();

            // Currency metadata
            const currencyInfo = {
                'NGN': { name: 'Nigerian Naira', symbol: '₦', country: 'Nigeria' },
                'GHS': { name: 'Ghanaian Cedi', symbol: '₵', country: 'Ghana' },
                'KES': { name: 'Kenyan Shilling', symbol: 'KSh', country: 'Kenya' },
                'UGX': { name: 'Ugandan Shilling', symbol: 'USh', country: 'Uganda' },
                'TZS': { name: 'Tanzanian Shilling', symbol: 'TSh', country: 'Tanzania' },
                'ZAR': { name: 'South African Rand', symbol: 'R', country: 'South Africa' },
                'XOF': { name: 'West African CFA Franc', symbol: 'CFA', country: 'West Africa' },
                'XAF': { name: 'Central African CFA Franc', symbol: 'FCFA', country: 'Central Africa' },
                'USD': { name: 'US Dollar', symbol: '$', country: 'United States' },
                'EUR': { name: 'Euro', symbol: '€', country: 'European Union' },
                'GBP': { name: 'British Pound', symbol: '£', country: 'United Kingdom' },
                'CAD': { name: 'Canadian Dollar', symbol: 'C$', country: 'Canada' },
                'AUD': { name: 'Australian Dollar', symbol: 'A$', country: 'Australia' }
            };

            const supportedCurrencies = currencies.map(code => ({
                code,
                ...currencyInfo[code]
            }));

            res.json({
                status: 'success',
                data: {
                    currencies: supportedCurrencies,
                    total: currencies.length
                }
            });

        } catch (error) {
            console.error('Get supported currencies error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch supported currencies'
            });
        }
    }
}

module.exports = new ExchangeController();