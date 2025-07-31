// controllers/adminController.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { flutterwaveService } = require('../services/paymentService');

class AdminController {
    // @desc    Get admin dashboard statistics
    async getDashboard(req, res) {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

            // User statistics
            const totalUsers = await User.countDocuments();
            const activeUsers = await User.countDocuments({ status: 'active' });
            const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });
            const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: thisMonth } });

            // Transaction statistics
            const totalTransactions = await Transaction.countDocuments();
            const completedTransactions = await Transaction.countDocuments({ status: 'completed' });
            const pendingTransactions = await Transaction.countDocuments({ status: 'pending' });
            const failedTransactions = await Transaction.countDocuments({ status: 'failed' });

            // Volume statistics
            const volumeStats = await Transaction.aggregate([
                { $match: { status: 'completed' } },
                {
                    $group: {
                        _id: null,
                        totalVolume: { $sum: '$amount' },
                        totalFees: { $sum: '$fees.totalFees' },
                        averageTransaction: { $avg: '$amount' }
                    }
                }
            ]);

            // Monthly growth
            const thisMonthStats = await Transaction.aggregate([
                { $match: { createdAt: { $gte: thisMonth }, status: 'completed' } },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        volume: { $sum: '$amount' }
                    }
                }
            ]);

            const lastMonthStats = await Transaction.aggregate([
                {
                    $match: {
                        createdAt: { $gte: lastMonth, $lt: thisMonth },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        volume: { $sum: '$amount' }
                    }
                }
            ]);

            // KYC statistics
            const kycStats = await User.aggregate([
                {
                    $group: {
                        _id: '$kycStatus',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Recent transactions
            const recentTransactions = await Transaction.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('sender.userId', 'firstName lastName email')
                .populate('recipient.userId', 'firstName lastName email');

            res.json({
                status: 'success',
                data: {
                    users: {
                        total: totalUsers,
                        active: activeUsers,
                        newToday: newUsersToday,
                        newThisMonth: newUsersThisMonth
                    },
                    transactions: {
                        total: totalTransactions,
                        completed: completedTransactions,
                        pending: pendingTransactions,
                        failed: failedTransactions,
                        successRate: totalTransactions > 0 ? (completedTransactions / totalTransactions * 100).toFixed(2) : 0
                    },
                    volume: {
                        total: volumeStats[0]?.totalVolume || 0,
                        fees: volumeStats[0]?.totalFees || 0,
                        average: volumeStats[0]?.averageTransaction || 0
                    },
                    growth: {
                        thisMonth: thisMonthStats[0] || { count: 0, volume: 0 },
                        lastMonth: lastMonthStats[0] || { count: 0, volume: 0 }
                    },
                    kyc: kycStats.reduce((acc, item) => {
                        acc[item._id] = item.count;
                        return acc;
                    }, {}),
                    recentTransactions
                }
            });

        } catch (error) {
            console.error('Admin dashboard error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch dashboard data'
            });
        }
    }

    // @desc    Get all users with filters and pagination
    async getUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            const {
                status,
                kycStatus,
                country,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            // Build query
            let query = {};

            if (status) query.status = status;
            if (kycStatus) query.kycStatus = kycStatus;
            if (country) query['address.country'] = country;

            if (search) {
                query.$or = [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phoneNumber: { $regex: search, $options: 'i' } }
                ];
            }

            // Get users
            const users = await User.find(query)
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .skip(skip)
                .limit(limit)
                .select('-password -twoFactorSecret -emailVerificationToken -phoneVerificationCode -passwordResetToken');

            const total = await User.countDocuments(query);

            res.json({
                status: 'success',
                data: {
                    users,
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
            console.error('Get users error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch users'
            });
        }
    }

    // @desc    Get specific user details
    async getUserDetails(req, res) {
        try {
            const { id } = req.params;

            const user = await User.findById(id)
                .select('-password -twoFactorSecret -emailVerificationToken -phoneVerificationCode -passwordResetToken');

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            // Get user's transaction summary
            const transactionSummary = await Transaction.getUserSummary(id);

            // Get recent transactions
            const recentTransactions = await Transaction.find({
                $or: [
                    { 'sender.userId': id },
                    { 'recipient.userId': id }
                ]
            })
                .sort({ createdAt: -1 })
                .limit(10);

            res.json({
                status: 'success',
                data: {
                    user,
                    transactionSummary,
                    recentTransactions
                }
            });

        } catch (error) {
            console.error('Get user details error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch user details'
            });
        }
    }

    // @desc    Update user status
    async updateUserStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, reason } = req.body;

            const user = await User.findByIdAndUpdate(
                id,
                { status },
                { new: true, runValidators: true }
            );

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            // Log the status change (you might want to create an admin action log)
            console.log(`User ${id} status changed to ${status} by admin. Reason: ${reason}`);

            res.json({
                status: 'success',
                message: 'User status updated successfully',
                data: { user }
            });

        } catch (error) {
            console.error('Update user status error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to update user status'
            });
        }
    }

    // @desc    Update user KYC status
    async updateKycStatus(req, res) {
        try {
            const { id } = req.params;
            const { kycStatus, kycLevel, reason } = req.body;

            const updateData = { kycStatus };
            if (kycLevel !== undefined) updateData.kycLevel = kycLevel;

            // Update transaction limits based on KYC level
            if (kycLevel !== undefined) {
                const limits = {
                    0: { dailyTransfer: 50000, monthlyTransfer: 500000, singleTransaction: 100000 },
                    1: { dailyTransfer: 200000, monthlyTransfer: 2000000, singleTransaction: 500000 },
                    2: { dailyTransfer: 1000000, monthlyTransfer: 10000000, singleTransaction: 2000000 },
                    3: { dailyTransfer: 5000000, monthlyTransfer: 50000000, singleTransaction: 10000000 }
                };
                updateData.limits = limits[kycLevel] || limits[0];
            }

            const user = await User.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            );

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            console.log(`User ${id} KYC status changed to ${kycStatus} (Level ${kycLevel}) by admin. Reason: ${reason}`);

            res.json({
                status: 'success',
                message: 'KYC status updated successfully',
                data: { user }
            });

        } catch (error) {
            console.error('Update KYC status error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to update KYC status'
            });
        }
    }

    // @desc    Get all transactions with filters
    async getTransactions(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            const {
                status,
                type,
                currency,
                minAmount,
                maxAmount,
                startDate,
                endDate,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            // Build query
            let query = {};

            if (status) query.status = status;
            if (type) query.type = type;
            if (currency) query.currency = currency;

            if (minAmount || maxAmount) {
                query.amount = {};
                if (minAmount) query.amount.$gte = parseFloat(minAmount);
                if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
            }

            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            if (search) {
                query.$or = [
                    { transactionId: { $regex: search, $options: 'i' } },
                    { reference: { $regex: search, $options: 'i' } },
                    { 'sender.email': { $regex: search, $options: 'i' } },
                    { 'recipient.email': { $regex: search, $options: 'i' } }
                ];
            }

            // Get transactions
            const transactions = await Transaction.find(query)
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .skip(skip)
                .limit(limit)
                .populate('sender.userId', 'firstName lastName email')
                .populate('recipient.userId', 'firstName lastName email');

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
            console.error('Get transactions error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch transactions'
            });
        }
    }

    // @desc    Get specific transaction details
    async getTransactionDetails(req, res) {
        try {
            const { id } = req.params;

            const transaction = await Transaction.findOne({
                $or: [
                    { _id: id },
                    { transactionId: id },
                    { reference: id }
                ]
            })
                .populate('sender.userId', 'firstName lastName email phoneNumber')
                .populate('recipient.userId', 'firstName lastName email phoneNumber');

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
            console.error('Get transaction details error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch transaction details'
            });
        }
    }

    // @desc    Retry failed transaction
    async retryTransaction(req, res) {
        try {
            const { id } = req.params;

            const transaction = await Transaction.findOne({
                $or: [
                    { _id: id },
                    { transactionId: id }
                ]
            });

            if (!transaction) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Transaction not found'
                });
            }

            if (transaction.status !== 'failed') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Only failed transactions can be retried'
                });
            }

            // Retry with Flutterwave
            const retryResult = await flutterwaveService.retryTransfer(transaction.provider.transactionId);

            await transaction.addTimeline('processing', 'Transaction retried by admin', {
                adminId: req.user.userId,
                retryResult
            });

            res.json({
                status: 'success',
                message: 'Transaction retry initiated',
                data: { transaction }
            });

        } catch (error) {
            console.error('Retry transaction error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to retry transaction'
            });
        }
    }

    // @desc    Get detailed analytics
    async getAnalytics(req, res) {
        try {
            const { period = '30', groupBy = 'day' } = req.query;
            const days = parseInt(period);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Transaction volume by period
            const groupByFormat = {
                day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                week: { $week: '$createdAt' },
                month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
            };

            const volumeAnalytics = await Transaction.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: groupByFormat[groupBy],
                        totalVolume: { $sum: '$amount' },
                        totalFees: { $sum: '$fees.totalFees' },
                        transactionCount: { $sum: 1 },
                        averageAmount: { $avg: '$amount' }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Transaction by type
            const typeAnalytics = await Transaction.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        volume: { $sum: '$amount' },
                        fees: { $sum: '$fees.totalFees' }
                    }
                }
            ]);

            // Country analytics
            const countryAnalytics = await Transaction.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: '$recipient.country',
                        count: { $sum: 1 },
                        volume: { $sum: '$amount' }
                    }
                },
                { $sort: { volume: -1 } }
            ]);

            res.json({
                status: 'success',
                data: {
                    period: `${days} days`,
                    volumeAnalytics,
                    typeAnalytics,
                    countryAnalytics
                }
            });

        } catch (error) {
            console.error('Analytics error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch analytics'
            });
        }
    }
}

module.exports = new AdminController();