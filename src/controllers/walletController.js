// controllers/walletController.js
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { flutterwaveService } = require('../services/paymentService');

class WalletController {
    // @desc    Get wallet balance
    async getBalance(req, res) {
        try {
            const user = await User.findById(req.user.userId);
            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            res.json({
                status: 'success',
                data: {
                    balance: user.walletBalance,
                    currency: user.walletCurrency,
                    lastUpdated: user.updatedAt
                }
            });

        } catch (error) {
            console.error('Get balance error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch wallet balance'
            });
        }
    }

    // @desc    Deposit money to wallet
    async deposit(req, res) {
        try {
            const userId = req.user.userId;
            const { amount, currency, paymentMethod } = req.body;

            // Get user details
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            // Check if user is verified
            if (!user.isPhoneVerified) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Please verify your phone number first'
                });
            }

            // Create transaction record
            const transaction = new Transaction({
                type: 'wallet_deposit',
                sender: {
                    userId: user._id,
                    name: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    country: user.address.country
                },
                recipient: {
                    userId: user._id,
                    name: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    country: user.address.country
                },
                amount,
                currency,
                paymentMethod: {
                    type: paymentMethod
                },
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });

            // Calculate fees (minimal for deposits)
            transaction.fees = {
                transactionFee: 0,
                exchangeFee: 0,
                processingFee: paymentMethod === 'card' ? amount * 0.015 : 0, // 1.5% for card
                totalFees: paymentMethod === 'card' ? amount * 0.015 : 0
            };
            transaction.totalAmount = amount + transaction.fees.totalFees;

            await transaction.save();

            let paymentResponse;

            if (paymentMethod === 'card') {
                // Initialize card payment with Flutterwave
                const paymentData = {
                    tx_ref: transaction.reference,
                    amount: transaction.totalAmount,
                    currency,
                    customer: {
                        email: user.email,
                        phone_number: user.phoneNumber,
                        name: user.fullName
                    },
                    customizations: {
                        title: 'WestCash Wallet Deposit',
                        description: `Deposit ${amount} ${currency} to wallet`,
                        logo: 'https://your-logo-url.com/logo.png'
                    },
                    redirect_url: `${process.env.FRONTEND_URL}/wallet/deposit/callback`
                };

                paymentResponse = await flutterwaveService.initializePayment(paymentData);

                // Update transaction with payment link
                transaction.provider = {
                    name: 'flutterwave',
                    transactionId: paymentResponse.id,
                    response: paymentResponse
                };

                await transaction.addTimeline('pending', 'Payment initialized, awaiting customer action');

                res.status(201).json({
                    status: 'success',
                    message: 'Payment initialized successfully',
                    data: {
                        transaction: {
                            id: transaction.transactionId,
                            reference: transaction.reference,
                            amount: transaction.amount,
                            currency: transaction.currency,
                            fees: transaction.fees,
                            totalAmount: transaction.totalAmount,
                            status: transaction.status
                        },
                        paymentLink: paymentResponse.link,
                        hostedLink: paymentResponse.hosted_link
                    }
                });

            } else if (paymentMethod === 'bank_transfer') {
                // Generate virtual account for bank transfer
                const accountData = {
                    email: user.email,
                    tx_ref: transaction.reference,
                    amount: transaction.totalAmount,
                    currency,
                    is_permanent: false,
                    narration: `Wallet deposit for ${user.fullName}`
                };

                paymentResponse = await flutterwaveService.createVirtualAccount(accountData);

                transaction.provider = {
                    name: 'flutterwave',
                    transactionId: paymentResponse.id,
                    response: paymentResponse
                };

                await transaction.addTimeline('pending', 'Virtual account created for bank transfer');

                res.status(201).json({
                    status: 'success',
                    message: 'Virtual account created successfully',
                    data: {
                        transaction: {
                            id: transaction.transactionId,
                            reference: transaction.reference,
                            amount: transaction.amount,
                            currency: transaction.currency,
                            fees: transaction.fees,
                            totalAmount: transaction.totalAmount,
                            status: transaction.status
                        },
                        virtualAccount: {
                            accountNumber: paymentResponse.account_number,
                            bankName: paymentResponse.bank_name,
                            accountName: paymentResponse.account_name,
                            expiryDate: paymentResponse.expiry_date
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Wallet deposit error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Deposit initialization failed. Please try again.'
            });
        }
    }

    // @desc    Withdraw money from wallet to bank account
    async withdraw(req, res) {
        try {
            const userId = req.user.userId;
            const { amount, currency, bankCode, accountNumber, accountName } = req.body;

            // Get user details
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            // Check verification and KYC
            if (!user.isPhoneVerified) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Please verify your phone number first'
                });
            }

            if (user.kycStatus !== 'verified') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Please complete KYC verification to withdraw funds'
                });
            }

            // Check wallet balance
            if (user.walletBalance < amount) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Insufficient wallet balance'
                });
            }

            // Create transaction record
            const transaction = new Transaction({
                type: 'wallet_withdrawal',
                sender: {
                    userId: user._id,
                    name: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    country: user.address.country
                },
                recipient: {
                    name: accountName,
                    country: user.address.country,
                    bankDetails: {
                        accountNumber,
                        bankCode,
                        accountName
                    }
                },
                amount,
                currency,
                paymentMethod: {
                    type: 'wallet'
                },
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });

            // Calculate withdrawal fees
            transaction.fees = {
                transactionFee: Math.min(amount * 0.01, 100), // 1% max 100
                exchangeFee: 0,
                processingFee: 0,
                totalFees: Math.min(amount * 0.01, 100)
            };
            transaction.totalAmount = amount + transaction.fees.totalFees;

            // Final balance check with fees
            if (user.walletBalance < transaction.totalAmount) {
                return res.status(400).json({
                    status: 'error',
                    message: `Insufficient balance. Required: ${transaction.totalAmount} (including fees: ${transaction.fees.totalFees})`
                });
            }

            await transaction.save();

            // Deduct from wallet immediately
            user.walletBalance -= transaction.totalAmount;
            await user.save();

            try {
                // Process withdrawal with Flutterwave
                const withdrawalData = {
                    account_bank: bankCode,
                    account_number: accountNumber,
                    amount,
                    currency,
                    beneficiary_name: accountName,
                    reference: transaction.reference,
                    narration: `Wallet withdrawal for ${user.fullName}`
                };

                const flwResponse = await flutterwaveService.transfer(withdrawalData);

                transaction.provider = {
                    name: 'flutterwave',
                    transactionId: flwResponse.id,
                    reference: flwResponse.reference,
                    response: flwResponse
                };

                await transaction.addTimeline('processing', 'Withdrawal initiated with Flutterwave');

                res.status(201).json({
                    status: 'success',
                    message: 'Withdrawal initiated successfully',
                    data: {
                        transaction: {
                            id: transaction.transactionId,
                            reference: transaction.reference,
                            amount: transaction.amount,
                            currency: transaction.currency,
                            fees: transaction.fees,
                            totalAmount: transaction.totalAmount,
                            status: transaction.status,
                            estimatedArrival: '1-3 business days'
                        }
                    }
                });

            } catch (providerError) {
                // Refund wallet if withdrawal fails
                user.walletBalance += transaction.totalAmount;
                await user.save();

                await transaction.addTimeline('failed', 'Withdrawal failed at provider level', {
                    error: providerError.message
                });

                throw providerError;
            }

        } catch (error) {
            console.error('Wallet withdrawal error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Withdrawal failed. Please try again.'
            });
        }
    }

    // @desc    Get wallet transaction history
    async getHistory(req, res) {
        try {
            const userId = req.user.userId;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const type = req.query.type; // deposit, withdrawal, all
            const skip = (page - 1) * limit;

            // Build query
            let query = {
                $or: [
                    { 'sender.userId': userId },
                    { 'recipient.userId': userId }
                ]
            };

            if (type && type !== 'all') {
                if (type === 'deposit') {
                    query.type = 'wallet_deposit';
                } else if (type === 'withdrawal') {
                    query.type = 'wallet_withdrawal';
                }
            }

            // Get transactions
            const transactions = await Transaction.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-provider.response -metadata -timeline');

            // Get total count for pagination
            const total = await Transaction.countDocuments(query);

            // Format transactions for wallet view
            const formattedTransactions = transactions.map(tx => {
                const isCredit = tx.recipient.userId && tx.recipient.userId.toString() === userId;
                const isDebit = tx.sender.userId && tx.sender.userId.toString() === userId;

                return {
                    id: tx.transactionId,
                    reference: tx.reference,
                    type: tx.type,
                    direction: isCredit ? 'credit' : 'debit',
                    amount: tx.amount,
                    currency: tx.currency,
                    fees: tx.fees,
                    status: tx.status,
                    description: tx.description,
                    counterparty: isCredit ? tx.sender.name : tx.recipient.name,
                    createdAt: tx.createdAt,
                    completedAt: tx.completedAt
                };
            });

            res.json({
                status: 'success',
                data: {
                    transactions: formattedTransactions,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalItems: total,
                        itemsPerPage: limit,
                        hasNext: page < Math.ceil(total / limit),
                        hasPrev: page > 1
                    }
                }
            });

        } catch (error) {
            console.error('Get wallet history error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch wallet history'
            });
        }
    }

    // @desc    Get wallet analytics and summary
    async getAnalytics(req, res) {
        try {
            const userId = req.user.userId;
            const period = req.query.period || '30'; // days
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(period));

            // Get user's current balance
            const user = await User.findById(userId).select('walletBalance walletCurrency');

            // Aggregate transaction data
            const analytics = await Transaction.aggregate([
                {
                    $match: {
                        $or: [
                            { 'sender.userId': user._id },
                            { 'recipient.userId': user._id }
                        ],
                        createdAt: { $gte: startDate },
                        status: 'completed'
                    }
                },
                {
                    $addFields: {
                        isCredit: {
                            $cond: [
                                { $eq: ['$recipient.userId', user._id] },
                                true,
                                false
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            type: '$type',
                            isCredit: '$isCredit'
                        },
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' },
                        totalFees: { $sum: '$fees.totalFees' }
                    }
                }
            ]);

            // Process analytics data
            let totalDeposits = 0;
            let totalWithdrawals = 0;
            let totalSent = 0;
            let totalReceived = 0;
            let totalFees = 0;
            let transactionCount = 0;

            analytics.forEach(item => {
                transactionCount += item.count;
                totalFees += item.totalFees;

                switch (item._id.type) {
                    case 'wallet_deposit':
                        totalDeposits += item.totalAmount;
                        break;
                    case 'wallet_withdrawal':
                        totalWithdrawals += item.totalAmount;
                        break;
                    default:
                        if (item._id.isCredit) {
                            totalReceived += item.totalAmount;
                        } else {
                            totalSent += item.totalAmount;
                        }
                }
            });

            res.json({
                status: 'success',
                data: {
                    currentBalance: user.walletBalance,
                    currency: user.walletCurrency,
                    period: `${period} days`,
                    summary: {
                        totalDeposits,
                        totalWithdrawals,
                        totalSent,
                        totalReceived,
                        totalFees,
                        transactionCount,
                        netFlow: totalDeposits + totalReceived - totalWithdrawals - totalSent - totalFees
                    }
                }
            });

        } catch (error) {
            console.error('Get wallet analytics error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch wallet analytics'
            });
        }
    }
}

module.exports = new WalletController();