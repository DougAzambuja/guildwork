const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'funcionario'],
        default: 'funcionario'
    },
    nome: {
        type: String,
        required: true
    },
    avatar_url: {
        type: String,
        default: 'assets/imgs/caneca_pixel.jpg'
    },
    faction: {
        type: String,
        enum: ['Produto', 'Suporte', 'Customer Service'],
        default: 'Produto'
    },
    // Dados de gamificação
    xp:       { type: Number, default: 0 },
    coins:    { type: Number, default: 100 },
    level:    { type: Number, default: 1 },
    is_cursed:        { type: Boolean, default: false },
    curse_type:       { type: String, enum: ['sla_breach', 'abandoned', 'csat_low'], default: null },
    quests_completed:      { type: Number,  default: 0 },

    // Buff temporário via streak de CSAT
    csat_streak:           { type: Number, default: 0 },
    buff_type:             { type: String, enum: ['xp_double_activity', 'xp_double_time'], default: null },
    buff_expires_at:       { type: Date,   default: null },
    buff_quests_remaining: { type: Number, default: null },

}, { timestamps: true });

// Criptografa a senha antes de salvar
UserSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// Método para comparar senha no login
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);