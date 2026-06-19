/**
 * Rocket Fuel — Server Entry Point
 *
 * Required Environment Variables:
 *   DATABASE_URL        — PostgreSQL connection string (Railway provides automatically)
 *   JWT_SECRET          — Random secret string for signing JWT tokens
 *   SENDGRID_API_KEY    — SendGrid API key for sending emails
 *   SENDGRID_FROM_EMAIL — Verified SendGrid sender email address
 *   PORT                — HTTP port (Railway provides automatically, defaults to 3001)
 *   UPLOAD_DIR          — (optional) Override upload path; defaults to /data/uploads
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { initDB } = require('./db');
const { UPLOAD_DIR } = require('./upload');

// Ensure upload directory exists at startup
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();

// CORS — only needed in dev since Vite proxy handles /api; in prod same origin
app.use(cors({
  origin: process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : false,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOAD_DIR));

// Health check (no auth required)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/distributions', require('./routes/distributions'));
app.use('/api/tracker', require('./routes/tracker'));

// Serve React build in production
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Rocket Fuel server running on port ${PORT}`);
      console.log(`   Upload directory: ${UPLOAD_DIR}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
