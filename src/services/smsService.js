// services/smsService.js
const axios = require('axios');

class SMSService {
    constructor() {
        this.apiKey = process.env.TERMII_API_KEY;
        this.senderId = process.env.TERMII_SENDER_ID || 'Esend';
        this.baseURL = process.env.TERMII_BASE_URL || 'https://api.ng.termii.com';

        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async sendSMS({ to, message, type = 'plain' }) {
        try {
            const payload = {
                to: this.formatPhoneNumber(to),
                from: this.senderId,
                sms: message,
                type: type,
                api_key: this.apiKey,
                channel: 'dnd'
            };

            const response = await this.client.post('/api/sms/send', payload);

            console.log('SMS sent successfully:', response.data);
            return response.data;

        } catch (error) {
            console.error('SMS sending error:', error.response?.data || error.message);
            throw new Error(`Failed to send SMS: ${error.response?.data?.message || error.message}`);
        }
    }

    async sendOTP({ to, otp }) {
        try {
            const payload = {
                api_key: this.apiKey,
                message_type: 'NUMERIC',
                to: this.formatPhoneNumber(to),
                from: this.senderId,
                channel: 'dnd',
                pin_attempts: 10,
                pin_time_to_live: 5,
                pin_length: 6,
                pin_placeholder: '< 1234 >',
                message_text: `Your Esend verification code is < 1234 >. Valid for 5 minutes.`,
                pin_type: 'NUMERIC'
            };

            const response = await this.client.post('/api/sms/otp/send', payload);

            console.log('OTP sent successfully:', response.data);
            return response.data;

        } catch (error) {
            console.error('OTP sending error:', error.response?.data || error.message);
            throw new Error(`Failed to send OTP: ${error.response?.data?.message || error.message}`);
        }
    }

    async verifyOTP({ pinId, pin }) {
        try {
            const payload = {
                api_key: this.apiKey,
                pin_id: pinId,
                pin: pin
            };

            const response = await this.client.post('/api/sms/otp/verify', payload);

            console.log('OTP verified:', response.data);
            return response.data;

        } catch (error) {
            console.error('OTP verification error:', error.response?.data || error.message);
            throw new Error(`Failed to verify OTP: ${error.response?.data?.message || error.message}`);
        }
    }

    formatPhoneNumber(phoneNumber) {
        // Remove any non-digit characters
        let cleaned = phoneNumber.replace(/\D/g, '');

        // Add country code if missing (assuming Nigeria as default)
        if (!cleaned.startsWith('234') && cleaned.startsWith('0')) {
            cleaned = '234' + cleaned.substring(1);
        } else if (!cleaned.startsWith('234') && !cleaned.startsWith('+')) {
            cleaned = '234' + cleaned;
        }

        return cleaned;
    }
}

const smsService = new SMSService();

module.exports = {
    sendSMS: smsService.sendSMS.bind(smsService),
    sendOTP: smsService.sendOTP.bind(smsService),
    verifyOTP: smsService.verifyOTP.bind(smsService),
    SMSService
};