const mongoose = require('mongoose');

const QuestCompletionSchema = new mongoose.Schema({
    user_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quest_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Quest', required: true },
    xp_gained:   { type: Number, required: true },
    coins_gained:{ type: Number, required: true },
    csat_score:  { type: Number, default: null }, // só para quests de suporte
    completed_at:{ type: Date, default: Date.now }

}, { timestamps: true });

module.exports = mongoose.model('QuestCompletion', QuestCompletionSchema);