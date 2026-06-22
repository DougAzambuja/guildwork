const Quest           = require('../models/quest');
const QuestCompletion = require('../models/questCompletion');
const User            = require('../models/user');

const MAX_XP = 10000;

// GET /api/quests — Lista todas as quests ativas para popular o Mural
exports.getQuests = async (req, res) => {
    try {
        const quests = await Quest.find({ is_active: true });
        res.json(quests);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/quests/complete — Registra conclusão de uma quest de forma segura
exports.completeQuest = async (req, res) => {
    try {
        const { questId, csatScore } = req.body;
        const user  = await User.findById(req.user.id);
        const quest = await Quest.findById(questId);

        if (!quest) {
            return res.status(404).json({ message: 'Quest não encontrada nos registros da Guilda.' });
        }

        // Calcula XP baseando-se na fonte da verdade (Banco de Dados)
        let xpGained    = quest.xp_reward;
        let coinsGained = quest.coin_reward;

        // Regra de negócio: Quests de suporte variam pelo CSAT (1 a 5)
        if (quest.type === 'support' && csatScore) {
            xpGained = Math.round(quest.xp_reward * (csatScore / 5));
        }

        // Registra a conclusão para histórico e auditoria
        await QuestCompletion.create({
            user_id: user._id,
            quest_id: quest._id,
            xp_gained: xpGained,
            coins_gained: coinsGained,
            csat_score: csatScore || null
        });

        // Atualiza a carteira e experiência do jogador
        user.quests_completed = (user.quests_completed || 0) + 1;
        user.xp += xpGained;
        user.coins += coinsGained;

        // Motor de Level Up
        let leveledUp = false;
        if (user.xp >= MAX_XP) {
            user.xp -= MAX_XP;
            user.level += 1;
            leveledUp = true;
        }

        await user.save();

        // Resposta formatada para o frontend atualizar a UI instantaneamente
        res.json({
            message: 'Quest concluída e validada pelo servidor!',
            xpGained,
            coinsGained,
            leveledUp,
            updatedState: {
                xp: user.xp,
                coins: user.coins,
                level: user.level,
                questsCompleted: user.quests_completed
            }
        });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};  