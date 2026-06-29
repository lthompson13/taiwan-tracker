require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { clerkMiddleware } = require('@clerk/express');
const { initDb } = require('./lib/db');
const { startScheduler, getStatus: getSchedulerStatus } = require('./lib/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Stripe webhook needs the raw body for signature verification — must be
// registered BEFORE express.json() parses the body.
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', scheduler: getSchedulerStatus() });
});

// Translation status — frontend uses this to decide whether to show a
// "translation disabled / impaired" banner. See FEATURES.md 1.2.
const { getStatus: getTranslationStatus } = require('./lib/translate');
app.get('/api/translation-status', (req, res) => {
  res.json(getTranslationStatus());
});

app.use('/api/legislators', require('./routes/legislators'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/committees', require('./routes/committees'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/archive', require('./routes/archive'));
app.use('/api/user/tags', require('./routes/user-tags'));
app.use('/api/user', require('./routes/user'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/meets',  require('./routes/meets'));
app.use('/api/news',       require('./routes/news'));
app.use('/api/editorial',  require('./routes/editorial'));

// Serve static files from the React client build
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// Catch-all: serve index.html for client-side routing (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Initialize database (runs migrations, verifies connection) then start server.
// initDb() is safe to call even when DATABASE_URL is absent.
initDb().then(() => {
  startScheduler();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});
