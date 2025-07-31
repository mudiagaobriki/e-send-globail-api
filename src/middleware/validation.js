// middleware/validation.js
const Joi = require('joi');

const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                status: 'error',
                message: error.details[0].message,
                errors: error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }))
            });
        }
        next();
    };
};

// Common validation schemas
const schemas = {
    // User registration schema
    register: Joi.object({
        firstName: Joi.string().min(2).max(50).required(),
        lastName: Joi.string().min(2).max(50).required(),
        email: Joi.string().email().required(),
        phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
        password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
        dateOfBirth: Joi.date().max('now').required(),
        country: Joi.string().length(2).required(),
        referralCode: Joi.string().optional()
    }),

    // User login schema
    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    // OTP verification schema
    verifyOTP: Joi.object({
        phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
        otp: Joi.string().length(6).required()
    }),

    // Forgot password schema
    forgotPassword: Joi.object({
        email: Joi.string().email().required()
    }),

    // Reset password schema
    resetPassword: Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
    }),

    // Bank transfer schema
    bankTransfer: Joi.object({
        recipientName: Joi.string().min(2).max(100).required(),
        recipientEmail: Joi.string().email().optional(),
        recipientPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
        recipientCountry: Joi.string().length(2).required(),
        bankCode: Joi.string().required(),
        accountNumber: Joi.string().required(),
        amount: Joi.number().min(1).max(1000000).required(),
        currency: Joi.string().length(3).default('NGN'),
        description: Joi.string().max(200).optional(),
        purpose: Joi.string().valid('family_support', 'education', 'business', 'medical', 'gift', 'investment', 'other').default('other')
    }),

    // WestCash transfer schema
    westcashTransfer: Joi.object({
        recipientIdentifier: Joi.string().required(), // email, phone, or username
        amount: Joi.number().min(1).max(1000000).required(),
        currency: Joi.string().length(3).default('NGN'),
        description: Joi.string().max(200).optional(),
        purpose: Joi.string().valid('family_support', 'education', 'business', 'medical', 'gift', 'investment', 'other').default('other')
    }),

    // Mobile money transfer schema
    mobileMoneyTransfer: Joi.object({
        recipientName: Joi.string().min(2).max(100).required(),
        recipientPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
        recipientCountry: Joi.string().length(2).required(),
        provider: Joi.string().required(), // MTN, Airtel, etc.
        amount: Joi.number().min(1).max(1000000).required(),
        currency: Joi.string().length(3).default('NGN'),
        description: Joi.string().max(200).optional(),
        purpose: Joi.string().valid('family_support', 'education', 'business', 'medical', 'gift', 'investment', 'other').default('other')
    }),

    // Wallet deposit schema
    walletDeposit: Joi.object({
        amount: Joi.number().min(100).max(1000000).required(),
        currency: Joi.string().length(3).default('NGN'),
        paymentMethod: Joi.string().valid('card', 'bank_transfer').required()
    }),

    // Wallet withdrawal schema
    walletWithdrawal: Joi.object({
        amount: Joi.number().min(100).max(1000000).required(),
        currency: Joi.string().length(3).default('NGN'),
        bankCode: Joi.string().required(),
        accountNumber: Joi.string().required(),
        accountName: Joi.string().required()
    }),

    // Update profile schema
    updateProfile: Joi.object({
        firstName: Joi.string().min(2).max(50).optional(),
        lastName: Joi.string().min(2).max(50).optional(),
        phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
        dateOfBirth: Joi.date().max('now').optional(),
        gender: Joi.string().valid('male', 'female', 'other').optional(),
        address: Joi.object({
            street: Joi.string().max(100).optional(),
            city: Joi.string().max(50).optional(),
            state: Joi.string().max(50).optional(),
            country: Joi.string().length(2).optional(),
            postalCode: Joi.string().max(20).optional()
        }).optional(),
        preferredLanguage: Joi.string().max(10).optional(),
        timezone: Joi.string().max(50).optional(),
        currency: Joi.string().length(3).optional()
    })
};

module.exports = {
    validate,
    schemas
};