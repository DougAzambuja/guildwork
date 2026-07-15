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
    quests_completed: { type: Number,  default: 0 },

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