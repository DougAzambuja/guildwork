const mongoose = require('mongoose');

const LootItemSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true 
    },
    price: { 
        type: Number, 
        required: true,
        min: 1 // Garante que nenhum item seja criado de graça ou com valor negativo
    },
    image: { 
        type: String, 
        default: 'assets/imgs/caneca_pixel.jpg' // Se o Admin esquecer a imagem, o banco assume esta por padrão
    },
    is_cosmetic: {
        type: Boolean,
        default: false
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('LootItem', LootItemSchema);