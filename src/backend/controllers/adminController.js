const User  = require('../models/user');
const Guild = require('../models/guild');

/**
 * GET /api/admin/roster — Lista todos os usuários (sem senha) + flag is_guild_leader.
 */
exports.getRoster = async (req, res) => {
    try {
        const [users, guilds] = await Promise.all([
            User.find().select('-password').sort({ createdAt: 1 }),
            Guild.find().select('leader_id').lean()
        ]);

        const leaderIds = new Set(
            guilds.map(g => g.leader_id?.toString()).filter(Boolean)
        );

        const result = users.map(u => {
            const obj = u.toObject();
            obj.is_guild_leader = leaderIds.has(u._id.toString());
            return obj;
        });

        res.json(result);
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
        const { nome, faction, role, password, force_password_change } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

        if (nome)    user.nome    = nome;
        if (faction) user.faction = faction;
        if (role)    user.role    = role;
        if (typeof force_password_change === 'boolean') user.force_password_change = force_password_change;
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
