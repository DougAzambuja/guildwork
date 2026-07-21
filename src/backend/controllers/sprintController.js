const Sprint          = require('../models/sprint');
const Quest           = require('../models/quest');
const Guild           = require('../models/guild');
const User            = require('../models/user');
const QuestCompletion = require('../models/questCompletion');

// ==========================================
// HELPERS
// ==========================================

/**
 * Resolve status automático baseado nas datas da sprint.
 * Só altera se o status atual ainda for 'planning' ou 'active'.
 */
function resolveStatus(sprint) {
    if (['completed', 'cancelled'].includes(sprint.status)) return sprint.status;
    const now = Date.now();
    if (now < new Date(sprint.start_date).getTime()) return 'planning';
    if (now > new Date(sprint.end_date).getTime())   return 'completed';
    return 'active';
}

/**
 * Persiste o status resolvido no banco caso tenha mudado.
 * Garante que Sprint.find({ status: 'active' }) seja confiável
 * sem depender de edição manual ou cron job.
 */
async function syncStatus(sprint) {
    const resolved = resolveStatus(sprint);
    if (resolved !== sprint.status) {
        await Sprint.updateOne({ _id: sprint._id }, { status: resolved });
    }
    return resolved;
}

/**
 * Calcula o health score da sprint.
 * Compara % de conclusão de quests vs % de tempo decorrido.
 * on_track: conclusão >= tempo decorrido
 * at_risk:  conclusão >= tempo decorrido - 20%
 * behind:   conclusão < tempo decorrido - 20%
 */
function calcHealthScore(completedQuests, totalQuests, startDate, endDate) {
    if (totalQuests === 0) return 'on_track';

    const now        = Date.now();
    const start      = new Date(startDate).getTime();
    const end        = new Date(endDate).getTime();
    const totalMs    = end - start;
    const elapsedMs  = Math.min(Math.max(now - start, 0), totalMs);

    const timePct       = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0;
    const completionPct = (completedQuests / totalQuests) * 100;

    if (completionPct >= timePct)        return 'on_track';
    if (completionPct >= timePct - 20)   return 'at_risk';
    return 'behind';
}

/**
 * Monta o payload completo de analytics de uma sprint.
 * @param {Object} sprint - Documento da sprint (lean)
 * @param {string|null} filterFaction - faction_key da guilda para filtrar, ou null para todas
 */
async function buildSprintAnalytics(sprint, filterFaction = null) {
    const questFilter = { sprint_id: sprint._id };
    if (filterFaction) questFilter.faction = filterFaction;

    const rawQuests = await Quest.find(questFilter)
        .populate('assigned_to', 'nome username avatar_url')
        .lean();

    // Busca o status das subtasks em lote para montar os contadores no card
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

    const total      = quests.length;
    const done       = quests.filter(q => q.status === 'done').length;
    const inProgress = quests.filter(q => q.status === 'in_progress').length;
    const todo       = quests.filter(q => q.status === 'todo').length;

    // XP e Gold totais gerados pelas quests concluídas
    const doneQuests    = quests.filter(q => q.status === 'done');
    const totalXp       = doneQuests.reduce((s, q) => s + (q.xp_reward   || 0), 0);
    const totalCoins    = doneQuests.reduce((s, q) => s + (q.coin_reward || 0), 0);

    // Datas e tempo
    const now           = Date.now();
    const start         = new Date(sprint.start_date).getTime();
    const end           = new Date(sprint.end_date).getTime();
    const daysTotal     = sprint.duration_days;
    const daysElapsed   = Math.max(0, Math.floor((now - start) / 86400000));
    const daysRemaining = Math.max(0, Math.ceil((end - now) / 86400000));
    const timePct       = daysTotal > 0 ? Math.min(100, Math.round((daysElapsed / daysTotal) * 100)) : 0;
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Breakdown por facção
    const factionMap = {};
    quests.forEach(q => {
        const f = q.faction || 'Sem Facção';
        if (!factionMap[f]) factionMap[f] = { total: 0, done: 0, in_progress: 0, todo: 0, xp: 0 };
        factionMap[f].total++;
        factionMap[f][q.status === 'in_progress' ? 'in_progress' : q.status]++;
        if (q.status === 'done') factionMap[f].xp += q.xp_reward || 0;
    });

    // Top performers dentro da sprint (por quests concluídas)
    const performerMap = {};
    doneQuests.forEach(q => {
        if (!q.assigned_to) return;
        const uid = q.assigned_to._id.toString();
        if (!performerMap[uid]) performerMap[uid] = { user: q.assigned_to, done: 0, xp: 0 };
        performerMap[uid].done++;
        performerMap[uid].xp += q.xp_reward || 0;
    });
    const topPerformers = Object.values(performerMap)
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 5);

    return {
        metrics: {
            total_quests:    total,
            done_quests:     done,
            in_progress:     inProgress,
            todo_quests:     todo,
            completion_pct:  completionPct,
            total_xp:        totalXp,
            total_coins:     totalCoins,
            days_elapsed:    daysElapsed,
            days_remaining:  daysRemaining,
            days_total:      daysTotal,
            time_pct:        timePct,
            health_score:    calcHealthScore(done, total, sprint.start_date, sprint.end_date)
        },
        by_faction:    factionMap,
        top_performers: topPerformers,
        quests
    };
}

