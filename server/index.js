require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/legislators', require('./routes/legislators'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/committees', require('./routes/committees'));
app.use('/api/interpellations', require('./routes/interpellations'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
