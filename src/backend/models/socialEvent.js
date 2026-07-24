const mongoose = require('mongoose');

const socialEventSchema = new mongoose.Schema({
    title:         { type: String, required: true, trim: true },
    description:   { type: String, default: '' },
    event_date:    { type: Date, required: true },
    display_until: { type: Date, default: null },
    faction:       { type: String, enum: ['Produto', 'Suporte', 'Customer Service'], default: null },
    created_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    is_active:     { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SocialEvent', socialEventSchema);
