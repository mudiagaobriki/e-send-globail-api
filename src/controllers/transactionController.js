// controllers/transactionController.js
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { flutterwaveService } = require('../services/paymentService');

class TransactionController {
    // @desc    Get user transaction history
    async getHistory(req, res) {
        try {
            const userId = req.user.userId;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const type = req.query.type;
            const status = req.query.status;
            const skip = (page - 1) * limit;

            // Build query
            let query = {
                $or: [
                    { 'sender.userId': userId },
                    { 'recipient.userId': userId }
                ]
            };

            if (type) query.type = type;
            if (status) query.status = status;

            // Get transactions
            const transactions = await Transaction.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-provider.response -metadata');

            const total = await Transaction.countDocuments(query);

            res.json({
                status: 'success',
                data: {
                    transactions,
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
            console.error('Get transaction history error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch transaction history'
            });
        }
    }

    // @desc    Get specific transaction details
    async getTransactionById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId;

            const transaction = await Transaction.findOne({
                $and: [
                    {
                        $or: [
                            { _id: id },
                            { transactionId: id },
                            { reference: id }
                        ]
                    },
                    {
                        $or: [
                            { 'sender.userId': userId },
                            { 'recipient.userId': userId }
                        ]
                    }
                ]
            }).select('-provider.response');

            if (!transaction) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Transaction not found'
                });
            }

            res.json({
                status: 'success',
                data: { transaction }
            });

        } catch (error) {
            console.error('Get transaction error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch transaction'
            });
        }
    }

    // @desc    Get transaction status
    async getTransactionStatus(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId;

            const transaction = await Transaction.findOne({
                $and: [
                    {
                        $or: [
                            { _id: id },
                            { transactionId: id }
                        ]
                    },
                    {
                        $or: [
                            { 'sender.userId': userId },
                            { 'recipient.userId': userId }
                        ]
                    }
                ]
            }).select('transactionId status timeline createdAt completedAt');

            if (!transaction) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Transaction not found'
                });
            }

            // If transaction is still processing, check with provider
            if (transaction.status === 'processing' && transaction.provider?.transactionId) {
                try {
                    const providerStatus = await flutterwaveService.getTransferStatus(transaction.provider.transactionId);

                    // Update transaction if status changed
                    if (providerStatus.status !== transaction.status) {
                        await transaction.addTimeline(providerStatus.status, 'Status updated from provider');
                    }
                } catch (error) {
                    console.log('Provider status check failed:', error.message);
                }
            }

            res.json({
                status: 'success',
                data: {
                    transactionId: transaction.transactionId,
                    status: transaction.status,
                    timeline: transaction.timeline,
                    createdAt: transaction.createdAt,
                    completedAt: transaction.completedAt
                }
            });

        } catch (error) {
            console.error('Get transaction status error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch transaction status'
            });
        }
    }

    // @desc    Handle payment webhook
    async handleWebhook(req, res) {
        try {
            const signature = req.headers['verif-hash'];
            const payload = JSON.stringify(req.body);

            // Verify webhook signature
            if (!flutterwaveService.validateWebhookSignature(payload, signature)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid webhook signature'
                });
            }

            const webhookData = flutterwaveService.processWebhook(req.body);
            const { event, transactionId, reference, status, amount, currency } = webhookData;

            // Find transaction by reference
            const transaction = await Transaction.findOne({ reference });
            if (!transaction) {
                console.log(`Transaction not found for reference: ${reference}`);
                return res.status(404).json({
                    status: 'error',
                    message: 'Transaction not found'
                });
            }

            // Handle different webhook events
            switch (event) {
                case 'charge.completed':
                    if (status === 'successful') {
                        // For wallet deposits
                        if (transaction.type === 'wallet_deposit') {
                            const user = await User.findById(transaction.sender.userId);
                            if (user) {
                                user.walletBalance += transaction.amount;
                                await user.save();
                            }
                        }

                        await transaction.addTimeline('completed', 'Payment completed successfully');
                    } else {
                        await transaction.addTimeline('failed', 'Payment failed');
                    }
                    break;

                case 'transfer.completed':
                    if (status === 'SUCCESSFUL') {
                        await transaction.addTimeline('completed', 'Transfer completed successfully');
                    } else {
                        await transaction.addTimeline('failed', 'Transfer failed');

                        // Refund wallet for failed transfers
                        if (transaction.type !== 'wallet_deposit') {
                            const sender = await User.findById(transaction.sender.userId);
                            if (sender) {
                                sender.walletBalance += transaction.totalAmount;
                                await sender.save();
                            }
                        }
                    }
                    break;

                default:
                    console.log(`Unhandled webhook event: ${event}`);
            }

            res.status(200).json({
                status: 'success',
                message: 'Webhook processed successfully'
            });

        } catch (error) {
            console.error('Webhook processing error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Webhook processing failed'
            });
        }
    }
}

module.exports = new TransactionController();