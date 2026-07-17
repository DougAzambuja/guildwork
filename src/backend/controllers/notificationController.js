const Notification = require('../models/notification');

// GET /api/notifications
// Últimas 50 notificações do usuário autenticado + contagem de não lidas
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user_id: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const unread_count = notifications.filter(n => !n.read).length;
        res.json({ notifications, unread_count });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar notificações.', error: err.message });
    }
};

// PATCH /api/notifications/read-all
// Marca todas as notificações do usuário como lidas
exports.markAllRead = async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { user_id: req.user.id, read: false },
            { read: true }
        );
        res.json({ message: 'Todas as notificações marcadas como lidas.', updated: result.modifiedCount });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao marcar notificações.', error: err.message });
    }
};

// PATCH /api/notifications/:id/read
// Marca uma notificação específica como lida (pertencente ao usuário autenticado)
exports.markRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user.id },
            { read: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ message: 'Notificação não encontrada.' });
        res.json(notification);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao marcar notificação.', error: err.message });
    }
};
