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

        let newXp    = (user.xp    || 0) + xpGained;
        let newCoins = (user.coins || 0) + coinsGained;
        let newLevel = user.level  || 1;
        let leveledUp = false;

        if (newXp >= MAX_XP) {
            newXp -= MAX_XP;
            newLevel += 1;
            leveledUp = true;
        }

        await User.findByIdAndUpdate(user._id, {
            xp:               newXp,
            coins:            newCoins,
            level:            newLevel,
            is_cursed:        false,
            quests_completed: (user.quests_completed || 0) + 1
        });

        user.xp    = newXp;
        user.coins = newCoins;
        user.level = newLevel;

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

// ==========================================
// ADMIN — Gestão de Quests
// ==========================================

/**
 * GET /api/quests/all — Admin lista todas as quests com atribuição populada.
 */
exports.adminGetQuests = async (req, res) => {
    try {
        const quests = await Quest.find()
            .populate('assigned_to', 'nome username')
            .sort({ createdAt: -1 });
        res.json(quests);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar quests.', error: err.message });
    }
};

/**
 * POST /api/quests — Admin cria nova quest.
 */
exports.adminCreateQuest = async (req, res) => {
    try {
        const { title, type, xp_reward, coin_reward, sla_seconds, faction } = req.body;

        if (!title || !xp_reward || !coin_reward) {
            return res.status(400).json({ message: 'Título, XP e Gold são obrigatórios.' });
        }

        const quest = await Quest.create({
            title,
            type:        type        || 'normal',
            xp_reward,
            coin_reward,
            sla_seconds: sla_seconds || null,
            faction:     faction     || 'Produto'
        });

        res.status(201).json(quest);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao criar quest.', error: err.message });
    }
};

/**
 * PATCH /api/quests/:id/assign — Admin atribui ou reseta uma quest.
 * Body: { userId: ObjectId | null }
 * userId = null → reset para todo, desatribui aventureiro.
 */
exports.adminAssignQuest = async (req, res) => {
    try {
        const { userId } = req.body;
        const quest = await Quest.findById(req.params.id);

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        if (userId && quest.status !== 'todo') {
            return res.status(400).json({ message: 'Só é possível atribuir quests com status "todo".' });
        }

        if (userId) {
            quest.assigned_to = userId;
            quest.status      = 'in_progress';
            quest.started_at  = new Date();
        } else {
            quest.assigned_to = null;
            quest.status      = 'todo';
            quest.started_at  = null;
        }

        await quest.save();
        const populated = await quest.populate('assigned_to', 'nome username');
        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atribuir quest.', error: err.message });
    }
};
