const mongoose = require('mongoose');

const LootItemSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    price:      { type: Number, required: true },
    image_url:  { type: String, required: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    is_active:  { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model('LootItem', LootItemSchema);