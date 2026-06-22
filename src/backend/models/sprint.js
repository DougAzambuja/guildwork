const mongoose = require('mongoose');

const SprintSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true // QA Touch: Evita sprints salvas como " Sprint 1 " (com espaços)
    },
    is_active: { 
        type: Boolean, 
        default: true 
    },
    started_at: { 
        type: Date, 
        default: Date.now 
    },
    ended_at: { 
        type: Date, 
        default: null 
    }

}, { timestamps: true });

module.exports = mongoose.model('Sprint', SprintSchema);