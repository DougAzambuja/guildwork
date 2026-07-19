const User                = require('../models/user');
const LootItem            = require('../models/lootItem');
const notificationService = require('../services/notificationService');

function xpParaProximoNivel(level) {
    return 200 * (level + 1) + 300;
}

// GET /api/players/profile — retorna os dados do jogador logado
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PUT /api/players/profile — atualiza perfil (nome, avatar)
exports.updateProfile = async (req, res) => {
    try {
        const { nome, avatar_url } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { nome, avatar_url },
            { returnDocument: 'after' }
        ).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PUT /api/players/gamification — Atualiza XP, Moedas e Quests completadas
exports.updateGamification = async (req, res) => {
    try {
        const { xp = 0, coins = 0 } = req.body;
        const user = await User.findById(req.user.id);

        user.xp += xp;
        user.coins += coins;

        const levelBefore = user.level || 1;
        user.quests_completed = (user.quests_completed || 0) + 1;

        while (user.xp >= xpParaProximoNivel(user.level)) {
            user.xp -= xpParaProximoNivel(user.level);
            user.level += 1;
        }

        await user.save();

        // Notificações em background
        if (user.level > levelBefore) {
            notificationService.notifyLevelUp(user._id, user.level).catch(() => {});
        }
        notificationService.checkAndNotifyAchievement(user._id, user.quests_completed).catch(() => {});

        // Devolve o estado exato do banco para o Front-end sincronizar a tela
        res.json({
            xp: user.xp,
            coins: user.coins,
            level: user.level,
            quests_completed: user.quests_completed
        });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PUT /api/players/curse — aplica ou remove maldição
exports.updateCurse = async (req, res) => {
    try {
        const isCursed  = req.body.is_cursed !== undefined ? req.body.is_cursed : req.body.isCursed;
        const curseType = req.body.curse_type || null;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { is_cursed: isCursed, curse_type: isCursed ? curseType : null },
            { returnDocument: 'after' }
        ).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/players/checkout — debita moedas com segurança (preço recalculado no servidor)
exports.checkout = async (req, res) => {
    try {
        const { items } = req.body; // [{id, quantity}]

        if (!items || !items.length) {
            return res.status(400).json({ message: 'Carrinho vazio.' });
        }

        // Busca preços reais no banco — o front-end não é fonte da verdade
        const ids    = items.map(i => i.id);
        const dbItems = await LootItem.find({ _id: { $in: ids } });

        let total = 0;
        for (const cartItem of items) {
            const dbItem = dbItems.find(i => i._id.toString() === cartItem.id);
            if (!dbItem) {
                return res.status(400).json({ message: 'Item inválido detectado. Anomalia na Guilda.' });
            }
            total += dbItem.price * cartItem.quantity;
        }

        const user = await User.findById(req.user.id);
        if (user.coins < total) {
            return res.status(400).json({ message: 'Gold insuficiente. A guilda detectou uma anomalia.' });
        }

        user.coins -= total;
        await user.save();

        res.json({ message: 'Compra processada.', updatedCoins: user.coins });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// GET /api/players — Roster (Lista todos os usuários para a tabela do Admin)
exports.getAllPlayers = async (req, res) => {
    try {
        // Traz todos, mas não expõe a senha
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};