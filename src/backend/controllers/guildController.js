const Guild = require('../models/guild');
const User  = require('../models/user');

// GET /api/guild — Dados da guilda do jogador logado + ranking de membros
exports.getGuild = async (req, res) => {
    try {
        const user  = await User.findById(req.user.id).select('faction');
        const guild = await Guild.findOne({ faction_key: user.faction })
            .populate('leader_id', 'nome username avatar_url');

        if (!guild) return res.status(404).json({ message: 'Guilda não encontrada para sua facção.' });

        const members = await User.find({ faction: user.faction })
            .select('nome username avatar_url xp coins level quests_completed is_cursed')
            .sort({ xp: -1 });

        const isLeader = guild.leader_id && guild.leader_id._id.toString() === req.user.id;

        res.json({ guild, members, isLeader });
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/guild/spend — Líder distribui gold do tesouro para um membro
exports.spendTreasury = async (req, res) => {
    try {
        const { amount, target_user_id } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Valor inválido.' });
        }

        const user  = await User.findById(req.user.id).select('faction');
        const guild = await Guild.findOne({ faction_key: user.faction });

        if (!guild) return res.status(404).json({ message: 'Guilda não encontrada.' });
        if (!guild.leader_id || guild.leader_id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Apenas o líder pode gastar o tesouro.' });
        }
        if (guild.treasury_balance < amount) {
            return res.status(400).json({ message: 'Saldo insuficiente no tesouro.' });
        }

        const target = await User.findById(target_user_id).select('nome faction');
        if (!target) return res.status(404).json({ message: 'Aventureiro não encontrado.' });
        if (target.faction !== user.faction) {
            return res.status(400).json({ message: 'Aventureiro não pertence à sua guilda.' });
        }

        guild.treasury_balance -= amount;
        await guild.save();

        await User.findByIdAndUpdate(target_user_id, { $inc: { coins: amount } });

        res.json({
            message: `${amount} Gold transferido para ${target.nome} com sucesso.`,
            treasury_balance: guild.treasury_balance
        });
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PATCH /api/guild/leader — Admin nomeia novo líder
exports.setLeader = async (req, res) => {
    try {
        const { user_id } = req.body;
        const target = await User.findById(user_id).select('faction');
        if (!target) return res.status(404).json({ message: 'Aventureiro não encontrado.' });

        const guild = await Guild.findOneAndUpdate(
            { faction_key: target.faction },
            { leader_id: user_id },
            { new: true }
        ).populate('leader_id', 'nome username');

        if (!guild) return res.status(404).json({ message: 'Guilda não encontrada.' });
        res.json(guild);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};
