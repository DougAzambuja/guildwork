const Quest           = require('../models/Quest');
const QuestCompletion = require('../models/QuestCompletion');
const User            = require('../models/User');

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
            return res.status(404).json({ message: 'Quest não encontrada nos registros.' });
        }

        let xpGained    = quest.xp_reward;
        let coinsGained = quest.coin_reward;

        if (quest.type === 'support' && csatScore) {
            xpGained = Math.round(quest.xp_reward * (csatScore / 5));
        }

        // 🚨 NOVA REGRA DE NEGÓCIO: PENALIDADE DA MALDIÇÃO 
        let wasCursed = user.is_cursed;
        if (wasCursed) {
            xpGained = Math.floor(xpGained / 2);
            coinsGained = Math.floor(coinsGained / 2);
            user.is_cursed = false; // A maldição é quebrada assim que ele entrega a missão!
        }

        await QuestCompletion.create({
            user_id: user._id,
            quest_id: quest._id,
            xp_gained: xpGained,
            coins_gained: coinsGained,
            csat_score: csatScore || null
        });

        user.quests_completed = (user.quests_completed || 0) + 1;
        user.xp += xpGained;
        user.coins += coinsGained;

        let leveledUp = false;
        if (user.xp >= MAX_XP) {
            user.xp -= MAX_XP;
            user.level += 1;
            leveledUp = true;
        }

        await user.save();

        res.json({
            message: 'Quest concluída!',
            xpGained,
            coinsGained,
            leveledUp,
            wasCursed, // Avisa o Front-end que a maldição foi processada
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