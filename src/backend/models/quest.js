const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['normal', 'urgent', 'support', 'jira'],
        default: 'normal'
    },
    xp_reward:   { type: Number, required: true },
    coin_reward: { type: Number, required: true },
    sla_seconds: { type: Number, default: null }, // null = sem SLA
    is_active:   { type: Boolean, default: true },
    sprint_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint' }

}, { timestamps: true });

module.exports = mongoose.model('Quest', QuestSchema);