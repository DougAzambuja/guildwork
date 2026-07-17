const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    user_id: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'User',
        required: true,
        index:    true
    },
    type: {
        type: String,
        enum: ['quest_assigned', 'level_up', 'sla_warning', 'achievement', 'admin_alert'],
        required: true
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    read:    { type: Boolean, default: false },
    meta:    { type: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true });

NotificationSchema.index({ user_id: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
