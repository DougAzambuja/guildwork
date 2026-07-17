const Quest               = require('../models/quest');
const QuestCompletion     = require('../models/questCompletion');
const User                = require('../models/user');
const notificationService = require('../services/notificationService');

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
            csat_score:   csatScore || null,
            was_cursed:   user.is_cursed
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

        // Dispara notificações em background (não bloqueia a resposta)
        const newQuestsCompleted = (user.quests_completed || 0) + 1;
        if (leveledUp) {
            notificationService.notifyLevelUp(user._id, newLevel).catch(() => {});
        }
        notificationService.checkAndNotifyAchievement(user._id, newQuestsCompleted).catch(() => {});

        res.json({
            message: 'Quest concluída!',
            xpGained,
            coinsGained,
            leveledUp,
            updatedState: {
                xp:               user.xp,
                coins:            user.coins,
                level:            user.level,
                questsCompleted:  newQuestsCompleted,
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
 * GET /api/quests/all — Admin lista quests com filtros server-side e paginação.
 * Query params: faction, sprint_id ('backlog' = sem sprint), status, label, search, limit (max 100), page
 */
exports.adminGetQuests = async (req, res) => {
    try {
        const { faction, sprint_id, status, label, search, limit: rawLimit, page: rawPage } = req.query;

        const limit = Math.min(parseInt(rawLimit) || 10, 100);
        const page  = Math.max(parseInt(rawPage)  || 1, 1);
        const skip  = (page - 1) * limit;

        const filter = {};

        if (faction) filter.faction = faction;
        if (status)  filter.status  = status;
        if (label)   filter.labels  = label;

        if (sprint_id === 'backlog') {
            filter.sprint_id = null;
        } else if (sprint_id) {
            filter.sprint_id = sprint_id;
        }

        if (search) {
            filter.title = { $regex: search, $options: 'i' };
        }

        const [quests, total] = await Promise.all([
            Quest.find(filter)
                .populate('assigned_to', 'nome username')
                .populate('sprint_id', 'name status')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Quest.countDocuments(filter)
        ]);

        res.json({ quests, total, page, limit });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar quests.', error: err.message });
    }
};

/**
 * POST /api/quests — Admin cria nova quest.
 */
exports.adminCreateQuest = async (req, res) => {
    try {
        const { title, type, xp_reward, coin_reward, sla_seconds, faction, sprint_id, labels } = req.body;

        if (!title || !xp_reward || !coin_reward) {
            return res.status(400).json({ message: 'Título, XP e Gold são obrigatórios.' });
        }

        const parsedLabels = Array.isArray(labels)
            ? labels.filter(Boolean)
            : (typeof labels === 'string' ? labels.split(',').map(l => l.trim()).filter(Boolean) : []);

        const quest = await Quest.create({
            title,
            type:        type        || 'normal',
            xp_reward,
            coin_reward,
            sla_seconds: sla_seconds || null,
            faction:     faction     || 'Produto',
            sprint_id:   sprint_id   || null,
            labels:      parsedLabels
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

        // Notifica o aventureiro que recebeu a quest
        if (userId) {
            notificationService.notifyQuestAssigned(quest, userId).catch(() => {});
        }

        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atribuir quest.', error: err.message });
    }
};

/**
 * PATCH /api/quests/:id/transfer
 * Admin move uma quest entre sprints e/ou facções.
 * Body: { sprint_id?: ObjectId|null, faction?: string }
 * sprint_id = null → remove quest da sprint atual (backlog)
 */
exports.adminTransferQuest = async (req, res) => {
    try {
        const { sprint_id, faction } = req.body;
        const update = {};

        if (sprint_id !== undefined) update.sprint_id = sprint_id || null;
        if (faction)                 update.faction   = faction;

        if (!Object.keys(update).length) {
            return res.status(400).json({ message: 'Informe sprint_id e/ou faction para transferir.' });
        }

        const quest = await Quest.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
            .populate('assigned_to', 'nome username');

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        res.json(quest);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao transferir quest.', error: err.message });
    }
};

/**
 * GET /api/quests/:id/comments
 * Retorna o histórico de comentários de uma quest, populado com autor.
 */
exports.getComments = async (req, res) => {
    try {
        const quest = await Quest.findById(req.params.id)
            .select('comments')
            .populate('comments.user_id', 'nome username');

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        res.json(quest.comments);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar comentários.', error: err.message });
    }
};

/**
 * POST /api/quests/:id/comments
 * Adiciona um comentário à quest. Disponível para admin e aventureiro.
 * Body: { text: string }
 */
exports.addComment = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) {
            return res.status(400).json({ message: 'Comentário não pode ser vazio.' });
        }

        const quest = await Quest.findByIdAndUpdate(
            req.params.id,
            { $push: { comments: { user_id: req.user.id, text: text.trim() } } },
            { new: true, runValidators: true }
        ).populate('comments.user_id', 'nome username');

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        res.status(201).json(quest.comments[quest.comments.length - 1]);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao adicionar comentário.', error: err.message });
    }
};

/**
 * PATCH /api/quests/:id/subtasks — Admin vincula ou desvincula quests relacionadas.
 * Body: { add?: ObjectId[], remove?: ObjectId[] }
 * Regras: uma quest não pode ser subtask de si mesma; aceita operações parciais.
 */
exports.updateSubtasks = async (req, res) => {
    try {
        const { add = [], remove = [] } = req.body;

        if (!add.length && !remove.length) {
            return res.status(400).json({ message: 'Informe quests para vincular (add) ou desvincular (remove).' });
        }

        const questId = req.params.id;
        const allIds  = [...add, ...remove];

        if (allIds.includes(questId)) {
            return res.status(400).json({ message: 'Uma quest não pode ser subtask de si mesma.' });
        }

        const update = {};
        if (add.length)    update.$addToSet = { subtasks: { $each: add } };
        if (remove.length) update.$pull     = { subtasks: { $in: remove } };

        const quest = await Quest.findByIdAndUpdate(questId, update, { new: true })
            .populate('subtasks', 'title status type faction');

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        res.json({ subtasks: quest.subtasks });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atualizar subtasks.', error: err.message });
    }
};

/**
 * POST /api/quests/:id/copy
 * Admin duplica uma quest, opcionalmente para outra sprint e/ou facção.
 * A cópia sempre começa como todo, sem atribuição.
 * Body: { sprint_id?: ObjectId|null, faction?: string }
 */
exports.adminCopyQuest = async (req, res) => {
    try {
        const { sprint_id, faction } = req.body;
        const source = await Quest.findById(req.params.id).lean();

        if (!source) return res.status(404).json({ message: 'Quest de origem não encontrada.' });

        const copy = await Quest.create({
            title:       `[Cópia] ${source.title}`,
            type:        source.type,
            xp_reward:   source.xp_reward,
            coin_reward: source.coin_reward,
            sla_seconds: source.sla_seconds,
            faction:     faction   || source.faction,
            sprint_id:   sprint_id !== undefined ? (sprint_id || null) : source.sprint_id,
            status:      'todo',
            is_active:   true
        });

        res.status(201).json(copy);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao copiar quest.', error: err.message });
    }
};
