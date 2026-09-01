require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');

const { apiLimiter } = require('./middleware/rateLimit.middleware');
const pool = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(apiLimiter);

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/farmer', require('./routes/farmer.routes'));
app.use('/api/buyer', require('./routes/buyer.routes'));
app.use('/api/officer', require('./routes/officer.routes'));
app.use('/api/fpo', require('./routes/fpo.routes'));
app.use('/api/logistics', require('./routes/logistics.routes'));

const priceService = require('./services/price.service');

app.get('/api/prices', async (req, res) => {
    try {
        const prices = await priceService.getPrices(req.query);
        res.json({ success: true, data: prices });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/crops', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT commodity FROM mandi_prices ORDER BY commodity
        `);
        const mspResult = await pool.query(`
            SELECT commodity, MAX(msp_quintal) as msp FROM mandi_prices WHERE msp_quintal > 0 GROUP BY commodity
        `);
        res.json({ success: true, data: { crops: result.rows.map(r => r.commodity), mspRates: mspResult.rows } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/mandis', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT mandi_name, state FROM mandi_prices ORDER BY mandi_name
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`KISAN MITRA API running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
});

module.exports = { app, server, io };
