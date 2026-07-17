const User = require('../models/user');

/**
 * GET /api/admin/roster — Lista todos os usuários (sem senha).
 */
exports.getRoster = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: 1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar roster.', error: err.message });
    }
};

/**
 * PATCH /api/admin/roster/:id — Admin edita dados de um funcionário.
 * Permite alterar: nome, faction, role e senha (com hash via pre-save hook).
 */
exports.updateUser = async (req, res) => {
    try {
        const { nome, faction, role, password } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

        if (nome)    user.nome    = nome;
        if (faction) user.faction = faction;
        if (role)    user.role    = role;
        if (password && password.trim().length >= 6) {
            user.password = password; // pre-save hook aplica o hash
        }

        await user.save();
        const updated = user.toObject();
        delete updated.password;
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao editar usuário.', error: err.message });
    }
};
