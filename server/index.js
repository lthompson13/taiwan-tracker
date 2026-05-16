require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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
app.use('/api/interpellations', require('./routes/interpellations'));

// Serve static files from the React client build
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// Catch-all: serve index.html for client-side routing (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
