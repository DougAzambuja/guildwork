const mongoose = require('mongoose');
const { Schema } = mongoose;

const RandomEncounterSchema = new Schema({
    template_id:      { type: Schema.Types.ObjectId, ref: 'EventTemplate', default: null },
    title:            { type: String, required: true },
    description:      { type: String, default: '' },
    type:             { type: String, enum: ['global', 'faction'], default: 'global' },
    affected_faction: { type: String, default: null },
    effect: {
        kind: {
            type:     String,
            enum:     ['xp_penalty', 'gold_penalty', 'xp_bonus', 'gold_bonus', 'slow', 'luck', 'store_discount'],
            required: true,
        },
        value:          { type: Number, required: true },
        duration_hours: { type: Number, required: true, min: 0 },
    },
    active:       { type: Boolean, default: true },
    triggered_by: { type: Schema.Types.ObjectId, ref: 'User' },
    start_at:     { type: Date, default: null },
    active_until: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('RandomEncounter', RandomEncounterSchema);
