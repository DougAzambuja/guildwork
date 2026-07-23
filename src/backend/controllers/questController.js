const Quest               = require('../models/quest');
const QuestCompletion     = require('../models/questCompletion');
const User                = require('../models/user');
const Guild               = require('../models/guild');
const Sprint              = require('../models/sprint');
const notificationService = require('../services/notificationService');

const WIP_LIMIT = 3;

// Faixas de recompensa pré-aprovadas para quests criadas por líder de guilda.
// O líder escolhe um tamanho — o valor de XP/Gold sempre vem daqui, nunca do
// que o cliente envia (Server-Side Authority: sem isso, quests de líder ficavam
// travadas em 0 XP/Gold, mas dar o campo livre pra ele minaria a integridade
// econômica do sistema).
const LEADER_QUEST_SIZE_TIERS = {
    pequena: { xp_reward: 100, coin_reward: 15 },
    media:   { xp_reward: 250, coin_reward: 30 },
    grande:  { xp_reward: 450, coin_reward: 50 }
};
const DEFAULT_LEADER_QUEST_SIZE = 'pequena';

// XP necessário para avançar do nível N para N+1
// Progressão linear crescente: early levels são rápidos, late game desacelera gradualmente
function xpParaProximoNivel(level) {
    return 200 * (level + 1) + 300;
}

