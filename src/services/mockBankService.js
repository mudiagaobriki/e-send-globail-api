// services/mockBankService.js
const { v4: uuidv4 } = require('uuid');

class MockBankService {
    constructor() {
        this.africanBanks = {
            NG: { // Nigeria
                name: 'Nigeria',
                currency: 'NGN',
                banks: [
                    { code: '044', name: 'Access Bank' },
                    { code: '014', name: 'Afribank' },
                    { code: '023', name: 'Citibank' },
                    { code: '050', name: 'Ecobank' },
                    { code: '070', name: 'Fidelity Bank' },
                    { code: '011', name: 'First Bank' },
                    { code: '214', name: 'First City Monument Bank' },
                    { code: '058', name: 'Guaranty Trust Bank' },
                    { code: '030', name: 'Heritage Bank' },
                    { code: '301', name: 'Jaiz Bank' },
                    { code: '082', name: 'Keystone Bank' },
                    { code: '526', name: 'Parallex Bank' },
                    { code: '076', name: 'Polaris Bank' },
                    { code: '221', name: 'Stanbic IBTC Bank' },
                    { code: '068', name: 'Standard Chartered Bank' },
                    { code: '232', name: 'Sterling Bank' },
                    { code: '100', name: 'Suntrust Bank' },
                    { code: '032', name: 'Union Bank' },
                    { code: '033', name: 'United Bank for Africa' },
                    { code: '215', name: 'Unity Bank' },
                    { code: '035', name: 'Wema Bank' },
                    { code: '057', name: 'Zenith Bank' }
                ]
            },
            GH: { // Ghana
                name: 'Ghana',
                currency: 'GHS',
                banks: [
                    { code: 'GH010101', name: 'Bank of Ghana' },
                    { code: 'GH020101', name: 'Ghana Commercial Bank' },
                    { code: 'GH030101', name: 'Ecobank Ghana' },
                    { code: 'GH040101', name: 'Standard Chartered Bank Ghana' },
                    { code: 'GH050101', name: 'Barclays Bank Ghana' },
                    { code: 'GH060101', name: 'United Bank for Africa Ghana' },
                    { code: 'GH070101', name: 'Zenith Bank Ghana' },
                    { code: 'GH080101', name: 'Stanbic Bank Ghana' },
                    { code: 'GH090101', name: 'Fidelity Bank Ghana' },
                    { code: 'GH100101', name: 'Access Bank Ghana' },
                    { code: 'GH110101', name: 'First National Bank Ghana' },
                    { code: 'GH120101', name: 'Guaranty Trust Bank Ghana' }
                ]
            },
            KE: { // Kenya
                name: 'Kenya',
                currency: 'KES',
                banks: [
                    { code: 'KE010101', name: 'Central Bank of Kenya' },
                    { code: 'KE020101', name: 'Kenya Commercial Bank' },
                    { code: 'KE030101', name: 'Equity Bank Kenya' },
                    { code: 'KE040101', name: 'Cooperative Bank of Kenya' },
                    { code: 'KE050101', name: 'Standard Chartered Bank Kenya' },
                    { code: 'KE060101', name: 'Barclays Bank Kenya' },
                    { code: 'KE070101', name: 'Diamond Trust Bank Kenya' },
                    { code: 'KE080101', name: 'I&M Bank Kenya' },
                    { code: 'KE090101', name: 'National Bank of Kenya' },
                    { code: 'KE100101', name: 'NIC Bank Kenya' },
                    { code: 'KE110101', name: 'Stanbic Bank Kenya' }
                ]
            },
            UG: { // Uganda
                name: 'Uganda',
                currency: 'UGX',
                banks: [
                    { code: 'UG010101', name: 'Bank of Uganda' },
                    { code: 'UG020101', name: 'Stanbic Bank Uganda' },
                    { code: 'UG030101', name: 'Standard Chartered Bank Uganda' },
                    { code: 'UG040101', name: 'Barclays Bank Uganda' },
                    { code: 'UG050101', name: 'Centenary Bank' },
                    { code: 'UG060101', name: 'DFCU Bank' },
                    { code: 'UG070101', name: 'Equity Bank Uganda' },
                    { code: 'UG080101', name: 'Housing Finance Bank' },
                    { code: 'UG090101', name: 'KCB Bank Uganda' },
                    { code: 'UG100101', name: 'Orient Bank Uganda' }
                ]
            },
            TZ: { // Tanzania
                name: 'Tanzania',
                currency: 'TZS',
                banks: [
                    { code: 'TZ010101', name: 'Bank of Tanzania' },
                    { code: 'TZ020101', name: 'CRDB Bank' },
                    { code: 'TZ030101', name: 'National Microfinance Bank' },
                    { code: 'TZ040101', name: 'Standard Chartered Bank Tanzania' },
                    { code: 'TZ050101', name: 'Stanbic Bank Tanzania' },
                    { code: 'TZ060101', name: 'Equity Bank Tanzania' },
                    { code: 'TZ070101', name: 'Exim Bank Tanzania' },
                    { code: 'TZ080101', name: 'KCB Bank Tanzania' },
                    { code: 'TZ090101', name: 'NBC Bank Tanzania' }
                ]
            },
            ZA: { // South Africa
                name: 'South Africa',
                currency: 'ZAR',
                banks: [
                    { code: 'ZA010101', name: 'South African Reserve Bank' },
                    { code: 'ZA020101', name: 'Standard Bank South Africa' },
                    { code: 'ZA030101', name: 'First National Bank' },
                    { code: 'ZA040101', name: 'ABSA Bank' },
                    { code: 'ZA050101', name: 'Nedbank' },
                    { code: 'ZA060101', name: 'Capitec Bank' },
                    { code: 'ZA070101', name: 'Investec Bank' },
                    { code: 'ZA080101', name: 'African Bank' },
                    { code: 'ZA090101', name: 'Discovery Bank' }
                ]
            },
            RW: { // Rwanda
                name: 'Rwanda',
                currency: 'RWF',
                banks: [
                    { code: 'RW010101', name: 'National Bank of Rwanda' },
                    { code: 'RW020101', name: 'Bank of Kigali' },
                    { code: 'RW030101', name: 'Equity Bank Rwanda' },
                    { code: 'RW040101', name: 'KCB Bank Rwanda' },
                    { code: 'RW050101', name: 'Cogebanque' },
                    { code: 'RW060101', name: 'Ecobank Rwanda' },
                    { code: 'RW070101', name: 'Access Bank Rwanda' }
                ]
            },
            ET: { // Ethiopia
                name: 'Ethiopia',
                currency: 'ETB',
                banks: [
                    { code: 'ET010101', name: 'National Bank of Ethiopia' },
                    { code: 'ET020101', name: 'Commercial Bank of Ethiopia' },
                    { code: 'ET030101', name: 'Dashen Bank' },
                    { code: 'ET040101', name: 'Bank of Abyssinia' },
                    { code: 'ET050101', name: 'Awash Bank' },
                    { code: 'ET060101', name: 'United Bank' },
                    { code: 'ET070101', name: 'Nib International Bank' }
                ]
            }
        };
    }

