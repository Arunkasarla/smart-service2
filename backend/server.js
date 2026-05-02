require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');

const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const chatRoutes = require('./routes/chatRoutes');
const locationRoutes = require('./routes/locationRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const warrantyRoutes = require('./routes/warrantyRoutes');
const initSocket = require('./socket');
const db = require('./database');

const app = express();
const server = http.createServer(app);

// Continuous Server DB Dump Logging for Debugging
setInterval(() => {
    db.all("SELECT * FROM bookings", [], (err, bookings) => {
        db.all("SELECT * FROM users", [], (err, users) => {
             db.all("SELECT * FROM services", [], (err, services) => {
                 fs.writeFileSync('db_dump.json', JSON.stringify({bookings, users, services}, null, 2));
             });
        });
    });
}, 5000);

// Initialize WebSockets
const io = initSocket(server);
app.set('io', io);

// Make io accessible in routes via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

const PORT = process.env.PORT || 5000;

// ─── CORS Configuration ───────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',                   // Vite dev server
  'http://localhost:3000',                   // Alternative dev port
  'https://smart-service2.vercel.app',       // Production Vercel URL
  'https://smart-service2.onrender.com',     // Render backend (internal)
];

// Allow all Vercel preview deployments dynamically
const allowedOriginPattern = /^https:\/\/smart-service2(-[a-z0-9]+)?\.vercel\.app$/;

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);

    const isAllowed =
      allowedOrigins.includes(origin) ||
      allowedOriginPattern.test(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn('CORS BLOCKED - Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// ─── Middleware Order: cors → json → routes ───────────────────────────────────

// 1. Handle CORS preflight (OPTIONS) for ALL routes FIRST
app.options('*', cors(corsOptions));

// 2. Apply CORS headers to all responses
app.use(cors(corsOptions));

// 3. Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 4. Static uploads
app.use('/uploads', express.static('uploads'));

// 5. Health check - wake up Render's free tier cold start
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/warranty', warrantyRoutes);
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/provider', require('./routes/providerRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS error: Origin not allowed' });
  }
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`HTTP and WebSocket Server running on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
