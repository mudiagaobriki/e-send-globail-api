// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const Sentry = require('@sentry/node');
require('dotenv').config();

// Import routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const walletRoutes = require('./src/routes/wallet');
const transferRoutes = require('./src/routes/transfer');
const transactionRoutes = require('./src/routes/transaction');
const exchangeRoutes = require('./src/routes/exchange');
const adminRoutes = require('./src/routes/admin');

// Import middleware
const authMiddleware = require('./src/middleware/auth');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Initialize Sentry
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
});

// Trust proxy
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});

// Middleware
app.use(Sentry.Handlers.requestHandler());
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));
app.use(limiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'WestCash Global API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// API documentation
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to WestCash Global API',
        version: '1.0.0',
        documentation: '/api/docs',
        endpoints: {
            auth: '/api/auth',
            user: '/api/user',
            wallet: '/api/wallet',
            transfer: '/api/transfer',
            transaction: '/api/transaction',
            exchange: '/api/exchange',
            admin: '/api/admin'
        }
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/wallet', authMiddleware, walletRoutes);
app.use('/api/transfer', authMiddleware, transferRoutes);
app.use('/api/transaction', authMiddleware, transactionRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/admin', adminRoutes);

// Sentry error handler
app.use(Sentry.Handlers.errorHandler());

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint not found'
    });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        Sentry.captureException(err);
    });

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`WestCash Global API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;