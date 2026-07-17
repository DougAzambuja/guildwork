require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');


const app = express();

// ==========================================
// MIDDLEWARES GLOBAIS
// ==========================================
// O CORS permite que o frontend (porta 5500) se comunique com o backend (porta 3001)
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ==========================================
// CONEXÃO COM MONGODB
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB conectado com sucesso!'))
    .catch((err) => console.error('❌ Erro ao conectar MongoDB:', err));

// ==========================================
// ROTAS
// ==========================================
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/quests',  require('./routes/quests'));
app.use('/api/loot',    require('./routes/loot'));
app.use('/api/sprints', require('./routes/sprint'));
app.use('/api/admin',   require('./routes/admin'));

// ==========================================
// ROTA DE HEALTH CHECK
// ==========================================
app.get('/', (req, res) => {
    res.json({ 
        status: 'online',
        message: 'GuildWork API rodando!',
        version: '1.0.0'
    });
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});