// services/exchangeRateService.js
const axios = require('axios');

class ExchangeRateService {
    constructor() {
        this.apiKey = process.env.EXCHANGE_RATE_API_KEY;
        this.baseURL = process.env.EXCHANGE_RATE_BASE_URL || 'https://v6.exchangerate-api.com/v6';

        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000
        });

        // Cache for exchange rates (5 minutes)
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    async getRate(fromCurrency, toCurrency) {
        try {
            const cacheKey = `${fromCurrency}_${toCurrency}`;
            const cached = this.cache.get(cacheKey);

            // Return cached rate if valid
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                return cached.data;
            }

            // Fetch new rate
            const response = await this.client.get(`/${this.apiKey}/pair/${fromCurrency}/${toCurrency}`);

            if (response.data.result !== 'success') {
                throw new Error('Exchange rate API returned error');
            }

            const rateData = {
                fromCurrency,
                toCurrency,
                rate: response.data.conversion_rate,
                lastUpdated: response.data.time_last_update_utc,
                provider: 'exchangerate-api'
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: rateData,
                timestamp: Date.now()
            });

            return rateData;

        } catch (error) {
            console.error('Exchange rate fetch error:', error.message);

            // Return cached rate if available (even if expired) as fallback
            const cacheKey = `${fromCurrency}_${toCurrency}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                console.log('Using cached exchange rate as fallback');
                return cached.data;
            }

            throw new Error(`Failed to get exchange rate: ${error.message}`);
        }
    }

    async getMultipleRates(baseCurrency, targetCurrencies) {
        try {
            const response = await this.client.get(`/${this.apiKey}/latest/${baseCurrency}`);

            if (response.data.result !== 'success') {
                throw new Error('Exchange rate API returned error');
            }

            const rates = {};
            targetCurrencies.forEach(currency => {
                if (response.data.conversion_rates[currency]) {
                    rates[currency] = {
                        rate: response.data.conversion_rates[currency],
                        fromCurrency: baseCurrency,
                        toCurrency: currency,
                        lastUpdated: response.data.time_last_update_utc,
                        provider: 'exchangerate-api'
                    };
                }
            });

            return rates;

        } catch (error) {
            console.error('Multiple exchange rates fetch error:', error.message);
            throw new Error(`Failed to get exchange rates: ${error.message}`);
        }
    }

    getSupportedCurrencies() {
        return [
            'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'ZAR', 'XOF', 'XAF',
            'USD', 'EUR', 'GBP', 'CAD', 'AUD'
        ];
    }

    async getHistoricalRate(fromCurrency, toCurrency, date) {
        try {
            // Format date as YYYY-MM-DD
            const formattedDate = date.toISOString().split('T')[0];

            const response = await this.client.get(`/${this.apiKey}/history/${fromCurrency}/${formattedDate}`);

            if (response.data.result !== 'success') {
                throw new Error('Historical exchange rate API returned error');
            }

            return {
                fromCurrency,
                toCurrency,
                rate: response.data.conversion_rates[toCurrency],
                date: formattedDate,
                provider: 'exchangerate-api'
            };

        } catch (error) {
            console.error('Historical exchange rate fetch error:', error.message);
            throw new Error(`Failed to get historical exchange rate: ${error.message}`);
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

const exchangeRateService = new ExchangeRateService();

module.exports = {
    exchangeRateService,
    ExchangeRateService
};