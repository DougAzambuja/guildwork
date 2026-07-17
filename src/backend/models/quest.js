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
    status: {
        type: String,
        enum: ['todo', 'in_progress', 'done'],
        default: 'todo'
    },
    assigned_to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    started_at: {
        type: Date,
        default: null
    },
    faction: {
        type: String,
        enum: ['Produto', 'Suporte', 'Customer Service'],
        default: 'Produto'
    },
    is_active: {
        type: Boolean,
        default: true
    },
    sprint_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sprint'
    },

    // Categorização e filtragem — ex: ['bug', 'ux', 'p1']
    labels: {
        type:    [String],
        default: []
    },

    // Subtasks — suporte a checklist interno (#16)
    checklist: [{
        text:       { type: String, required: true },
        done:       { type: Boolean, default: false },
        created_at: { type: Date,    default: Date.now }
    }],

    // Histórico de interações e atividade automática da missão
    comments: [{
        user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = entrada automática do sistema
        text:       { type: String, required: true, trim: true },
        type:       { type: String, enum: ['user', 'activity'], default: 'user' },
        created_at: { type: Date, default: Date.now }
    }],

    // Referências a outras quests vinculadas (relacionamento recursivo por referência)
    subtasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quest' }]

}, { timestamps: true });

// Índices compostos para as queries mais frequentes do sistema
QuestSchema.index({ sprint_id: 1, status: 1 });  // dashboard de sprint / burndown
QuestSchema.index({ faction: 1, status: 1 });     // kanban por facção
QuestSchema.index({ assigned_to: 1, status: 1 }); // quests do jogador
QuestSchema.index({ labels: 1 });                  // filtragem por label (multikey)

module.exports = mongoose.model('Quest', QuestSchema);