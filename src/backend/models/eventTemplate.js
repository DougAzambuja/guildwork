const mongoose = require('mongoose');

const EventTemplateSchema = new mongoose.Schema({
    title:            { type: String, required: true, trim: true },
    description:      { type: String, default: '' },
    effect_kind:      {
        type: String,
        enum: ['xp_bonus', 'gold_bonus', 'xp_penalty', 'gold_penalty', 'slow', 'luck', 'store_discount'],
        required: true,
    },
    default_value:    { type: Number, required: true, min: 0, max: 1 }, // 0.5 = 50%
    default_duration: { type: Number, required: true, min: 1 },         // horas
    scope_type:       { type: String, enum: ['global', 'faction'], default: 'global' },
    created_by:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('EventTemplate', EventTemplateSchema);
