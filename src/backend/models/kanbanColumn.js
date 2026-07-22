const mongoose = require('mongoose');

const KanbanColumnSchema = new mongoose.Schema({
    guild_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guild',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    order: {
        type: Number,
        required: true
    },
    color: {
        type: String,
        default: '#2c3e50'
    },
    // Mapeia a coluna para o status canônico da Quest (backwards compatibility)
    status_map: {
        type: String,
        enum: ['todo', 'in_progress', 'done'],
        required: true
    }
}, { timestamps: true });

KanbanColumnSchema.index({ guild_id: 1, order: 1 });

module.exports = mongoose.model('KanbanColumn', KanbanColumnSchema);
