const mongoose = require('mongoose');

const GuildSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    faction_key: {
        type: String,
        enum: ['Produto', 'Suporte', 'Customer Service'],
        required: true,
        unique: true
    },
    icon: {
        type: String,
        default: '⚔️'
    },
    treasury_balance: {
        type: Number,
        default: 0,
        min: 0
    },
    tax_rate: {
        type: Number,
        default: 0.10,  // 10% do gold de cada quest vai pro tesouro comum
        min: 0,
        max: 1
    },
    leader_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Guild', GuildSchema);
