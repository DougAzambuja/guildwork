const mongoose = require('mongoose');

const SprintSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    is_active:  { type: Boolean, default: true },
    started_at: { type: Date, default: Date.now },
    ended_at:   { type: Date, default: null }

}, { timestamps: true });

module.exports = mongoose.model('Sprint', SprintSchema);