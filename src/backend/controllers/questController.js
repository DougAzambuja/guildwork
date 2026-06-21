const Quest           = require('../models/Quest');
const QuestCompletion = require('../models/QuestCompletion');
const User            = require('../models/User');

// GET /api/quests — lista todas as quests ativas
exports.getQuests = async (req, res) => {
    try {
        const quests = await Quest.find({ is_active: true });
        res.json(quests);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/quests/complete — registra conclusão de uma quest
exports.completeQuest = async (req, res) => {
    try {
        const { quest_id, csat_score } = req.body;
        const user  = await User.findById(req.user.id);
        const quest = await Quest.findById(quest_id);

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        // Calcula XP (com lógica CSAT se for suporte)
        let xp_gained    = quest.xp_reward;
        let coins_gained = quest.coin_reward;

        if (quest.type === 'support' && csat_score) {
            xp_gained = Math.round(quest.xp_reward * (csat_score / 5));
        }

        // Registra a conclusão
        await QuestCompletion.create({
            user_id: user._id,
            quest_id: quest._id,
            xp_gained,
            coins_gained,
            csat_score: csat_score || null
        });

        // Atualiza XP e coins do jogador
        user.xp    += xp_gained;
        user.coins += coins_gained;

        // Level Up
        const MAX_XP  = 10000;
        let leveledUp = false;
        if (user.xp >= MAX_XP) {
            user.xp   -= MAX_XP;
            user.level += 1;
            leveledUp  = true;
        }

        await user.save();

        res.json({
            message:     'Quest concluída!',
            xp_gained,
            coins_gained,
            leveledUp,
            newLevel:    user.level,
            user: {
                xp:    user.xp,
                coins: user.coins,
                level: user.level
            }
        });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};