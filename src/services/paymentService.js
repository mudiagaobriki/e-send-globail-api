// services/paymentService.js
const axios = require('axios');

class FlutterwaveService {
    constructor() {
        this.baseURL = process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com/v3';
        this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
        this.publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;

        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json'
            }
        });

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                console.error('Flutterwave API Error:', error.response?.data);
                throw new Error(error.response?.data?.message || 'Payment service error');
            }
        );
    }

    // Initialize payment for card transactions
    async initializePayment(paymentData) {
        try {
            const response = await this.client.post('/payments', paymentData);
            return response.data.data;
        } catch (error) {
            throw new Error(`Payment initialization failed: ${error.message}`);
        }
    }

    // Verify payment status
    async verifyPayment(transactionId) {
        try {
            const response = await this.client.get(`/transactions/${transactionId}/verify`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Payment verification failed: ${error.message}`);
        }
    }

    // Get list of banks for a country
    async getBanks(countryCode = 'NG') {
        try {
            const response = await this.client.get(`/banks/${countryCode}`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to fetch banks: ${error.message}`);
        }
    }

    // Verify bank account details
    async verifyBankAccount(accountNumber, bankCode) {
        try {
            const response = await this.client.post('/accounts/resolve', {
                account_number: accountNumber,
                account_bank: bankCode
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Account verification failed: ${error.message}`);
        }
    }

    // Create transfer recipient
    async createTransferRecipient(recipientData) {
        try {
            const response = await this.client.post('/beneficiaries', recipientData);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to create recipient: ${error.message}`);
        }
    }

    // Initiate bank transfer
    async transfer(transferData) {
        try {
            const response = await this.client.post('/transfers', transferData);
            return response.data.data;
        } catch (error) {
            throw new Error(`Transfer failed: ${error.message}`);
        }
    }

    // Initiate mobile money transfer
    async transferMobileMoney(transferData) {
        try {
            // Mobile money transfers use similar endpoint but with different account_bank format
            const response = await this.client.post('/transfers', {
                ...transferData,
                debit_currency: transferData.currency
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Mobile money transfer failed: ${error.message}`);
        }
    }

    // Create virtual account for bank transfers
    async createVirtualAccount(accountData) {
        try {
            const response = await this.client.post('/virtual-account-numbers', accountData);
            return response.data.data;
        } catch (error) {
            throw new Error(`Virtual account creation failed: ${error.message}`);
        }
    }

    // Get transfer status
    async getTransferStatus(transferId) {
        try {
            const response = await this.client.get(`/transfers/${transferId}`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get transfer status: ${error.message}`);
        }
    }

    // Get exchange rates
    async getExchangeRates(from, to, amount) {
        try {
            const response = await this.client.get('/fx-rates', {
                params: {
                    from,
                    to,
                    amount
                }
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get exchange rates: ${error.message}`);
        }
    }

    // Retry failed transfer
    async retryTransfer(transferId) {
        try {
            const response = await this.client.post(`/transfers/${transferId}/retry`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Transfer retry failed: ${error.message}`);
        }
    }

    // Get account balance
    async getBalance(currency = 'NGN') {
        try {
            const response = await this.client.get('/balances', {
                params: { currency }
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get balance: ${error.message}`);
        }
    }

    // Create refund
    async createRefund(transactionId) {
        try {
            const response = await this.client.post('/refunds', {
                id: transactionId
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Refund creation failed: ${error.message}`);
        }
    }

    // Validate webhook signature
    validateWebhookSignature(payload, signature) {
        const crypto = require('crypto');
        const hash = crypto
            .createHmac('sha256', process.env.FLUTTERWAVE_WEBHOOK_SECRET)
            .update(payload, 'utf8')
            .digest('hex');

        return hash === signature;
    }

    // Process webhook data
    processWebhook(webhookData) {
        const { event, data } = webhookData;

        return {
            event,
            transactionId: data.id,
            reference: data.tx_ref,
            status: data.status,
            amount: data.amount,
            currency: data.currency,
            customer: data.customer,
            timestamp: data.created_at,
            rawData: data
        };
    }

    // Get supported countries
    async getSupportedCountries() {
        try {
            const response = await this.client.get('/countries');
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get supported countries: ${error.message}`);
        }
    }

    // Get mobile money operators for a country
    async getMobileMoneyOperators(countryCode) {
        try {
            const response = await this.client.get(`/top-bill-categories/mobile_money_bills/billers`, {
                params: { country: countryCode }
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get mobile money operators: ${error.message}`);
        }
    }

    // Create bulk transfer
    async createBulkTransfer(transferData) {
        try {
            const response = await this.client.post('/bulk-transfers', transferData);
            return response.data.data;
        } catch (error) {
            throw new Error(`Bulk transfer failed: ${error.message}`);
        }
    }

    // Get transaction fees
    async getTransactionFees(amount, currency, type = 'debit') {
        try {
            const response = await this.client.get('/transactions/fee', {
                params: {
                    amount,
                    currency,
                    type
                }
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get transaction fees: ${error.message}`);
        }
    }
}

// Create and export singleton instance
const flutterwaveService = new FlutterwaveService();

module.exports = {
    flutterwaveService,
    FlutterwaveService
};