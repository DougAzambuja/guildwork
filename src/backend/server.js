require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');


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
    .then(() => {
        console.log('✅ MongoDB conectado com sucesso!');
        startSlaJob();
    })
    .catch((err) => console.error('❌ Erro ao conectar MongoDB:', err));

// ==========================================
// ROTAS
// ==========================================
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/quests',  require('./routes/quests'));
app.use('/api/loot',    require('./routes/loot'));
app.use('/api/sprints', require('./routes/sprint'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/metrics',       require('./routes/metrics'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/guild',         require('./routes/guild'));

// ==========================================
// JOB DE BACKGROUND — SLA e alertas admin
// Roda a cada 2 minutos, só depois do DB conectar
// ==========================================
const Quest                   = require('./models/quest');
const User                    = require('./models/user');
const notificationService     = require('./services/notificationService');

async function runSlaCheck() {
    const now = Date.now();

    const slaQuests = await Quest.find({
        status:      'in_progress',
        sla_seconds: { $ne: null, $exists: true },
        started_at:  { $ne: null },
        assigned_to: { $ne: null }
    }).lean();

    for (const quest of slaQuests) {
        const elapsed = (now - new Date(quest.started_at).getTime()) / 1000;
        const pct     = elapsed / quest.sla_seconds;

        if (pct >= 0.8 && pct < 1.0) {
            // SLA quase estourando — notifica o aventureiro
            await notificationService.notifySlaWarning(quest, quest.assigned_to);
        } else if (pct >= 1.0) {
            // SLA já estourou — alerta todos os admins
            const admins = await User.find({ role: 'admin' }).select('_id').lean();
            for (const admin of admins) {
                await notificationService.notifyAdminAlert(admin._id, quest);
            }
        }
    }
}

function startSlaJob() {
    // Primeira execução após 1 min para o servidor estabilizar
    setTimeout(() => {
        runSlaCheck().catch(err => console.error('[SLA Job]', err.message));
        setInterval(() => {
            runSlaCheck().catch(err => console.error('[SLA Job]', err.message));
        }, 2 * 60 * 1000);
    }, 60 * 1000);
    console.log('⏰ Job de SLA agendado (a cada 2 min)');
}

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