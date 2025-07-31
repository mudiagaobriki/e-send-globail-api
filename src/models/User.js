// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Personal Information
    firstName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    dateOfBirth: {
        type: Date,
        required: true
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },

    // Address Information
    address: {
        street: String,
        city: String,
        state: String,
        country: {
            type: String,
            required: true
        },
        postalCode: String
    },

    // Authentication
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    phoneVerificationCode: String,
    phoneVerificationExpiry: Date,
    passwordResetToken: String,
    passwordResetExpiry: Date,

    // Security
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: String,
    lastLogin: Date,
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockedUntil: Date,

    // KYC Information
    kycStatus: {
        type: String,
        enum: ['pending', 'submitted', 'verified', 'rejected'],
        default: 'pending'
    },
    kycLevel: {
        type: Number,
        enum: [0, 1, 2, 3],
        default: 0
    },
    kycDocuments: [{
        type: {
            type: String,
            enum: ['passport', 'national_id', 'drivers_license', 'utility_bill']
        },
        documentNumber: String,
        imageUrl: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending'
        }
    }],

    // Profile
    profileImage: String,
    preferredLanguage: {
        type: String,
        default: 'en'
    },
    timezone: String,
    currency: {
        type: String,
        default: 'NGN'
    },

    // Wallet
    walletBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    walletCurrency: {
        type: String,
        default: 'NGN'
    },

    // Transaction Limits (based on KYC level)
    limits: {
        dailyTransfer: {
            type: Number,
            default: 50000 // NGN
        },
        monthlyTransfer: {
            type: Number,
            default: 500000 // NGN
        },
        singleTransaction: {
            type: Number,
            default: 100000 // NGN
        }
    },

    // Referral
    referralCode: {
        type: String,
        unique: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Status and Flags
    status: {
        type: String,
        enum: ['active', 'suspended', 'blocked', 'deleted'],
        default: 'active'
    },
    isOnline: {
        type: Boolean,
        default: false
    },

    // Notifications
    notificationSettings: {
        email: {
            transactions: { type: Boolean, default: true },
            promotions: { type: Boolean, default: true },
            security: { type: Boolean, default: true }
        },
        sms: {
            transactions: { type: Boolean, default: true },
            security: { type: Boolean, default: true }
        },
        push: {
            transactions: { type: Boolean, default: true },
            promotions: { type: Boolean, default: false }
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ status: 1 });
userSchema.index({ kycStatus: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
    return !!(this.lockedUntil && this.lockedUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate referral code
userSchema.methods.generateReferralCode = function() {
    const { v4: uuidv4 } = require('uuid');
    this.referralCode = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return this.referralCode;
};

// Method to increment failed login attempts
userSchema.methods.incLoginAttempts = function() {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockedUntil && this.lockedUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockedUntil: 1 }
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // If we have reached max attempts and it's not locked already, lock the account
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = { lockedUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
    }

    return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $unset: { loginAttempts: 1, lockedUntil: 1 }
    });
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.twoFactorSecret;
    delete userObject.emailVerificationToken;
    delete userObject.phoneVerificationCode;
    delete userObject.passwordResetToken;
    return userObject;
};

module.exports = mongoose.model('User', userSchema);