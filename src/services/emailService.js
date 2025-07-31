// services/emailService.js
const mailjet = require('node-mailjet');

class EmailService {
    constructor() {
        this.client = mailjet.apiConnect(
            process.env.MAILJET_API_KEY,
            process.env.MAILJET_SECRET_KEY
        );
        this.fromEmail = process.env.MAILJET_FROM_EMAIL;
        this.fromName = process.env.MAILJET_FROM_NAME;
    }

    async sendEmail({ to, subject, template, data, html, text }) {
        try {
            let emailContent = {};

            if (html) {
                emailContent.HTMLPart = html;
            } else if (text) {
                emailContent.TextPart = text;
            } else if (template) {
                // Use predefined templates
                emailContent = this.getTemplate(template, data);
            }

            const request = this.client
                .post('send', { version: 'v3.1' })
                .request({
                    Messages: [
                        {
                            From: {
                                Email: this.fromEmail,
                                Name: this.fromName
                            },
                            To: [
                                {
                                    Email: to,
                                    Name: data?.recipientName || ''
                                }
                            ],
                            Subject: subject,
                            ...emailContent
                        }
                    ]
                });

            const result = await request;
            console.log('Email sent successfully:', result.body);
            return result.body;

        } catch (error) {
            console.error('Email sending error:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    getTemplate(templateName, data) {
        const templates = {
            welcome: {
                HTMLPart: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">Welcome to WestCash Global!</h2>
            <p>Hello ${data.firstName},</p>
            <p>Thank you for joining WestCash Global. Your account has been created successfully.</p>
            <p>To get started, please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.verificationUrl}" 
                 style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Best regards,<br>The WestCash Global Team</p>
          </div>
        `,
                TextPart: `Welcome to WestCash Global! Hello ${data.firstName}, thank you for joining us. Please verify your email: ${data.verificationUrl}`
            },

            transfer_notification: {
                HTMLPart: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">Money Transfer Notification</h2>
            <p>Hello ${data.recipientName},</p>
            <p>You have received a money transfer:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Amount:</strong> ${data.amount} ${data.currency}</p>
              <p><strong>From:</strong> ${data.senderName}</p>
              <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
            </div>
            <p>The money will be credited to your account within 1-3 business days.</p>
            <p>Best regards,<br>The WestCash Global Team</p>
          </div>
        `,
                TextPart: `You received ${data.amount} ${data.currency} from ${data.senderName}. Transaction ID: ${data.transactionId}`
            },

            westcash_received: {
                HTMLPart: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">Money Received!</h2>
            <p>Hello ${data.recipientName},</p>
            <p>Great news! You've received money in your WestCash wallet:</p>
            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Amount:</strong> ${data.amount} ${data.currency}</p>
              <p><strong>From:</strong> ${data.senderName}</p>
              <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
            </div>
            <p>The money is now available in your wallet and ready to use!</p>
            <p>Best regards,<br>The WestCash Global Team</p>
          </div>
        `,
                TextPart: `You received ${data.amount} ${data.currency} from ${data.senderName} in your WestCash wallet. Transaction ID: ${data.transactionId}`
            },

            password_reset: {
                HTMLPart: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">Password Reset Request</h2>
            <p>Hello ${data.firstName},</p>
            <p>You requested to reset your password. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.resetUrl}" 
                 style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>The WestCash Global Team</p>
          </div>
        `,
                TextPart: `Password reset requested. Use this link: ${data.resetUrl}`
            }
        };

        return templates[templateName] || {
            TextPart: 'Default email content',
            HTMLPart: '<p>Default email content</p>'
        };
    }
}

const emailService = new EmailService();

module.exports = {
    sendEmail: emailService.sendEmail.bind(emailService),
    EmailService
};
