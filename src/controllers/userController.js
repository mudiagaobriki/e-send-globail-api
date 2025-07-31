// controllers/userController.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

class UserController {
    // @desc    Get user profile
    async getProfile(req, res) {
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
                data: { user }
            });

        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch profile'
            });
        }
    }

    // @desc    Update user profile
    async updateProfile(req, res) {
        try {
            const userId = req.user.userId;
            const updateData = req.body;

            // Remove sensitive fields that shouldn't be updated via this endpoint
            delete updateData.password;
            delete updateData.email;
            delete updateData.walletBalance;
            delete updateData.kycStatus;

            const user = await User.findByIdAndUpdate(
                userId,
                updateData,
                { new: true, runValidators: true }
            );

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            res.json({
                status: 'success',
                message: 'Profile updated successfully',
                data: { user }
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to update profile'
            });
        }
    }

    // @desc    Upload KYC documents
    async uploadKycDocuments(req, res) {
        try {
            const userId = req.user.userId;
            const { documentType, documentNumber } = req.body;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            // Handle file upload to Cloudinary
            if (!req.file) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Document image is required'
                });
            }

            // Upload to Cloudinary
            const uploadResult = await cloudinary.uploader.upload(req.file.path, {
                folder: `westcash/kyc/${userId}`,
                resource_type: 'image',
                transformation: [
                    { quality: 'auto' },
                    { fetch_format: 'auto' }
                ]
            });

            // Add document to user's KYC documents
            const kycDocument = {
                type: documentType,
                documentNumber,
                imageUrl: uploadResult.secure_url,
                uploadedAt: new Date(),
                status: 'pending'
            };

            user.kycDocuments.push(kycDocument);
            user.kycStatus = 'submitted';
            await user.save();

            res.json({
                status: 'success',
                message: 'KYC document uploaded successfully',
                data: {
                    document: kycDocument
                }
            });

        } catch (error) {
            console.error('Upload KYC error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to upload KYC document'
            });
        }
    }

    // @desc    Get user referrals
    async getReferrals(req, res) {
        try {
            const userId = req.user.userId;

            const referrals = await User.find({ referredBy: userId })
                .select('firstName lastName email createdAt status')
                .sort({ createdAt: -1 });

            res.json({
                status: 'success',
                data: {
                    referrals,
                    totalReferrals: referrals.length
                }
            });

        } catch (error) {
            console.error('Get referrals error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch referrals'
            });
        }
    }
}

module.exports = new UserController();