// ==========================================
// CRUD
// ==========================================

/**
 * GET /api/sprints
 * Lista todas as sprints com métricas básicas.
 */
exports.getSprints = async (req, res) => {
    try {
        const sprints = await Sprint.find().sort({ start_date: -1 }).lean();

        // Resolve e persiste status automático para cada sprint
        const result = await Promise.all(sprints.map(async sprint => {
            const status = await syncStatus(sprint);
            const [total, done] = await Promise.all([
                Quest.countDocuments({ sprint_id: sprint._id }),
                Quest.countDocuments({ sprint_id: sprint._id, status: 'done' })
            ]);
            return {
                ...sprint,
                status,
                quest_count:     total,
                quests_done:     done,
                completion_pct:  total > 0 ? Math.round((done / total) * 100) : 0
            };
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar sprints.', error: err.message });
    }
};

/**
 * GET /api/sprints/active
 * Retorna a sprint ativa no momento com analytics completo.
 */
exports.getActiveSprint = async (req, res) => {
    try {
        const now = new Date();
        const sprint = await Sprint.findOne({
            start_date: { $lte: now },
            end_date:   { $gte: now },
            status:     { $nin: ['cancelled'] }
        }).sort({ start_date: -1 }).lean();

        if (!sprint) return res.json(null);

        const [, analytics] = await Promise.all([
            syncStatus(sprint),   // garante 'active' persistido
            buildSprintAnalytics(sprint)
        ]);
        res.json({ sprint: { ...sprint, status: 'active' }, ...analytics });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar sprint ativa.', error: err.message });
    }
};

/**
 * GET /api/sprints/:id?guild_id=<id>
 * Retorna uma sprint específica com analytics completo.
 * Param opcional guild_id (admin only): filtra quests e métricas pela guilda.
 */
exports.getSprintById = async (req, res) => {
    try {
        const sprint = await Sprint.findById(req.params.id).lean();
        if (!sprint) return res.status(404).json({ message: 'Sprint não encontrada.' });

        let filterFaction = null;
        const { guild_id } = req.query;
        if (guild_id) {
            if (req.user?.role !== 'admin') {
                return res.status(403).json({ message: 'Filtro por guilda restrito ao Mestre da Guilda.' });
            }
            const guild = await Guild.findById(guild_id).select('faction_key').lean();
            if (!guild) return res.status(404).json({ message: 'Guilda não encontrada.' });
            filterFaction = guild.faction_key;
        }

        const [status, analytics] = await Promise.all([
            syncStatus(sprint),
            buildSprintAnalytics(sprint, filterFaction)
        ]);
        res.json({
            sprint:      { ...sprint, status },
            guild_filter: filterFaction || null,
            ...analytics
        });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar sprint.', error: err.message });
    }
};

/**
 * POST /api/sprints
 * Admin cria nova sprint.
 */
exports.createSprint = async (req, res) => {
    try {
        const { name, goal, factions, start_date, duration_days } = req.body;

        if (!name || !start_date || !duration_days) {
            return res.status(400).json({ message: 'Nome, data de início e duração são obrigatórios.' });
        }

        const start  = new Date(start_date);
        const end    = new Date(start);
        end.setDate(end.getDate() + parseInt(duration_days));

        const sprint = await Sprint.create({
            name,
            goal:         goal || null,
            factions:     factions || [],
            start_date:   start,
            end_date:     end,
            duration_days: parseInt(duration_days),
            created_by:   req.user.id,
            status:       'planning'
        });

        res.status(201).json(sprint);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao criar sprint.', error: err.message });
    }
};

/**
 * PATCH /api/sprints/:id
 * Admin atualiza sprint (nome, meta, facções, datas, status).
 * Sprints 'completed' ou 'cancelled' só permitem alteração de status.
 */
exports.updateSprint = async (req, res) => {
    try {
        const sprint = await Sprint.findById(req.params.id);
        if (!sprint) return res.status(404).json({ message: 'Sprint não encontrada.' });

        const { name, goal, factions, start_date, duration_days, status } = req.body;

        if (name)          sprint.name     = name;
        if (goal !== undefined) sprint.goal = goal;
        if (factions)      sprint.factions = factions;
        if (status && ['planning', 'active', 'completed', 'cancelled'].includes(status)) {
            sprint.status = status;
        }

        if (start_date || duration_days) {
            const start = start_date ? new Date(start_date) : sprint.start_date;
            const days  = duration_days ? parseInt(duration_days) : sprint.duration_days;
            const end   = new Date(start);
            end.setDate(end.getDate() + days);

            sprint.start_date    = start;
            sprint.end_date      = end;
            sprint.duration_days = days;
        }

        await sprint.save();
        res.json(sprint);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atualizar sprint.', error: err.message });
    }
};

/**
 * DELETE /api/sprints/:id
 * Admin remove sprint. Só permitido em status 'planning' ou 'cancelled'.
 * Desvincula as quests associadas.
 */
exports.deleteSprint = async (req, res) => {
    try {
        const sprint = await Sprint.findById(req.params.id);
        if (!sprint) return res.status(404).json({ message: 'Sprint não encontrada.' });

        if (['active', 'completed'].includes(sprint.status)) {
            return res.status(400).json({
                message: 'Sprints ativas ou concluídas não podem ser excluídas. Cancele primeiro.'
            });
        }

        // Desvincula quests antes de deletar
        await Quest.updateMany({ sprint_id: sprint._id }, { $unset: { sprint_id: '' } });
        await sprint.deleteOne();

        res.json({ message: 'Sprint removida com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao remover sprint.', error: err.message });
    }
};

/**
 * POST /api/sprints/:id/quests
 * Admin adiciona quests a uma sprint. Body: { quest_ids: [ObjectId] }
 */
exports.addQuestsToSprint = async (req, res) => {
    try {
        const { quest_ids } = req.body;
        if (!quest_ids?.length) {
            return res.status(400).json({ message: 'Informe ao menos uma quest.' });
        }

        await Quest.updateMany(
            { _id: { $in: quest_ids } },
            { sprint_id: req.params.id }
        );

        const count = await Quest.countDocuments({ sprint_id: req.params.id });
        res.json({ message: `${quest_ids.length} quest(s) adicionada(s) à sprint.`, total: count });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao adicionar quests.', error: err.message });
    }
};

/**
 * DELETE /api/sprints/:id/quests/:questId
 * Admin remove uma quest específica da sprint.
 */
exports.removeQuestFromSprint = async (req, res) => {
    try {
        await Quest.findByIdAndUpdate(req.params.questId, { $unset: { sprint_id: '' } });
        res.json({ message: 'Quest removida da sprint.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao remover quest da sprint.', error: err.message });
    }
};

/**
 * GET /api/sprints/:id/burndown
 * Retorna dados para o gráfico de burndown da sprint.
 * Usa QuestCompletion.completed_at como fonte de verdade para datas de conclusão.
 *
 * Response:
 *   labels[]       — labels de data para o eixo X (dd/mm)
 *   ideal_line[]   — linha ideal (decrescente linear de total → 0)
 *   actual_line[]  — linha real (quests restantes por dia)
 *   total_quests   — total de quests na sprint
 */
exports.getSprintBurndown = async (req, res) => {
    try {
        const sprint = await Sprint.findById(req.params.id).lean();
        if (!sprint) return res.status(404).json({ message: 'Sprint não encontrada.' });

        const quests    = await Quest.find({ sprint_id: sprint._id }).select('_id').lean();
        const questIds  = quests.map(q => q._id);
        const total     = quests.length;

        const completions = await QuestCompletion.find({ quest_id: { $in: questIds } })
            .select('completed_at')
            .lean();

        const start    = new Date(sprint.start_date);
        const end      = new Date(sprint.end_date);
        const today    = new Date();
        const chartEnd = today < end ? today : end;

        const labels     = [];
        const idealLine  = [];
        const actualLine = [];

        let current  = new Date(start);
        let dayIndex = 0;

        // Itera todos os dias da sprint (não só até hoje) para exibir a linha ideal completa
        while (current <= end) {
            const dayEnd = new Date(current);
            dayEnd.setHours(23, 59, 59, 999);

            labels.push(current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

            idealLine.push(
                Math.max(0, Math.round(total - (total * (dayIndex / Math.max(sprint.duration_days - 1, 1)))))
            );

            // Linha real só até hoje — dias futuros ficam null (não renderizados)
            if (current <= chartEnd) {
                const doneCount = completions.filter(c => new Date(c.completed_at) <= dayEnd).length;
                actualLine.push(Math.max(0, total - doneCount));
            } else {
                actualLine.push(null);
            }

            current.setDate(current.getDate() + 1);
            dayIndex++;
        }

        res.json({
            sprint_name:  sprint.name,
            total_quests: total,
            labels,
            ideal_line:   idealLine,
            actual_line:  actualLine,
            duration_days: sprint.duration_days
        });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao calcular burndown.', error: err.message });
    }
};
