const mongoose = require('mongoose');

const SprintSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    goal: {
        type: String,
        trim: true,
        default: null
    },
    status: {
        type: String,
        enum: ['planning', 'active', 'completed', 'cancelled'],
        default: 'planning'
    },
    factions: [{
        type: String,
        enum: ['Produto', 'Suporte', 'Customer Service']
    }],
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    duration_days: {
        type: Number,
        required: true,
        min: 1
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }

}, { timestamps: true });

// Índice para listagem por status (dashboard sempre filtra sprints ativas)
SprintSchema.index({ status: 1, start_date: -1 });

module.exports = mongoose.model('Sprint', SprintSchema);
