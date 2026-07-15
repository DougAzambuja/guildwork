const Quest           = require('../models/quest');
const QuestCompletion = require('../models/questCompletion');
const User            = require('../models/user');

const MAX_XP   = 10000;
const WIP_LIMIT = 3;

// GET /api/quests — Retorna quests da facção do jogador (+ quests atribuídas a ele de outras facções)
exports.getQuests = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('faction');

        const quests = await Quest.find({
            is_active: true,
            $or: [
                { faction: user.faction },
                { assigned_to: req.user.id }
            ]
        })
            .populate('assigned_to', 'nome username avatar_url')
            .sort({ createdAt: -1 });

        res.json(quests);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PATCH /api/quests/:id/move — Jogador aceita uma quest (todo → in_progress)
exports.moveQuest = async (req, res) => {
    try {
        const { status } = req.body;
        const quest = await Quest.findById(req.params.id);

        if (!quest) {
            return res.status(404).json({ message: 'Quest não encontrada.' });
        }

        if (status === 'in_progress') {
            if (quest.status !== 'todo') {
                return res.status(400).json({ message: 'Quest não está disponível para aceite.' });
            }

            if (quest.assigned_to && quest.assigned_to.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Quest já atribuída a outro aventureiro.' });
            }

            const inProgressCount = await Quest.countDocuments({
                assigned_to: req.user.id,
                status: 'in_progress'
            });

            if (inProgressCount >= WIP_LIMIT) {
                return res.status(400).json({
                    message: `Limite de ${WIP_LIMIT} quests em progresso atingido. Conclua uma antes de aceitar outra.`
                });
            }

            quest.status      = 'in_progress';
            quest.assigned_to = req.user.id;
            quest.started_at  = new Date();
            await quest.save();

            const populated = await quest.populate('assigned_to', 'nome username avatar_url');
            return res.json(populated);
        }

        return res.status(400).json({ message: 'Transição de status inválida.' });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/quests/complete — Conclui uma quest (in_progress → done)
exports.completeQuest = async (req, res) => {
    try {
        const { questId, csatScore } = req.body;
        const user  = await User.findById(req.user.id);
        const quest = await Quest.findById(questId);

        if (!quest) {
            return res.status(404).json({ message: 'Quest não encontrada.' });
        }

        if (quest.status !== 'in_progress') {
            return res.status(400).json({ message: 'Quest não está em progresso.' });
        }

        if (!quest.assigned_to || quest.assigned_to.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Esta quest não está atribuída a você.' });
        }

        let xpGained    = quest.xp_reward;
        let coinsGained = quest.coin_reward;

        // Multiplicador CSAT para quests de suporte
        if (quest.type === 'support' && csatScore) {
            xpGained = Math.round(quest.xp_reward * (csatScore / 5));
        }

        // Penalidade de maldição: metade dos ganhos
        if (user.is_cursed) {
            xpGained    = Math.floor(xpGained    / 2);
            coinsGained = Math.floor(coinsGained / 2);
            user.is_cursed = false;
        }

        await QuestCompletion.create({
            user_id:      user._id,
            quest_id:     quest._id,
            xp_gained:    xpGained,
            coins_gained: coinsGained,
            csat_score:   csatScore || null
        });

        user.quests_completed = (user.quests_completed || 0) + 1;
        user.xp    += xpGained;
        user.coins += coinsGained;

        let leveledUp = false;
        if (user.xp >= MAX_XP) {
            user.xp -= MAX_XP;
            user.level += 1;
            leveledUp = true;
        }

        await user.save();

        quest.status = 'done';
        await quest.save();

        res.json({
            message: 'Quest concluída!',
            xpGained,
            coinsGained,
            leveledUp,
            updatedState: {
                xp:               user.xp,
                coins:            user.coins,
                level:            user.level,
                questsCompleted:  user.quests_completed,
                isCursed:         user.is_cursed
            }
        });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};
