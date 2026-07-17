const mongoose = require('mongoose');

const QuestCompletionSchema = new mongoose.Schema({
    user_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    quest_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Quest', 
        required: true 
    },
    xp_gained: { 
        type: Number, 
        required: true,
        min: 0 
    },
    coins_gained: { 
        type: Number, 
        required: true,
        min: 0 
    },
    csat_score: {
        type: Number,
        default: null,
        validate: {
            validator: function(v) { return v === null || (v >= 1 && v <= 5); },
            message: 'Nota CSAT deve ser entre 1 e 5.'
        }
    },
    was_cursed: {
        type: Boolean,
        default: false
    },
    completed_at: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true }); // O timestamps já cria o createdAt, mas manter o completed_at é ótimo para clareza na leitura!

module.exports = mongoose.model('QuestCompletion', QuestCompletionSchema);