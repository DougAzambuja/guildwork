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
        min: 1, // QA Touch: Validação estrita do Back-end
        max: 5  // Garante que a nota nunca fuja da métrica real (1 a 5 estrelas)
    },
    completed_at: { 
        type: Date, 
        default: Date.now 
    }

}, { timestamps: true }); // O timestamps já cria o createdAt, mas manter o completed_at é ótimo para clareza na leitura!

module.exports = mongoose.model('QuestCompletion', QuestCompletionSchema);