// GET /api/quests — Retorna quests de sprints ativas na facção do jogador (+ quests atribuídas a ele)
exports.getQuests = async (req, res) => {
    try {
        const now = new Date();
        const [user, activeSprints] = await Promise.all([
            User.findById(req.user.id).select('faction').lean(),
            Sprint.find({
                start_date: { $lte: now },
                end_date:   { $gte: now },
                status:     { $nin: ['cancelled'] }
            }).select('_id').lean()
        ]);

        const activeSprintIds = activeSprints.map(s => s._id);

        const rawQuests = await Quest.find({
            is_active: true,
            $or: [
                { faction: user.faction, sprint_id: { $in: activeSprintIds } },
                { assigned_to: req.user.id }
            ]
        })
            .populate('assigned_to', 'nome username avatar_url')
            .sort({ createdAt: -1 })
            .lean();

        // Contadores de subtasks em lote
        const parentIds  = rawQuests.map(q => q._id);
        const childStats = await Quest.find({ parent_id: { $in: parentIds } })
            .select('parent_id status').lean();

        const doneByParent = {};
        childStats.forEach(c => {
            const pid = String(c.parent_id);
            if (!doneByParent[pid]) doneByParent[pid] = { total: 0, done: 0 };
            doneByParent[pid].total++;
            if (c.status === 'done') doneByParent[pid].done++;
        });

        const quests = rawQuests.map(q => {
            const stat = doneByParent[String(q._id)] || { total: 0, done: 0 };
            return { ...q, subtasks_total: stat.total, subtasks_done: stat.done };
        });

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

            const actor = await User.findById(req.user.id).select('nome username curse_type');

            if (actor?.curse_type === 'csat_low' && quest.type === 'urgent') {
                return res.status(403).json({
                    message: '💔 Maldição da Insatisfação ativa: missões urgentes bloqueadas até CSAT ≥ 4★ em suporte.'
                });
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

            quest.status           = 'in_progress';
            quest.assigned_to      = req.user.id;
            quest.started_at       = new Date();
            quest.last_assigned_at = new Date();
            quest.contributors.push({ user_id: req.user.id, action: 'accepted', time_held_secs: 0, timestamp: new Date() });

            const KanbanColumn = require('../models/kanbanColumn');
            const guild = await Guild.findOne({ faction_key: quest.faction }).lean();
            if (guild) {
                const inProgressCol = await KanbanColumn.findOne(
                    { guild_id: guild._id, status_map: 'in_progress' },
                    null,
                    { sort: { order: 1 } }
                ).lean();
                if (inProgressCol) quest.column_id = inProgressCol._id;
            }

            quest.comments.push({ user_id: req.user.id, text: `${actor?.nome || actor?.username || 'Aventureiro'} aceitou a missão`, type: 'activity' });
            await quest.save();

            const populated = await quest.populate('assigned_to', 'nome username avatar_url');
            return res.json(populated);
        }

        return res.status(400).json({ message: 'Transição de status inválida.' });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// Helper interno: executa toda a lógica de conclusão de uma quest já validada.
// Grava QuestCompletion, atualiza User, atualiza quest.status e quest.column_id.
// Retorna um objeto com os valores calculados para o caller montar a resposta HTTP.
// ==========================================
// GROUP QUEST (#109) — HELPERS
// ==========================================

const PARTY_BONUS   = 1.15; // +15% no pool total quando 2+ contribuidores
const QUORUM_RATIO  = 0.10; // contribuidor precisa de >= 10% do tempo total

// Registra o holder atual como contribuidor e atualiza last_assigned_at
function _recordCurrentHolder(quest, userId, isAdmin, action) {
    if (isAdmin || !userId) return;
    const now      = new Date();
    const timeHeld = quest.last_assigned_at
        ? Math.round((now.getTime() - new Date(quest.last_assigned_at).getTime()) / 1000)
        : 0;
    quest.contributors.push({ user_id: userId, action, time_held_secs: timeHeld, timestamp: now });
    quest.last_assigned_at = now;
}

// Agrega contribuidores por user_id, aplica quorum e retorna shares
function _buildContributorShares(contributors) {
    if (!contributors || contributors.length === 0) return [];

    const timeMap = {};
    for (const c of contributors) {
        const id = String(c.user_id);
        timeMap[id] = (timeMap[id] || 0) + (c.time_held_secs || 0);
    }

    const totalTime = Object.values(timeMap).reduce((s, t) => s + t, 0);
    const entries   = Object.entries(timeMap);

    if (totalTime === 0) {
        return entries.map(([userId]) => ({ userId, ratio: 1 / entries.length }));
    }

    const qualified    = entries.filter(([, t]) => t / totalTime >= QUORUM_RATIO);
    const effective    = qualified.length > 0 ? qualified : entries;
    const effectiveSum = effective.reduce((s, [, t]) => s + t, 0);

    return effective.map(([userId, time]) => ({ userId, ratio: time / effectiveSum }));
}

// Aplica buffs e maldições da quest para um usuário sobre sua parcela de XP/Gold
// isCompleter: apenas o completer recebe CSAT scaling, curses, delivery streak e CSAT streak
function _applyRewardsForUser(user, xpShare, coinsShare, quest, csatScore, isCompleter) {
    const now = new Date();
    let xpGained    = xpShare;
    let coinsGained = coinsShare;

    if (isCompleter && quest.type === 'support' && csatScore) {
        xpGained = Math.round(xpShare * (csatScore / 5));
    }

    let newBuffType            = user.buff_type             || null;
    let newBuffExpiresAt       = user.buff_expires_at       || null;
    let newBuffQuestsRemaining = user.buff_quests_remaining || null;
    let buffApplied = null;

    if (newBuffType === 'xp_double_time' && newBuffExpiresAt && new Date(newBuffExpiresAt) > now) {
        xpGained    = Math.round(xpGained * 2);
        buffApplied = 'xp_double_time';
    } else if (newBuffType === 'xp_double_activity' && newBuffQuestsRemaining > 0) {
        xpGained    = Math.round(xpGained * 2);
        buffApplied = 'xp_double_activity';
        newBuffQuestsRemaining--;
        if (newBuffQuestsRemaining <= 0) {
            newBuffType = null; newBuffExpiresAt = null; newBuffQuestsRemaining = null;
        }
    } else if (newBuffType) {
        newBuffType = null; newBuffExpiresAt = null; newBuffQuestsRemaining = null;
    }

    const wasCursed = user.is_cursed;
    if (user.curse_type) {
        if      (user.curse_type === 'sla_breach') xpGained    = Math.floor(xpGained    / 2);
        else if (user.curse_type === 'abandoned')  coinsGained = Math.floor(coinsGained / 2);
        else if (user.curse_type === 'csat_low') {
            xpGained    = Math.floor(xpGained    / 2);
            coinsGained = Math.floor(coinsGained / 2);
        }
        const cured = user.curse_type === 'csat_low'
            ? (quest.type === 'support' && csatScore >= 4)
            : true;
        if (cured) { user.is_cursed = false; user.curse_type = null; }
    }

    let newCurseApplied = null;
    // Novas maldições só se aplicam ao completer (quem empurrou para done)
    if (isCompleter && !user.is_cursed) {
        if (quest.sla_seconds && quest.started_at) {
            const elapsed = (Date.now() - new Date(quest.started_at).getTime()) / 1000;
            if (elapsed > quest.sla_seconds) {
                newCurseApplied = 'sla_breach'; user.curse_type = 'sla_breach'; user.is_cursed = true;
            }
        }
        if (quest.type === 'support' && csatScore && csatScore <= 2) {
            newCurseApplied = 'csat_low'; user.curse_type = 'csat_low'; user.is_cursed = true;
        }
    }

    let newCsatStreak = user.csat_streak || 0;
    let buffGranted   = null;
    if (isCompleter && quest.type === 'support' && csatScore) {
        if (csatScore === 5) {
            newCsatStreak++;
            if (newCsatStreak === 5) {
                newBuffType = 'xp_double_time'; newBuffExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                newBuffQuestsRemaining = null; newCsatStreak = 0; buffGranted = 'xp_double_time';
            } else if (newCsatStreak === 3) {
                newBuffType = 'xp_double_activity'; newBuffExpiresAt = null;
                newBuffQuestsRemaining = 2; buffGranted = 'xp_double_activity';
            }
        } else { newCsatStreak = 0; }
    }

    let newDeliveryStreak = user.delivery_streak || 0;
    let streakBonusXP     = 0;
    let newLastDeliveryAt = user.last_delivery_at;
    if (isCompleter) {
        const todayStr     = new Date().toISOString().slice(0, 10);
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const lastDelivery = user.last_delivery_at
            ? new Date(user.last_delivery_at).toISOString().slice(0, 10)
            : null;

        if (!lastDelivery || lastDelivery < yesterdayStr) newDeliveryStreak = 1;
        else if (lastDelivery === yesterdayStr)            newDeliveryStreak++;

        const milestone = [
            { at: 3, bonus: 50 }, { at: 7, bonus: 150 }, { at: 14, bonus: 300 }, { at: 30, bonus: 500 },
        ].find(m => m.at === newDeliveryStreak);
        if (milestone) streakBonusXP = milestone.bonus;
        newLastDeliveryAt = (lastDelivery === todayStr) ? user.last_delivery_at : new Date();
        xpGained += streakBonusXP;
    }

    return {
        xpGained, coinsGained, wasCursed, newCurseApplied, buffApplied, buffGranted,
        newBuffType, newBuffExpiresAt, newBuffQuestsRemaining,
        newCsatStreak, newDeliveryStreak, newLastDeliveryAt, streakBonusXP,
        isCursed: user.is_cursed, curseType: user.curse_type,
    };
}

// ==========================================
// CONCLUSÃO DE QUEST (com distribuição Group Quest)
// ==========================================
async function _executeQuestCompletion(quest, completer, csatScore, columnId = null) {
    const isCompleterAdmin = completer.role === 'admin';

    // 1. Registrar completer como último holder
    _recordCurrentHolder(quest, completer._id, isCompleterAdmin, 'completed');

    // 2. Calcular shares por tempo de posse
    const shares = _buildContributorShares(quest.contributors);
    const hasParty = shares.length >= 2;

    const baseXp    = hasParty ? Math.round(quest.xp_reward    * PARTY_BONUS) : quest.xp_reward;
    const baseCoins = hasParty ? Math.round(quest.coin_reward   * PARTY_BONUS) : quest.coin_reward;

    // Fallback solo: se nenhum contribuidor não-admin encontrado
    const effectiveShares = shares.length > 0
        ? shares
        : [{ userId: String(completer._id), ratio: 1 }];

    const guild = await Guild.findOne({ faction_key: completer.faction });
    let completerResult = null;

    // 3. Processar cada contribuidor individualmente
    for (const share of effectiveShares) {
        const isCompleter = share.userId === String(completer._id);
        const user = isCompleter ? completer : await User.findById(share.userId);
        if (!user) continue;

        const xpShare    = Math.max(1, Math.round(baseXp    * share.ratio));
        const coinsShare = Math.max(0, Math.round(baseCoins * share.ratio));

        const calc = _applyRewardsForUser(user, xpShare, coinsShare, quest, csatScore, isCompleter);

        const newQuestsCompleted = isCompleter ? (user.quests_completed || 0) + 1 : (user.quests_completed || 0);
        let newXp    = (user.xp    || 0) + calc.xpGained;
        let newCoins = (user.coins || 0) + calc.coinsGained;
        let newLevel = user.level  || 1;
        let leveledUp = false;

        while (newXp >= xpParaProximoNivel(newLevel)) {
            newXp -= xpParaProximoNivel(newLevel);
            newLevel++;
            leveledUp = true;
        }

        await QuestCompletion.create({
            user_id:      user._id,
            quest_id:     quest._id,
            xp_gained:    calc.xpGained,
            coins_gained: calc.coinsGained,
            csat_score:   isCompleter ? (csatScore || null) : null,
            was_cursed:   calc.wasCursed,
        });

        await User.findByIdAndUpdate(user._id, {
            xp: newXp, coins: newCoins, level: newLevel,
            is_cursed: user.is_cursed, curse_type: user.curse_type,
            quests_completed:      newQuestsCompleted,
            csat_streak:           isCompleter ? calc.newCsatStreak   : user.csat_streak,
            buff_type:             calc.newBuffType,
            buff_expires_at:       calc.newBuffExpiresAt,
            buff_quests_remaining: calc.newBuffQuestsRemaining,
            delivery_streak:       calc.newDeliveryStreak,
            last_delivery_at:      calc.newLastDeliveryAt,
        });

        // Treasury: apenas da parcela do completer
        let treasuryContribution = 0;
        if (isCompleter && guild) {
            treasuryContribution = Math.floor(calc.coinsGained * guild.tax_rate);
            await Guild.findByIdAndUpdate(guild._id, { $inc: { treasury_balance: treasuryContribution } });
        }

        if (leveledUp) notificationService.notifyLevelUp(user._id, newLevel).catch(() => {});
        if (isCompleter) {
            notificationService.checkAndNotifyAchievement(user._id, newQuestsCompleted).catch(() => {});
        } else {
            notificationService.notifyContributorReward(user._id, quest.title, calc.xpGained, calc.coinsGained).catch(() => {});
        }

        if (isCompleter) {
            completerResult = {
                xpGained: calc.xpGained, coinsGained: calc.coinsGained, leveledUp,
                newCurseApplied: calc.newCurseApplied, buffApplied: calc.buffApplied, buffGranted: calc.buffGranted,
                treasuryContribution, newXp, newCoins, newLevel, newQuestsCompleted,
                isCursed: user.is_cursed, curseType: user.curse_type,
                newCsatStreak: calc.newCsatStreak, newBuffType: calc.newBuffType,
                newBuffExpiresAt: calc.newBuffExpiresAt, newBuffQuestsRemaining: calc.newBuffQuestsRemaining,
                newDeliveryStreak: calc.newDeliveryStreak, streakBonusXP: calc.streakBonusXP,
                hasParty, contributorsCount: effectiveShares.length,
            };
        }
    }

    // Admin concluiu quest com contribuidores registrados: retorna resultado neutro sem XP/Gold
    if (!completerResult) {
        completerResult = {
            xpGained: 0, coinsGained: 0, leveledUp: false,
            newCurseApplied: null, buffApplied: null, buffGranted: null,
            treasuryContribution: 0,
            newXp:              completer.xp              || 0,
            newCoins:           completer.coins           || 0,
            newLevel:           completer.level           || 1,
            newQuestsCompleted: completer.quests_completed || 0,
            isCursed:           completer.is_cursed       || false,
            curseType:          completer.curse_type      || null,
            newCsatStreak:           completer.csat_streak          || 0,
            newBuffType:             completer.buff_type             || null,
            newBuffExpiresAt:        completer.buff_expires_at       || null,
            newBuffQuestsRemaining:  completer.buff_quests_remaining || null,
            newDeliveryStreak:       completer.delivery_streak       || 0,
            streakBonusXP: 0,
            hasParty, contributorsCount: effectiveShares.length,
        };
    }

    // 4. Salvar quest como done
    quest.status = 'done';
    if (columnId) quest.column_id = columnId;
    quest.comments.push({
        user_id: completer._id,
        text:    `${completer.nome || completer.username || 'Aventureiro'} concluiu a missão`,
        type:    'activity'
    });
    await quest.save();

    return completerResult;
}

function _buildCompletionResponse(r) {
    return {
        message:              'Quest concluída!',
        xpGained:             r.xpGained,
        coinsGained:          r.coinsGained,
        leveledUp:            r.leveledUp,
        hasParty:             r.hasParty,
        contributorsCount:    r.contributorsCount,
        newCurseApplied:      r.newCurseApplied,
        buffApplied:          r.buffApplied,
        buffGranted:          r.buffGranted,
        treasuryContribution: r.treasuryContribution,
        updatedState: {
            xp:              r.newXp,
            coins:           r.newCoins,
            level:           r.newLevel,
            questsCompleted: r.newQuestsCompleted,
            isCursed:        r.isCursed,
            curseType:       r.curseType,
            xpNextLevel:     xpParaProximoNivel(r.newLevel),
            csatStreak:      r.newCsatStreak,
            activeBuff:      r.newBuffType ? {
                type: r.newBuffType, expiresAt: r.newBuffExpiresAt, quests: r.newBuffQuestsRemaining
            } : null,
            deliveryStreak: r.newDeliveryStreak,
            streakBonusXP:  r.streakBonusXP,
        }
    };
}

// POST /api/quests/complete — Conclui uma quest (in_progress → done)
exports.completeQuest = async (req, res) => {
    try {
        const { questId, csatScore } = req.body;
        const user  = await User.findById(req.user.id);
        const quest = await Quest.findById(questId);

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });
        if (quest.status !== 'in_progress') return res.status(400).json({ message: 'Quest não está em progresso.' });
        if (!quest.assigned_to || quest.assigned_to.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Esta quest não está atribuída a você.' });
        }

        const r = await _executeQuestCompletion(quest, user, csatScore);
        res.json(_buildCompletionResponse(r));

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
 * POST /api/quests — Admin ou líder de guilda cria nova quest.
 * Líder de guilda: faction/type/sprint_id/labels são forçados a valores seguros;
 * xp_reward/coin_reward vêm de uma faixa pré-aprovada (LEADER_QUEST_SIZE_TIERS),
 * nunca de números enviados pelo cliente — Server-Side Authority, o líder não pode
 * cunhar XP/Gold arbitrário nem publicar quest fora da própria guilda.
 */
exports.adminCreateQuest = async (req, res) => {
    try {
        const isLeader = req.user.role !== 'admin';
        let { title, description, type, xp_reward, coin_reward, sla_seconds, faction, sprint_id, labels, assigned_to, checklist, size } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Título é obrigatório.' });
        }

        if (isLeader) {
            faction     = req.leaderGuild.faction_key;
            type        = 'normal';
            labels      = [];

            const tier = LEADER_QUEST_SIZE_TIERS[size] || LEADER_QUEST_SIZE_TIERS[DEFAULT_LEADER_QUEST_SIZE];
            xp_reward   = tier.xp_reward;
            coin_reward = tier.coin_reward;

            // Líder não escolhe a sprint — a quest entra direto na sprint ativa da guilda
            // (senão ficaria invisível: o board só mostra quests em sprints ativas).
            const activeSprint = await Sprint.findOne({ status: 'active', factions: faction }).select('_id');
            sprint_id = activeSprint ? activeSprint._id : null;
        } else if (!xp_reward || !coin_reward) {
            return res.status(400).json({ message: 'Título, XP e Gold são obrigatórios.' });
        }

        if (assigned_to) {
            const assignee = await User.findById(assigned_to).select('faction');
            if (!assignee) return res.status(400).json({ message: 'Aventureiro não encontrado.' });
            if (isLeader && assignee.faction !== req.leaderGuild.faction_key) {
                return res.status(403).json({ message: 'Você só pode atribuir quests a membros da sua guilda.' });
            }
        }

        const parsedLabels = Array.isArray(labels)
            ? labels.filter(Boolean)
            : (typeof labels === 'string' ? labels.split(',').map(l => l.trim()).filter(Boolean) : []);

        const parsedChecklist = Array.isArray(checklist)
            ? checklist
                .map(item => (typeof item === 'string' ? item : item?.text || ''))
                .map(text => text.trim())
                .filter(Boolean)
                .map(text => ({ text, done: false }))
            : [];

        const now = new Date();
        const quest = await Quest.create({
            title,
            description: description || '',
            type:        type        || 'normal',
            xp_reward,
            coin_reward,
            sla_seconds:      sla_seconds || null,
            faction:          faction     || 'Produto',
            sprint_id:        sprint_id   || null,
            labels:           parsedLabels,
            checklist:        parsedChecklist,
            assigned_to:      assigned_to || null,
            status:           assigned_to ? 'in_progress' : 'todo',
            started_at:       assigned_to ? now : null,
            last_assigned_at: assigned_to ? now : null,
            contributors:     assigned_to
                ? [{ user_id: assigned_to, action: 'accepted', time_held_secs: 0, timestamp: now }]
                : []
        });

        if (assigned_to) {
            notificationService.notifyQuestAssigned(quest, assigned_to).catch(() => {});
        }

        res.status(201).json(quest);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao criar quest.', error: err.message });
    }
};

/**
 * PATCH /api/quests/:id/assign — Admin ou líder de guilda atribui ou reseta uma quest.
 * Body: { userId: ObjectId | null }
 * userId = null → reset para todo, desatribui aventureiro.
 * Líder de guilda só pode atribuir a membros da própria guilda (a posse da quest em si já
 * foi validada pelo middleware isAdminOrGuildLeader).
 */
exports.adminAssignQuest = async (req, res) => {
    try {
        const { userId } = req.body;
        const quest = await Quest.findById(req.params.id);

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        if (userId && req.user.role !== 'admin') {
            const assignee = await User.findById(userId).select('faction');
            if (!assignee || assignee.faction !== req.leaderGuild.faction_key) {
                return res.status(403).json({ message: 'Você só pode atribuir quests a membros da sua guilda.' });
            }
        }

        if (userId) {
            const wasInProgress = quest.status === 'in_progress';
            const prevHolder    = quest.assigned_to;

            // Registra o tempo do holder anterior antes de trocar
            if (wasInProgress && prevHolder) {
                _recordCurrentHolder(quest, prevHolder, false, 'moved');
            }

            quest.assigned_to = userId;
            if (!wasInProgress) {
                quest.status     = 'in_progress';
                quest.started_at = new Date();
            }

            const assignee          = await User.findById(userId).select('nome username role');
            const newHolderIsAdmin  = assignee?.role === 'admin';
            if (!newHolderIsAdmin) {
                quest.contributors.push({ user_id: userId, action: 'accepted', time_held_secs: 0, timestamp: new Date() });
                quest.last_assigned_at = new Date();
            }

            quest.comments.push({ user_id: req.user.id, text: `Responsável alterado para ${assignee?.nome || assignee?.username || 'aventureiro'}`, type: 'activity' });
        } else {
            const previousAssignee = quest.assigned_to;
            if (previousAssignee) {
                _recordCurrentHolder(quest, previousAssignee, false, 'rejected');
            }
            quest.assigned_to      = null;
            quest.status           = 'todo';
            quest.started_at       = null;
            quest.last_assigned_at = null;
            quest.comments.push({ user_id: req.user.id, text: 'Missão resetada para "A Fazer"', type: 'activity' });

            if (previousAssignee) {
                await User.findByIdAndUpdate(previousAssignee, {
                    is_cursed:  true,
                    curse_type: 'abandoned'
                });
            }
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
 * GET /api/quests/:id — Detalhe completo de uma quest.
 * Player: acessa se for da mesma facção ou estiver atribuído. Admin: acesso irrestrito.
 * Popula: assigned_to, sprint_id, comments.user_id, subtasks
 */
exports.getQuestDetail = async (req, res) => {
    try {
        const quest = await Quest.findById(req.params.id)
            .populate('assigned_to', 'nome username avatar_url')
            .populate('sprint_id', 'name status')
            .populate('parent_id', 'title _id')
            .populate('comments.user_id', 'nome username avatar_url')
            .populate('contributors.user_id', 'nome username avatar_url')
            .populate({ path: 'subtasks', populate: { path: 'assigned_to', select: 'nome username avatar_url' } });

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        if (req.user.role !== 'admin') {
            const user = await User.findById(req.user.id).select('faction');
            const isAssigned  = quest.assigned_to && quest.assigned_to._id.toString() === req.user.id;
            const sameFaction = quest.faction === user.faction;
            if (!isAssigned && !sameFaction) {
                return res.status(403).json({ message: 'Acesso negado.' });
            }
        }

        const obj           = quest.toObject();
        obj.subtasks_total  = obj.subtasks.length;
        obj.subtasks_done   = obj.subtasks.filter(s => s.status === 'done').length;

        res.json(obj);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar quest.', error: err.message });
    }
};

/**
 * PATCH /api/quests/:id/checklist/:itemId — Toggle done de um item do checklist.
 * Player: apenas se for o assigned_to. Admin: sempre.
 */
exports.toggleChecklistItem = async (req, res) => {
    try {
        const quest = await Quest.findById(req.params.id);
        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        if (req.user.role !== 'admin') {
            if (!quest.assigned_to || quest.assigned_to.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Apenas o aventureiro atribuído pode marcar itens.' });
            }
        }

        const item = quest.checklist.id(req.params.itemId);
        if (!item) return res.status(404).json({ message: 'Item de checklist não encontrado.' });

        item.done = !item.done;
        await quest.save();

        res.json({ itemId: item._id, done: item.done });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atualizar item.', error: err.message });
    }
};

/**
 * PATCH /api/quests/:id/checklist — Admin ou líder de guilda adiciona/remove/renomeia itens do checklist.
 * Body: { add?: string[] (textos), remove?: string[] (ids dos itens), update?: {id, text}[] (renomear) }
 */
exports.updateChecklistItems = async (req, res) => {
    try {
        const { add = [], remove = [], update = [] } = req.body;
        if (!add.length && !remove.length && !update.length) {
            return res.status(400).json({ message: 'Informe itens para adicionar (add), remover (remove) ou renomear (update).' });
        }

        const quest = await Quest.findById(req.params.id);
        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        remove.forEach(itemId => quest.checklist.pull(itemId));

        update.forEach(({ id, text }) => {
            const item    = quest.checklist.id(id);
            const trimmed = String(text || '').trim();
            if (item && trimmed) item.text = trimmed;
        });

        add.forEach(text => {
            const trimmed = String(text || '').trim();
            if (trimmed) quest.checklist.push({ text: trimmed, done: false });
        });

        await quest.save();
        res.json({ checklist: quest.checklist });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atualizar checklist.', error: err.message });
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
 * POST /api/quests/:id/subtasks — Cria uma subtask nova vinculada ao parent.
 * Body: { title, assigned_to? }
 * Regras: parent não pode ser subtask (máx 1 nível).
 */
exports.createSubtask = async (req, res) => {
    try {
        const parent = await Quest.findById(req.params.id);
        if (!parent) return res.status(404).json({ message: 'Quest pai não encontrada.' });

        if (parent.parent_id) {
            return res.status(400).json({ message: 'Subtasks não podem ter outras subtasks (máx 1 nível).' });
        }

        const { title, assigned_to, xp_reward, coin_reward } = req.body;
        if (!title?.trim()) return res.status(400).json({ message: 'Título obrigatório.' });

        const subtask = await Quest.create({
            title:       title.trim(),
            xp_reward:   Number(xp_reward)   || 0,
            coin_reward: Number(coin_reward)  || 0,
            faction:     parent.faction,
            sprint_id:   parent.sprint_id || null,
            parent_id:   parent._id,
            assigned_to: assigned_to || null,
            is_active:   true
        });

        parent.subtasks.push(subtask._id);
        await parent.save();

        await subtask.populate('assigned_to', 'nome username avatar_url');
        res.status(201).json(subtask);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao criar subtask.', error: err.message });
    }
};

/**
 * GET /api/quests/:id/subtasks — Lista subtasks de uma quest com detalhe completo.
 */
exports.getSubtasks = async (req, res) => {
    try {
        const quest = await Quest.findById(req.params.id)
            .populate({ path: 'subtasks', populate: { path: 'assigned_to', select: 'nome username avatar_url' } });

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        res.json({
            subtasks:       quest.subtasks,
            subtasks_total: quest.subtasks.length,
            subtasks_done:  quest.subtasks.filter(s => s.status === 'done').length
        });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar subtasks.', error: err.message });
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

// PATCH /api/quests/:id — Admin ou líder de guilda edita campos da quest.
// Líder de guilda só pode alterar título, descrição e SLA — type/faction/xp_reward/
// coin_reward/sprint_id/labels enviados por ele são ignorados silenciosamente
// (Server-Side Authority; a posse da quest já foi validada pelo middleware).
exports.adminUpdateQuest = async (req, res) => {
    try {
        const isLeader = req.user.role !== 'admin';
        const { title, description, type, faction, xp_reward, coin_reward, sla_seconds, sprint_id, labels, size } = req.body;
        const update = {};
        if (title       !== undefined) update.title       = title;
        if (description !== undefined) update.description = description;
        if (sla_seconds !== undefined) update.sla_seconds = sla_seconds || null;

        if (isLeader) {
            // Líder pode reajustar o tamanho depois de criada — sempre pela faixa
            // pré-aprovada, nunca por valor bruto vindo do cliente.
            if (size !== undefined && LEADER_QUEST_SIZE_TIERS[size]) {
                update.xp_reward   = LEADER_QUEST_SIZE_TIERS[size].xp_reward;
                update.coin_reward = LEADER_QUEST_SIZE_TIERS[size].coin_reward;
            }
        } else {
            if (type        !== undefined) update.type        = type;
            if (faction     !== undefined) update.faction     = faction;
            if (xp_reward   !== undefined) update.xp_reward   = xp_reward;
            if (coin_reward !== undefined) update.coin_reward = coin_reward;
            if (sprint_id   !== undefined) update.sprint_id   = sprint_id  || null;
            if (labels      !== undefined) {
                update.labels = Array.isArray(labels)
                    ? labels.filter(Boolean)
                    : (typeof labels === 'string' ? labels.split(',').map(l => l.trim()).filter(Boolean) : []);
            }
        }

        const quest = await Quest.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });
        res.json(quest);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atualizar quest.', error: err.message });
    }
};

// PATCH /api/quests/:id/move-column — Qualquer jogador autenticado move seu próprio card.
// Admin e líder de guilda podem mover qualquer quest da guilda.
// Ao mover para coluna com status_map 'done', dispara toda a lógica de conclusão (XP/gold/recompensas).
exports.moveQuestToColumn = async (req, res) => {
    try {
        const { column_id, csat_score } = req.body;
        if (!column_id) return res.status(400).json({ message: 'column_id é obrigatório.' });

        const KanbanColumn = require('../models/kanbanColumn');
        const column = await KanbanColumn.findById(column_id).lean();
        if (!column) return res.status(404).json({ message: 'Coluna não encontrada.' });

        const quest = await Quest.findById(req.params.id);
        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        const user    = await User.findById(req.user.id);
        const isAdmin = user.role === 'admin';
        const isOwner = quest.assigned_to && quest.assigned_to.toString() === req.user.id;

        let isLeader = false;
        if (!isAdmin && !isOwner) {
            const guild = await Guild.findOne({ faction_key: user.faction });
            isLeader = !!(guild && guild.leader_id && guild.leader_id.toString() === req.user.id);
        }

        if (!isAdmin && !isOwner && !isLeader) {
            return res.status(403).json({ message: 'Sem permissão para mover esta quest.' });
        }

        if (column.status_map === 'done') {
            // Jogador e líder precisam ter a quest em progresso antes de concluir
            if (!isAdmin && quest.status !== 'in_progress') {
                return res.status(400).json({ message: 'A quest precisa estar em progresso para ser concluída.' });
            }
            if (!isAdmin && !isLeader && !isOwner) {
                return res.status(403).json({ message: 'Esta quest não está atribuída a você.' });
            }
            // Garante started_at para cálculo de SLA mesmo em conclusão direta pelo admin
            if (!quest.started_at) quest.started_at = new Date();
            const csatNum = csat_score ? parseInt(csat_score) : null;
            const r = await _executeQuestCompletion(quest, user, csatNum, column._id);
            return res.json(_buildCompletionResponse(r));
        }

        const prevAssignee = quest.assigned_to ? String(quest.assigned_to) : null;

        quest.column_id  = column._id;
        quest.status     = column.status_map;
        quest.card_order = null;

        if (column.status_map === 'in_progress') {
            if (!quest.started_at) quest.started_at = new Date();
            if (!quest.assigned_to) {
                // Aceitação: sem responsável anterior — inicia o timer e registra contribuidor
                quest.assigned_to = req.user.id;
                _recordCurrentHolder(quest, req.user.id, isAdmin, 'accepted');
                quest.comments.push({ user_id: req.user.id, text: `${user.nome || user.username || 'Aventureiro'} aceitou a missão`, type: 'activity' });
            } else if (prevAssignee && prevAssignee !== String(req.user.id)) {
                // Líder/admin move card: registra tempo do holder atual sem trocar o assignee
                _recordCurrentHolder(quest, quest.assigned_to, false, 'moved');
            } else if (!quest.last_assigned_at) {
                // Quest pré-atribuída sem last_assigned_at (dados legados) — inicia o timer
                quest.last_assigned_at = new Date();
            }
        }

        // Devolução ao backlog: registra o holder atual como 'rejected'
        if (column.status_map === 'todo') {
            if (prevAssignee) _recordCurrentHolder(quest, quest.assigned_to, false, 'rejected');
            quest.assigned_to      = null;
            quest.last_assigned_at = null;
        }

        await quest.save();
        const populated = await Quest.findById(quest._id)
            .populate('assigned_to', 'nome username avatar_url')
            .lean();
        res.json({ quest: populated });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// DELETE /api/quests/:id — Admin ou líder de guilda remove uma quest permanentemente.
// Quests em progresso não podem ser removidas (evita perder trabalho em andamento).
// PATCH /api/quests/:id/column — Admin ou líder move quest para coluna customizada
exports.moveQuestColumn = async (req, res) => {
    try {
        const { column_id } = req.body;
        if (!column_id) return res.status(400).json({ message: 'column_id é obrigatório.' });

        const KanbanColumn = require('../models/kanbanColumn');
        const column = await KanbanColumn.findById(column_id).lean();
        if (!column) return res.status(404).json({ message: 'Coluna não encontrada.' });

        const quest = await Quest.findById(req.params.id);
        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        quest.column_id = column._id;
        quest.status    = column.status_map;

        if (column.status_map === 'in_progress' && !quest.started_at) {
            quest.started_at = new Date();
        }
        if (column.status_map === 'todo') quest.assigned_to = null;

        await quest.save();
        res.json(quest);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

exports.deleteQuest = async (req, res) => {
    try {
        const quest = await Quest.findById(req.params.id);
        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        if (quest.status === 'in_progress') {
            return res.status(400).json({ message: 'Não é possível remover uma quest em progresso.' });
        }

        await quest.deleteOne();
        res.json({ message: 'Quest removida com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao remover quest.', error: err.message });
    }
};

// PATCH /api/quests/reorder-in-column — Atualiza card_order em lote para uma coluna
exports.reorderCardsInColumn = async (req, res) => {
    try {
        const { updates } = req.body;
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ message: 'Payload inválido.' });
        }
        await Promise.all(
            updates.map(({ _id, card_order }) =>
                Quest.updateOne({ _id }, { card_order })
            )
        );
        res.json({ message: 'Ordem atualizada.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};
