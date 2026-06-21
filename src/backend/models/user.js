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
        enum: ['admin', 'adventurer'],
        default: 'adventurer'
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
        enum: ['QA', 'Dev', 'Suporte', 'Marketing'],
        default: 'QA'
    },
    // Dados de gamificação
    xp:       { type: Number, default: 0 },
    coins:    { type: Number, default: 100 },
    level:    { type: Number, default: 1 },
    is_cursed:{ type: Boolean, default: false },

}, { timestamps: true });

// Criptografa a senha antes de salvar
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Método para comparar senha no login
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);