    // Get banks for a specific country
    getBanks(countryCode) {
        const country = this.africanBanks[countryCode.toUpperCase()];
        if (!country) {
            throw new Error(`Country ${countryCode} not supported`);
        }
        return country.banks;
    }

    // Get all supported countries
    getSupportedCountries() {
        return Object.keys(this.africanBanks).map(code => ({
            code,
            name: this.africanBanks[code].name,
            currency: this.africanBanks[code].currency
        }));
    }

    // Verify bank account (mock implementation)
    async verifyBankAccount(accountNumber, bankCode, countryCode = 'NG') {
        // Simulate API delay
        await this.delay(1000);

        const country = this.africanBanks[countryCode.toUpperCase()];
        if (!country) {
            throw new Error('Country not supported');
        }

        const bank = country.banks.find(b => b.code === bankCode);
        if (!bank) {
            throw new Error('Bank not found');
        }

        // Generate mock account name based on account number
        const accountNames = [
            'JOHN ADEBAYO SMITH',
            'MARY CHIOMA JOHNSON',
            'DAVID KWAME ASANTE',
            'GRACE AISHA MOHAMMED',
            'PETER CHUKWU OKAFOR',
            'SARAH AMINA HASSAN',
            'MICHAEL KOJO MENSAH',
            'BLESSING FATIMA YAKUBU'
        ];

        const randomName = accountNames[parseInt(accountNumber.slice(-1)) % accountNames.length];

        return {
            account_number: accountNumber,
            account_name: randomName,
            bank_name: bank.name,
            bank_code: bankCode
        };
    }

    // Simulate bank transfer
    async simulateTransfer(transferData) {
        const {
            account_bank,
            account_number,
            amount,
            currency,
            beneficiary_name,
            reference,
            narration,
            country_code = 'NG'
        } = transferData;

        // Simulate processing delay
        await this.delay(2000);

        // Generate mock response
        const mockTransferId = uuidv4();
        const transferId = parseInt(Math.random() * 1000000);

        // 95% success rate simulation
        const isSuccessful = Math.random() > 0.05;

        if (!isSuccessful) {
            throw new Error('Transfer failed: Insufficient funds or invalid account details');
        }

        return {
            id: transferId,
            reference,
            account_number: account_number,
            bank_code: account_bank,
            full_name: beneficiary_name,
            currency,
            amount,
            fee: this.calculateTransferFee(amount),
            status: 'SUCCESSFUL',
            complete_message: 'Transfer completed successfully',
            created_at: new Date().toISOString(),
            bank_name: this.getBankName(account_bank, country_code),
            meta: {
                provider: 'Esend Mock Service',
                processed_at: new Date().toISOString(),
                narration
            }
        };
    }

