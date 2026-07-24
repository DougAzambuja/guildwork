require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

app.use(cors({
    origin:         '*',
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

if (process.env.NODE_ENV !== 'test') {
    app.use(require('./middleware/requestLogger'));
}

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/players',       require('./routes/players'));
app.use('/api/quests',        require('./routes/quests'));
app.use('/api/loot',          require('./routes/loot'));
app.use('/api/sprints',       require('./routes/sprint'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/metrics',       require('./routes/metrics'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/guild',         require('./routes/guild'));
app.use('/api/encounters',     require('./routes/encounters'));
app.use('/api/event-templates', require('./routes/eventTemplates'));

app.get('/', (_req, res) => res.json({ status: 'online', message: 'GuildWork API', version: '1.0.0' }));

app.use(require('./middleware/errorHandler'));

module.exports = app;
