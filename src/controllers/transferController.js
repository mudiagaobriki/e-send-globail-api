// controllers/transferController.js
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { flutterwaveService } = require('../services/paymentService');
const { exchangeRateService } = require('../services/exchangeRateService');
const { sendEmail } = require('../services/emailService');
const { sendSMS } = require('../services/smsService');

class TransferController {
    // @desc    Get list of banks for a country
    async getBanks(req, res) {
        try {
            const { countryCode } = req.params;

            const banks = await flutterwaveService.getBanks(countryCode);

            res.json({
                status: 'success',
                data: {
                    banks
                }
            });

        } catch (error) {
            console.error('Get banks error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch banks'
            });
        }
    }

    // @desc    Verify bank account details
    async verifyAccount(req, res) {
        try {
            const { accountNumber, bankCode } = req.body;

            if (!accountNumber || !bankCode) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Account number and bank code are required'
                });
            }

            const accountDetails = await flutterwaveService.verifyBankAccount(accountNumber, bankCode);

            res.json({
                status: 'success',
                data: {
                    accountDetails
                }
            });

        } catch (error) {
            console.error('Account verification error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to verify account details'
            });
        }
    }

    // @desc    Send money to bank account
    async bankTransfer(req, res) {
        try {
            const userId = req.user.userId;
            const {
                recipientName,
                recipientEmail,
                recipientPhone,
                recipientCountry,
                bankCode,
                accountNumber,
                amount,
                currency,
                description,
                purpose
            } = req.body;

            // Get sender details
            const sender = await User.findById(userId);
            if (!sender) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            // Check if user is verified
            if (!sender.isPhoneVerified) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Please verify your phone number first'
                });
            }

            // Check transaction limits
            if (amount > sender.limits.singleTransaction) {
                return res.status(400).json({
                    status: 'error',
                    message: `Transaction amount exceeds your single transaction limit of ${sender.limits.singleTransaction}`
                });
            }

            // Check wallet balance
            const totalAmount = amount; // Will calculate fees later
            if (sender.walletBalance < totalAmount) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Insufficient wallet balance'
                });
            }

            // Get exchange rate if needed
            let exchangeRate = null;
            let convertedAmount = amount;

            if (currency !== sender.currency) {
                const rateData = await exchangeRateService.getRate(sender.currency, currency);
                exchangeRate = {
                    fromCurrency: sender.currency,
                    toCurrency: currency,
                    rate: rateData.rate,
                    provider: 'exchangerate-api',
                    timestamp: new Date()
                };
                convertedAmount = amount * rateData.rate;
            }

            // Create transaction record
            const transaction = new Transaction({
                type: 'bank_transfer',
                sender: {
                    userId: sender._id,
                    name: sender.fullName,
                    email: sender.email,
                    phoneNumber: sender.phoneNumber,
                    country: sender.address.country
                },
                recipient: {
                    name: recipientName,
                    email: recipientEmail,
                    phoneNumber: recipientPhone,
                    country: recipientCountry,
                    bankDetails: {
                        accountNumber,
                        bankCode,
                        accountName: recipientName
                    }
                },
                amount,
                currency,
                exchangeRate,
                senderAmount: {
                    amount: currency === sender.currency ? amount : convertedAmount,
                    currency: sender.currency
                },
                recipientAmount: {
                    amount,
                    currency
                },
                description,
                purpose,
                paymentMethod: {
                    type: 'wallet'
                },
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });

            // Calculate fees
            transaction.calculateFees();

            // Check final amount with fees
            if (sender.walletBalance < transaction.totalAmount) {
                return res.status(400).json({
                    status: 'error',
                    message: `Insufficient balance. Required: ${transaction.totalAmount} (including fees: ${transaction.fees.totalFees})`
                });
            }

            // Save transaction
            await transaction.save();

            // Deduct from sender's wallet
            sender.walletBalance -= transaction.totalAmount;
            await sender.save();

            // Process transfer with Flutterwave
            try {
                const transferData = {
                    account_bank: bankCode,
                    account_number: accountNumber,
                    amount: convertedAmount,
                    currency,
                    beneficiary_name: recipientName,
                    reference: transaction.reference,
                    narration: description || `Transfer from ${sender.fullName}`
                };

                const flwResponse = await flutterwaveService.transfer(transferData);

                // Update transaction with provider details
                transaction.provider = {
                    name: 'flutterwave',
                    transactionId: flwResponse.id,
                    reference: flwResponse.reference,
                    response: flwResponse
                };

                await transaction.addTimeline('processing', 'Transfer initiated with Flutterwave');

                // Send notifications
                if (recipientEmail) {
                    await sendEmail({
                        to: recipientEmail,
                        subject: 'Money Transfer Notification',
                        template: 'transfer_notification',
                        data: {
                            recipientName,
                            senderName: sender.fullName,
                            amount,
                            currency,
                            transactionId: transaction.transactionId
                        }
                    });
                }

                if (recipientPhone) {
                    await sendSMS({
                        to: recipientPhone,
                        message: `You have received ${amount} ${currency} from ${sender.fullName}. Transaction ID: ${transaction.transactionId}`
                    });
                }

                res.status(201).json({
                    status: 'success',
                    message: 'Transfer initiated successfully',
                    data: {
                        transaction: {
                            id: transaction.transactionId,
                            reference: transaction.reference,
                            amount: transaction.amount,
                            currency: transaction.currency,
                            fees: transaction.fees,
                            totalAmount: transaction.totalAmount,
                            status: transaction.status,
                            recipient: transaction.recipient,
                            createdAt: transaction.createdAt
                        }
                    }
                });

            } catch (providerError) {
                // Refund wallet if provider fails
                sender.walletBalance += transaction.totalAmount;
                await sender.save();

                await transaction.addTimeline('failed', 'Transfer failed at provider level', {
                    error: providerError.message
                });

                throw providerError;
            }

        } catch (error) {
            console.error('Bank transfer error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Transfer failed. Please try again.'
            });
        }
    }

    // @desc    Transfer money between WestCash users
    async westcashTransfer(req, res) {
        try {
            const senderId = req.user.userId;
            const {
                recipientIdentifier,
                amount,
                currency,
                description,
                purpose
            } = req.body;

            // Get sender
            const sender = await User.findById(senderId);
            if (!sender) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Sender not found'
                });
            }

            // Find recipient by email, phone, or username
            const recipient = await User.findOne({
                $or: [
                    { email: recipientIdentifier },
                    { phoneNumber: recipientIdentifier },
                    { referralCode: recipientIdentifier }
                ]
            });

            if (!recipient) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Recipient not found'
                });
            }

            if (sender._id.equals(recipient._id)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot transfer to yourself'
                });
            }

            // Check wallet balance
            if (sender.walletBalance < amount) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Insufficient wallet balance'
                });
            }

            // Create transaction
            const transaction = new Transaction({
                type: 'westcash_transfer',
                sender: {
                    userId: sender._id,
                    name: sender.fullName,
                    email: sender.email,
                    phoneNumber: sender.phoneNumber,
                    country: sender.address.country
                },
                recipient: {
                    userId: recipient._id,
                    name: recipient.fullName,
                    email: recipient.email,
                    phoneNumber: recipient.phoneNumber,
                    country: recipient.address.country
                },
                amount,
                currency,
                description,
                purpose,
                paymentMethod: {
                    type: 'wallet'
                },
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });

            // Calculate fees (usually lower for internal transfers)
            transaction.fees = {
                transactionFee: amount <= 10000 ? 0 : amount * 0.005, // 0.5% for amounts > 10k
                exchangeFee: 0,
                processingFee: 0,
                totalFees: amount <= 10000 ? 0 : amount * 0.005
            };
            transaction.totalAmount = amount + transaction.fees.totalFees;

            // Final balance check
            if (sender.walletBalance < transaction.totalAmount) {
                return res.status(400).json({
                    status: 'error',
                    message: `Insufficient balance. Required: ${transaction.totalAmount} (including fees: ${transaction.fees.totalFees})`
                });
            }

            // Process transfer
            sender.walletBalance -= transaction.totalAmount;
            recipient.walletBalance += amount;

            await transaction.save();
            await sender.save();
            await recipient.save();

            await transaction.addTimeline('completed', 'WestCash transfer completed successfully');

            // Send notifications
            await sendEmail({
                to: recipient.email,
                subject: 'Money Received - WestCash Global',
                template: 'westcash_received',
                data: {
                    recipientName: recipient.firstName,
                    senderName: sender.fullName,
                    amount,
                    currency,
                    transactionId: transaction.transactionId
                }
            });

            await sendSMS({
                to: recipient.phoneNumber,
                message: `You received ${amount} ${currency} from ${sender.fullName}. Transaction ID: ${transaction.transactionId}`
            });

            res.status(201).json({
                status: 'success',
                message: 'Transfer completed successfully',
                data: {
                    transaction: {
                        id: transaction.transactionId,
                        reference: transaction.reference,
                        amount: transaction.amount,
                        currency: transaction.currency,
                        fees: transaction.fees,
                        totalAmount: transaction.totalAmount,
                        status: transaction.status,
                        recipient: {
                            name: recipient.fullName,
                            email: recipient.email
                        },
                        createdAt: transaction.createdAt
                    }
                }
            });

        } catch (error) {
            console.error('WestCash transfer error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Transfer failed. Please try again.'
            });
        }
    }

    // @desc    Send money to mobile money wallet
    async mobileMoneyTransfer(req, res) {
        try {
            const userId = req.user.userId;
            const {
                recipientName,
                recipientPhone,
                recipientCountry,
                provider,
                amount,
                currency,
                description,
                purpose
            } = req.body;

            // Get sender details
            const sender = await User.findById(userId);
            if (!sender) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            // Check verification and limits
            if (!sender.isPhoneVerified) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Please verify your phone number first'
                });
            }

            if (amount > sender.limits.singleTransaction) {
                return res.status(400).json({
                    status: 'error',
                    message: `Transaction amount exceeds your single transaction limit of ${sender.limits.singleTransaction}`
                });
            }

            // Create transaction record
            const transaction = new Transaction({
                type: 'mobile_money',
                sender: {
                    userId: sender._id,
                    name: sender.fullName,
                    email: sender.email,
                    phoneNumber: sender.phoneNumber,
                    country: sender.address.country
                },
                recipient: {
                    name: recipientName,
                    phoneNumber: recipientPhone,
                    country: recipientCountry,
                    mobileMoneyDetails: {
                        phoneNumber: recipientPhone,
                        provider,
                        country: recipientCountry
                    }
                },
                amount,
                currency,
                description,
                purpose,
                paymentMethod: {
                    type: 'wallet'
                },
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });

            // Calculate fees
            transaction.calculateFees();

            // Check wallet balance
            if (sender.walletBalance < transaction.totalAmount) {
                return res.status(400).json({
                    status: 'error',
                    message: `Insufficient balance. Required: ${transaction.totalAmount} (including fees: ${transaction.fees.totalFees})`
                });
            }

            await transaction.save();

            // Deduct from sender's wallet
            sender.walletBalance -= transaction.totalAmount;
            await sender.save();

            // Process transfer with Flutterwave
            try {
                const transferData = {
                    account_bank: provider,
                    account_number: recipientPhone,
                    amount,
                    currency,
                    beneficiary_name: recipientName,
                    reference: transaction.reference,
                    narration: description || `Mobile money transfer from ${sender.fullName}`
                };

                const flwResponse = await flutterwaveService.transferMobileMoney(transferData);

                transaction.provider = {
                    name: 'flutterwave',
                    transactionId: flwResponse.id,
                    reference: flwResponse.reference,
                    response: flwResponse
                };

                await transaction.addTimeline('processing', 'Mobile money transfer initiated');

                // Send notification SMS
                await sendSMS({
                    to: recipientPhone,
                    message: `You have received ${amount} ${currency} via ${provider} from ${sender.fullName}. Transaction ID: ${transaction.transactionId}`
                });

                res.status(201).json({
                    status: 'success',
                    message: 'Mobile money transfer initiated successfully',
                    data: {
                        transaction: {
                            id: transaction.transactionId,
                            reference: transaction.reference,
                            amount: transaction.amount,
                            currency: transaction.currency,
                            fees: transaction.fees,
                            totalAmount: transaction.totalAmount,
                            status: transaction.status,
                            recipient: transaction.recipient,
                            createdAt: transaction.createdAt
                        }
                    }
                });

            } catch (providerError) {
                // Refund wallet if provider fails
                sender.walletBalance += transaction.totalAmount;
                await sender.save();

                await transaction.addTimeline('failed', 'Mobile money transfer failed', {
                    error: providerError.message
                });

                throw providerError;
            }

        } catch (error) {
            console.error('Mobile money transfer error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Transfer failed. Please try again.'
            });
        }
    }

    // @desc    Get transfer quote with fees and exchange rates
    async getQuote(req, res) {
        try {
            const { amount, fromCurrency, toCurrency, transferType } = req.query;

            if (!amount || !fromCurrency || !transferType) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Amount, fromCurrency, and transferType are required'
                });
            }

            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid amount'
                });
            }

            // Get exchange rate if needed
            let exchangeRate = 1;
            let convertedAmount = numAmount;

            if (toCurrency && fromCurrency !== toCurrency) {
                const rateData = await exchangeRateService.getRate(fromCurrency, toCurrency);
                exchangeRate = rateData.rate;
                convertedAmount = numAmount * exchangeRate;
            }

            // Calculate fees based on transfer type
            let fees = {
                transactionFee: 0,
                exchangeFee: 0,
                processingFee: 0,
                totalFees: 0
            };

            switch (transferType) {
                case 'bank_transfer':
                    if (numAmount <= 1000) {
                        fees.transactionFee = 10;
                    } else if (numAmount <= 10000) {
                        fees.transactionFee = 25;
                    } else {
                        fees.transactionFee = Math.min(numAmount * 0.015, 500);
                    }
                    break;

                case 'mobile_money':
                    fees.transactionFee = Math.min(numAmount * 0.02, 300);
                    break;

                case 'westcash_transfer':
                    fees.transactionFee = numAmount <= 10000 ? 0 : numAmount * 0.005;
                    break;
            }

            if (toCurrency && fromCurrency !== toCurrency) {
                fees.exchangeFee = numAmount * 0.01; // 1% for currency conversion
            }

            fees.totalFees = fees.transactionFee + fees.exchangeFee + fees.processingFee;

            const totalAmount = numAmount + fees.totalFees;

            res.json({
                status: 'success',
                data: {
                    quote: {
                        amount: numAmount,
                        fromCurrency,
                        toCurrency: toCurrency || fromCurrency,
                        exchangeRate,
                        convertedAmount,
                        fees,
                        totalAmount,
                        transferType,
                        timestamp: new Date().toISOString()
                    }
                }
            });

        } catch (error) {
            console.error('Quote calculation error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to calculate quote'
            });
        }
    }

    // @desc    Get user's saved recipients
    async getRecipients(req, res) {
        try {
            const userId = req.user.userId;

            // Get recent recipients from transactions
            const recentTransactions = await Transaction.find({
                'sender.userId': userId,
                status: 'completed'
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('recipient type createdAt');

            const recipients = recentTransactions.map(tx => ({
                name: tx.recipient.name,
                email: tx.recipient.email,
                phoneNumber: tx.recipient.phoneNumber,
                country: tx.recipient.country,
                type: tx.type,
                lastUsed: tx.createdAt,
                bankDetails: tx.recipient.bankDetails,
                mobileMoneyDetails: tx.recipient.mobileMoneyDetails
            }));

            res.json({
                status: 'success',
                data: {
                    recipients
                }
            });

        } catch (error) {
            console.error('Get recipients error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch recipients'
            });
        }
    }
}

module.exports = new TransferController();