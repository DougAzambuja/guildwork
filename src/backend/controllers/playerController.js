const User            = require('../models/User');
const QuestCompletion = require('../models/QuestCompletion');

const MAX_XP = 10000;

// GET /api/players/me — retorna os dados do jogador logado
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PUT /api/players/me — atualiza perfil (nome, avatar)
exports.updateMe = async (req, res) => {
    try {
        const { nome, avatar_url } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { nome, avatar_url },
            { new: true }
        ).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/players/xp — adiciona XP e verifica level up
exports.addXP = async (req, res) => {
    try {
        const { xp } = req.body;
        const user = await User.findById(req.user.id);

        user.xp += xp;

        // Lógica de Level Up
        if (user.xp >= MAX_XP) {
            user.xp -= MAX_XP;
            user.level += 1;
            await user.save();
            return res.json({ 
                user, 
                levelUp: true, 
                newLevel: user.level 
            });
        }

        await user.save();
        res.json({ user, levelUp: false });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PUT /api/players/curse — aplica ou remove maldição
exports.updateCurse = async (req, res) => {
    try {
        const { is_cursed } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { is_cursed },
            { new: true }
        ).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};