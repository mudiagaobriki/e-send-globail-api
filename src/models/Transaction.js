// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // Basic Transaction Info
    transactionId: {
        type: String,
        unique: true,
        required: true
    },
    reference: {
        type: String,
        unique: true,
        required: true
    },
    type: {
        type: String,
        enum: [
            'send_money',
            'receive_money',
            'wallet_deposit',
            'wallet_withdrawal',
            'westcash_transfer',
            'esend_transfer',
            'bank_transfer',
            'mobile_money',
            'card_payment',
            'refund'
        ],
        required: true
    },

    // Parties Involved
    sender: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        name: String,
        email: String,
        phoneNumber: String,
        country: String
    },
    recipient: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        name: {
            type: String,
            required: true
        },
        email: String,
        phoneNumber: String,
        country: {
            type: String,
            required: true
        },
        bankDetails: {
            accountNumber: String,
            bankCode: String,
            bankName: String,
            accountName: String
        },
        mobileMoneyDetails: {
            phoneNumber: String,
            provider: String,
            country: String
        }
    },

    // Financial Details
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        default: 'NGN'
    },

    // Exchange Rate Info (for cross-currency transfers)
    exchangeRate: {
        fromCurrency: String,
        toCurrency: String,
        rate: Number,
        provider: String,
        timestamp: Date
    },

    // Converted amounts
    senderAmount: {
        amount: Number,
        currency: String
    },
    recipientAmount: {
        amount: Number,
        currency: String
    },

    // Fees and Charges
    fees: {
        transactionFee: {
            type: Number,
            default: 0
        },
        exchangeFee: {
            type: Number,
            default: 0
        },
        processingFee: {
            type: Number,
            default: 0
        },
        totalFees: {
            type: Number,
            default: 0
        }
    },

    // Total amounts
    totalAmount: {
        type: Number,
        required: true // amount + total fees
    },

    // Transaction Status
    status: {
        type: String,
        enum: [
            'pending',
            'processing',
            'completed',
            'failed',
            'cancelled',
            'refunded',
            'expired'
        ],
        default: 'pending'
    },

    // Payment Method
    paymentMethod: {
        type: {
            type: String,
            enum: ['wallet', 'card', 'bank_transfer', 'mobile_money'],
            required: true
        },
        details: {
            // For card payments
            cardType: String,
            last4: String,

            // For bank transfers
            bankName: String,
            accountNumber: String,

            // For mobile money
            provider: String,
            phoneNumber: String
        }
    },

    // Provider Info (Flutterwave, etc.)
    provider: {
        name: {
            type: String,
            default: 'flutterwave'
        },
        transactionId: String,
        reference: String,
        response: mongoose.Schema.Types.Mixed
    },

    // Description and Notes
    description: String,
    purpose: {
        type: String,
        enum: [
            'family_support',
            'education',
            'business',
            'medical',
            'gift',
            'investment',
            'other'
        ]
    },

    // Metadata
    metadata: {
        ipAddress: String,
        userAgent: String,
        deviceId: String,
        location: {
            country: String,
            city: String,
            coordinates: [Number] // [longitude, latitude]
        }
    },

    // Timeline
    timeline: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        message: String,
        details: mongoose.Schema.Types.Mixed
    }],

    // Dates
    initiatedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    failedAt: Date,
    expiresAt: Date,

    // Notifications
    notifications: {
        senderNotified: {
            type: Boolean,
            default: false
        },
        recipientNotified: {
            type: Boolean,
            default: false
        },
        smsNotificationsSent: [{
            phoneNumber: String,
            status: String,
            sentAt: Date
        }],
        emailNotificationsSent: [{
            email: String,
            status: String,
            sentAt: Date
        }]
    },

    // Reconciliation
    reconciled: {
        type: Boolean,
        default: false
    },
    reconciledAt: Date,

    // Related transactions (for refunds, etc.)
    relatedTransactions: [{
        transactionId: String,
        type: String,
        relationship: String // 'refund_of', 'refunded_by', etc.
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ 'sender.userId': 1 });
transactionSchema.index({ 'recipient.userId': 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ initiatedAt: -1 });
transactionSchema.index({ 'provider.transactionId': 1 });

// Compound indexes
transactionSchema.index({ 'sender.userId': 1, status: 1, createdAt: -1 });
transactionSchema.index({ 'recipient.userId': 1, status: 1, createdAt: -1 });
transactionSchema.index({ status: 1, type: 1, createdAt: -1 });

// Virtual for transaction age
transactionSchema.virtual('age').get(function() {
    return Date.now() - this.initiatedAt;
});

// Virtual for is expired
transactionSchema.virtual('isExpired').get(function() {
    return this.expiresAt && this.expiresAt < new Date();
});

// Pre-save middleware to generate transaction ID
transactionSchema.pre('save', function(next) {
    if (!this.transactionId) {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        this.transactionId = `WC${timestamp}${random}`.toUpperCase();
    }

    if (!this.reference) {
        const { v4: uuidv4 } = require('uuid');
        this.reference = `esend_${uuidv4()}`;
    }

    // Set expiry if not set (default 24 hours for pending transactions)
    if (!this.expiresAt && this.status === 'pending') {
        this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    next();
});

// Method to add timeline entry
transactionSchema.methods.addTimeline = function(status, message, details = {}) {
    this.timeline.push({
        status,
        timestamp: new Date(),
        message,
        details
    });

    // Update main status
    this.status = status;

    // Set completion/failure dates
    if (status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    } else if (status === 'failed' && !this.failedAt) {
        this.failedAt = new Date();
    }

    return this.save();
};

// Method to calculate fees (basic implementation)
transactionSchema.methods.calculateFees = function() {
    const baseAmount = this.amount;

    // Basic fee calculation (you can make this more sophisticated)
    let transactionFee = 0;

    if (this.type === 'send_money' || this.type === 'bank_transfer') {
        if (baseAmount <= 1000) {
            transactionFee = 10;
        } else if (baseAmount <= 10000) {
            transactionFee = 25;
        } else {
            transactionFee = Math.min(baseAmount * 0.015, 500); // 1.5% max 500
        }
    }

    const exchangeFee = this.exchangeRate ? baseAmount * 0.01 : 0; // 1% for currency conversion
    const processingFee = 0; // Additional processing fees if any

    this.fees = {
        transactionFee,
        exchangeFee,
        processingFee,
        totalFees: transactionFee + exchangeFee + processingFee
    };

    this.totalAmount = baseAmount + this.fees.totalFees;

    return this.fees;
};

// Static method to get user's transaction summary
transactionSchema.statics.getUserSummary = async function(userId, dateRange = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    const summary = await this.aggregate([
        {
            $match: {
                $or: [
                    { 'sender.userId': mongoose.Types.ObjectId(userId) },
                    { 'recipient.userId': mongoose.Types.ObjectId(userId) }
                ],
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
            }
        }
    ]);

    return summary;
};

module.exports = mongoose.model('Transaction', transactionSchema);