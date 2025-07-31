// controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { sendSMS } = require('../services/smsService');

class AuthController {
    // Helper function to generate JWT token
    generateToken(userId) {
        return jwt.sign({ userId }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRE || '7d'
        });
    }

    // Helper function to generate OTP
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // @desc    Register a new user
    async register(req, res) {
        try {
            const {
                firstName,
                lastName,
                email,
                phoneNumber,
                password,
                dateOfBirth,
                country,
                referralCode
            } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [{ email }, { phoneNumber }]
            });

            if (existingUser) {
                return res.status(400).json({
                    status: 'error',
                    message: 'User already exists with this email or phone number'
                });
            }

            // Validate referral code if provided
            let referrer = null;
            if (referralCode) {
                referrer = await User.findOne({ referralCode });
                if (!referrer) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid referral code'
                    });
                }
            }

            // Create new user
            const user = new User({
                firstName,
                lastName,
                email,
                phoneNumber,
                password,
                dateOfBirth,
                'address.country': country,
                referredBy: referrer?._id
            });

            // Generate referral code for new user
            user.generateReferralCode();

            // Generate phone verification OTP
            const phoneOTP = this.generateOTP();
            user.phoneVerificationCode = phoneOTP;
            user.phoneVerificationExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

            await user.save();

            // Send welcome email
            await sendEmail({
                to: email,
                subject: 'Welcome to WestCash Global',
                template: 'welcome',
                data: {
                    firstName,
                    verificationUrl: `${process.env.FRONTEND_URL}/verify-email/${user.emailVerificationToken}`
                }
            });

            // Send phone verification SMS
            await sendSMS({
                to: phoneNumber,
                message: `Your WestCash verification code is: ${phoneOTP}. Valid for 5 minutes.`
            });

            // Generate token
            const token = this.generateToken(user._id);

            res.status(201).json({
                status: 'success',
                message: 'User registered successfully. Please verify your phone number.',
                data: {
                    user: {
                        id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        phoneNumber: user.phoneNumber,
                        isEmailVerified: user.isEmailVerified,
                        isPhoneVerified: user.isPhoneVerified,
                        referralCode: user.referralCode
                    },
                    token
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Registration failed. Please try again.'
            });
        }
    }

    // @desc    Login user
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Find user and include password for comparison
            const user = await User.findOne({ email }).select('+password');
            if (!user) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid email or password'
                });
            }

            // Check if account is locked
            if (user.isLocked) {
                return res.status(423).json({
                    status: 'error',
                    message: 'Account temporarily locked due to too many failed login attempts'
                });
            }

            // Check if account is active
            if (user.status !== 'active') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Account is not active. Please contact support.'
                });
            }

            // Compare password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                await user.incLoginAttempts();
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid email or password'
                });
            }

            // Reset login attempts on successful login
            await user.resetLoginAttempts();

            // Update last login
            user.lastLogin = new Date();
            user.isOnline = true;
            await user.save();

            // Generate token
            const token = this.generateToken(user._id);

            res.json({
                status: 'success',
                message: 'Login successful',
                data: {
                    user: {
                        id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        phoneNumber: user.phoneNumber,
                        isEmailVerified: user.isEmailVerified,
                        isPhoneVerified: user.isPhoneVerified,
                        kycStatus: user.kycStatus,
                        walletBalance: user.walletBalance,
                        currency: user.currency
                    },
                    token
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Login failed. Please try again.'
            });
        }
    }

    // @desc    Verify phone number with OTP
    async verifyPhone(req, res) {
        try {
            const { phoneNumber, otp } = req.body;
            const user = await User.findById(req.user.userId);

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            if (user.phoneNumber !== phoneNumber) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Phone number mismatch'
                });
            }

            if (user.isPhoneVerified) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Phone number already verified'
                });
            }

            if (!user.phoneVerificationCode || user.phoneVerificationExpiry < new Date()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'OTP expired or invalid'
                });
            }

            if (user.phoneVerificationCode !== otp) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid OTP'
                });
            }

            // Mark phone as verified
            user.isPhoneVerified = true;
            user.phoneVerificationCode = undefined;
            user.phoneVerificationExpiry = undefined;
            await user.save();

            res.json({
                status: 'success',
                message: 'Phone number verified successfully'
            });

        } catch (error) {
            console.error('Phone verification error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Phone verification failed. Please try again.'
            });
        }
    }

    // @desc    Resend phone verification OTP
    async resendOTP(req, res) {
        try {
            const user = await User.findById(req.user.userId);

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            if (user.isPhoneVerified) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Phone number already verified'
                });
            }

            // Generate new OTP
            const phoneOTP = this.generateOTP();
            user.phoneVerificationCode = phoneOTP;
            user.phoneVerificationExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
            await user.save();

            // Send SMS
            await sendSMS({
                to: user.phoneNumber,
                message: `Your WestCash verification code is: ${phoneOTP}. Valid for 5 minutes.`
            });

            res.json({
                status: 'success',
                message: 'OTP sent successfully'
            });

        } catch (error) {
            console.error('Resend OTP error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to resend OTP. Please try again.'
            });
        }
    }

    // @desc    Send password reset email
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const user = await User.findOne({ email });

            if (!user) {
                // Don't reveal if email exists or not
                return res.json({
                    status: 'success',
                    message: 'If email exists, password reset instructions have been sent'
                });
            }

            // Generate reset token
            const resetToken = jwt.sign(
                { userId: user._id, purpose: 'password_reset' },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            user.passwordResetToken = resetToken;
            user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            await user.save();

            // Send password reset email
            await sendEmail({
                to: email,
                subject: 'Password Reset - WestCash Global',
                template: 'password_reset',
                data: {
                    firstName: user.firstName,
                    resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
                }
            });

            res.json({
                status: 'success',
                message: 'Password reset instructions sent to your email'
            });

        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to process request. Please try again.'
            });
        }
    }

    // @desc    Reset password with token
    async resetPassword(req, res) {
        try {
            const { token, password } = req.body;

            // Verify token
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (err) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid or expired reset token'
                });
            }

            if (decoded.purpose !== 'password_reset') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid token purpose'
                });
            }

            const user = await User.findById(decoded.userId);
            if (!user || user.passwordResetToken !== token || user.passwordResetExpiry < new Date()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid or expired reset token'
                });
            }

            // Update password
            user.password = password;
            user.passwordResetToken = undefined;
            user.passwordResetExpiry = undefined;
            await user.save();

            res.json({
                status: 'success',
                message: 'Password reset successfully'
            });

        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to reset password. Please try again.'
            });
        }
    }

    // @desc    Logout user
    async logout(req, res) {
        try {
            const user = await User.findById(req.user.userId);
            if (user) {
                user.isOnline = false;
                await user.save();
            }

            res.json({
                status: 'success',
                message: 'Logged out successfully'
            });

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Logout failed'
            });
        }
    }

    // @desc    Get current user
    async getMe(req, res) {
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
                    user
                }
            });

        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to get user data'
            });
        }
    }
}

module.exports = new AuthController();