    // Calculate transfer fee
    calculateTransferFee(amount) {
        if (amount <= 1000) return 10;
        if (amount <= 10000) return 25;
        return Math.min(amount * 0.015, 500); // 1.5% max 500
    }

    // Get bank name by code
    getBankName(bankCode, countryCode = 'NG') {
        const country = this.africanBanks[countryCode.toUpperCase()];
        if (!country) return 'Unknown Bank';

        const bank = country.banks.find(b => b.code === bankCode);
        return bank ? bank.name : 'Unknown Bank';
    }

    // Simulate mobile money transfer
    async simulateMobileMoneyTransfer(transferData) {
        const {
            account_bank: provider,
            account_number: phoneNumber,
            amount,
            currency,
            beneficiary_name,
            reference,
            narration
        } = transferData;

        // Simulate processing delay
        await this.delay(1500);

        const mockTransferId = uuidv4();
        const transferId = parseInt(Math.random() * 1000000);

        // 90% success rate for mobile money
        const isSuccessful = Math.random() > 0.1;

        if (!isSuccessful) {
            throw new Error('Mobile money transfer failed: Invalid phone number or network error');
        }

        return {
            id: transferId,
            reference,
            phone_number: phoneNumber,
            provider,
            recipient_name: beneficiary_name,
            currency,
            amount,
            fee: this.calculateMobileMoneyFee(amount),
            status: 'SUCCESSFUL',
            complete_message: 'Mobile money transfer completed successfully',
            created_at: new Date().toISOString(),
            meta: {
                provider: 'Esend Mock Mobile Money Service',
                processed_at: new Date().toISOString(),
                narration
            }
        };
    }

    // Calculate mobile money fee
    calculateMobileMoneyFee(amount) {
        return Math.min(amount * 0.02, 300); // 2% max 300
    }

    // Get transfer status (mock)
    async getTransferStatus(transferId) {
        await this.delay(500);

        return {
            id: transferId,
            status: 'SUCCESSFUL',
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
        };
    }

    // Retry transfer (mock)
    async retryTransfer(transferId) {
        await this.delay(1000);

        return {
            id: transferId,
            status: 'PENDING',
            message: 'Transfer retry initiated'
        };
    }

    // Helper method to simulate delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get supported mobile money providers by country
    getMobileMoneyProviders(countryCode) {
        const providers = {
            NG: ['MTN', 'Airtel', 'Glo', '9mobile'],
            GH: ['MTN Ghana', 'Vodafone Cash', 'AirtelTigo Money'],
            KE: ['M-Pesa', 'Airtel Money', 'T-Kash'],
            UG: ['MTN Mobile Money', 'Airtel Money Uganda'],
            TZ: ['M-Pesa Tanzania', 'Airtel Money Tanzania', 'Tigo Pesa'],
            ZA: ['MTN Mobile Money', 'Vodacom M-Pesa'],
            RW: ['MTN Mobile Money Rwanda', 'Airtel Money Rwanda']
        };

        return providers[countryCode.toUpperCase()] || [];
    }

    // Validate account number format
    validateAccountNumber(accountNumber, countryCode) {
        const patterns = {
            NG: /^\d{10}$/, // 10 digits for Nigeria
            GH: /^\d{13}$/, // 13 digits for Ghana
            KE: /^\d{12}$/, // 12 digits for Kenya
            UG: /^\d{12}$/, // 12 digits for Uganda
            TZ: /^\d{13}$/, // 13 digits for Tanzania
            ZA: /^\d{9,11}$/, // 9-11 digits for South Africa
            RW: /^\d{16}$/ // 16 digits for Rwanda
        };

        const pattern = patterns[countryCode.toUpperCase()];
        return pattern ? pattern.test(accountNumber) : true;
    }

    // Get country info
    getCountryInfo(countryCode) {
        const country = this.africanBanks[countryCode.toUpperCase()];
        if (!country) {
            throw new Error(`Country ${countryCode} not supported`);
        }
        return {
            code: countryCode.toUpperCase(),
            name: country.name,
            currency: country.currency,
            banksCount: country.banks.length
        };
    }
}

module.exports = new MockBankService();