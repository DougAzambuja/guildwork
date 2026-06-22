const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true // QA Touch: Impede a criação de quests contendo apenas "espaços em branco"
    },
    type: {
        type: String,
        enum: ['normal', 'urgent', 'support', 'jira'],
        default: 'normal'
    },
    xp_reward: { 
        type: Number, 
        required: true,
        min: 0 // Impede que uma quest tire XP do jogador por engano na criação
    },
    coin_reward: { 
        type: Number, 
        required: true,
        min: 0 
    },
    sla_seconds: { 
        type: Number, 
        default: null 
    }, // null = missão pacífica sem SLA
    is_active: { 
        type: Boolean, 
        default: true 
    }, // Mantemos o soft delete aqui para manter o histórico da Sprint
    sprint_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Sprint' 
    }

}, { timestamps: true });

module.exports = mongoose.model('Quest', QuestSchema);