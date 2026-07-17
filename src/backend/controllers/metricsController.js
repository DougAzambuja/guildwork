const QuestCompletion = require('../models/questCompletion');
const Quest           = require('../models/quest');
const User            = require('../models/user');

// ==========================================
// CURSE RATE — aventureiros atualmente amaldiçoados (User.is_cursed)
// + histórico de conclusões sob maldição (QuestCompletion.was_cursed)
// ==========================================
async function computeCurse() {
    const [users, completions] = await Promise.all([
        User.find({ role: { $ne: 'admin' } }).lean(),
        QuestCompletion.find().lean()
    ]);

    // Estado atual: User.is_cursed
    const factionMap = {};
    for (const u of users) {
        const f = u.faction || 'Sem Facção';
        if (!factionMap[f]) factionMap[f] = { total: 0, cursed: 0, cursed_names: [] };
        factionMap[f].total++;
        if (u.is_cursed) {
            factionMap[f].cursed++;
            factionMap[f].cursed_names.push(u.nome || u.username);
        }
    }

    const by_faction = {};
    for (const [f, d] of Object.entries(factionMap)) {
        by_faction[f] = {
            total:        d.total,
            cursed:       d.cursed,
            rate:         d.total > 0 ? Math.round((d.cursed / d.total) * 100) : 0,
            cursed_names: d.cursed_names
        };
    }

    const totalPlayers  = users.length;
    const cursedPlayers = users.filter(u => u.is_cursed).length;

    // Histórico: QuestCompletion.was_cursed (quantas conclusões ocorreram sob maldição)
    const totalCompletions  = completions.length;
    const cursedCompletions = completions.filter(c => c.was_cursed).length;

    return {
        overall: {
            total:  totalPlayers,
            cursed: cursedPlayers,
            rate:   totalPlayers > 0 ? Math.round((cursedPlayers / totalPlayers) * 100) : 0
        },
        by_faction,
        historical: {
            total_completions:  totalCompletions,
            cursed_completions: cursedCompletions,
            rate: totalCompletions > 0 ? Math.round((cursedCompletions / totalCompletions) * 100) : 0
        }
    };
}

// ==========================================
// ECONOMY — gold emitido vs gold em carteiras
// ==========================================
async function computeEconomy() {
    const [completions, users] = await Promise.all([
        QuestCompletion.find().lean(),
        User.find({ role: { $ne: 'admin' } }).lean()
    ]);

    const goldIssued = completions.reduce((s, c) => s + (c.coins_gained || 0), 0);
    const goldHeld   = users.reduce((s, u) => s + (u.coins || 0), 0);

    const userFactionMap = {};
    for (const u of users) userFactionMap[String(u._id)] = u.faction || 'Sem Facção';

    const factionEarned = {};
    for (const c of completions) {
        const faction = userFactionMap[String(c.user_id)] || 'Sem Facção';
        factionEarned[faction] = (factionEarned[faction] || 0) + (c.coins_gained || 0);
    }

    const cutoff = new Date(Date.now() - 30 * 86400000);
    const trendMap = {};
    for (const c of completions) {
        if (new Date(c.completed_at) < cutoff) continue;
        const day = new Date(c.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        trendMap[day] = (trendMap[day] || 0) + (c.coins_gained || 0);
    }

    return {
        gold_issued: goldIssued,
        gold_held:   goldHeld,
        by_faction:  factionEarned,
        trend: Object.entries(trendMap)
            .map(([date, gold]) => ({ date, gold }))
            .sort((a, b) => a.date.localeCompare(b.date))
    };
}

// ==========================================
// SLA — compliance por facção
// ==========================================
async function computeSla() {
    const slaQuests = await Quest.find({
        sla_seconds: { $ne: null, $exists: true },
        started_at:  { $ne: null },
        status: 'done'
    }).lean();

    if (!slaQuests.length) {
        return { overall: { total: 0, within_sla: 0, compliance_pct: 0 }, by_faction: {} };
    }

    const questIds    = slaQuests.map(q => q._id);
    const completions = await QuestCompletion.find({ quest_id: { $in: questIds } }).lean();
    const questMap    = Object.fromEntries(slaQuests.map(q => [String(q._id), q]));

    let withinSla    = 0;
    let total        = 0;
    const factionMap = {};

    for (const c of completions) {
        const quest = questMap[String(c.quest_id)];
        if (!quest) continue;

        const elapsed   = (new Date(c.completed_at) - new Date(quest.started_at)) / 1000;
        const compliant = elapsed <= quest.sla_seconds;
        const faction   = quest.faction || 'Sem Facção';

        total++;
        if (compliant) withinSla++;

        if (!factionMap[faction]) factionMap[faction] = { total: 0, within_sla: 0 };
        factionMap[faction].total++;
        if (compliant) factionMap[faction].within_sla++;
    }

    const by_faction = {};
    for (const [f, d] of Object.entries(factionMap)) {
        by_faction[f] = {
            ...d,
            compliance_pct: d.total > 0 ? Math.round((d.within_sla / d.total) * 100) : 0
        };
    }

    return {
        overall: {
            total,
            within_sla:     withinSla,
            compliance_pct: total > 0 ? Math.round((withinSla / total) * 100) : 0
        },
        by_faction
    };
}

// ==========================================
// CSAT — tendência e médias por facção
// ==========================================
async function computeCsat() {
    const completions = await QuestCompletion.find({ csat_score: { $ne: null } })
        .populate('user_id', 'nome username faction')
        .lean();

    if (!completions.length) {
        return { overall_avg: null, by_user: [], by_faction: {}, trend: [] };
    }

    const overall_avg = parseFloat(
        (completions.reduce((s, c) => s + c.csat_score, 0) / completions.length).toFixed(1)
    );

    // By user
    const userMap = {};
    for (const c of completions) {
        if (!c.user_id) continue;
        const uid = String(c.user_id._id);
        if (!userMap[uid]) {
            userMap[uid] = { nome: c.user_id.nome || c.user_id.username, faction: c.user_id.faction, scores: [] };
        }
        userMap[uid].scores.push(c.csat_score);
    }
    const by_user = Object.values(userMap)
        .map(u => ({
            nome:    u.nome,
            faction: u.faction,
            avg:     parseFloat((u.scores.reduce((s, v) => s + v, 0) / u.scores.length).toFixed(1)),
            count:   u.scores.length
        }))
        .sort((a, b) => b.avg - a.avg);

    // By faction
    const factionMap = {};
    for (const c of completions) {
        const faction = c.user_id?.faction || 'Sem Facção';
        if (!factionMap[faction]) factionMap[faction] = { scores: [], count: 0 };
        factionMap[faction].scores.push(c.csat_score);
        factionMap[faction].count++;
    }
    const by_faction = {};
    for (const [f, d] of Object.entries(factionMap)) {
        by_faction[f] = {
            avg:   parseFloat((d.scores.reduce((s, v) => s + v, 0) / d.scores.length).toFixed(1)),
            count: d.count
        };
    }

    // Daily trend — last 30 days
    const cutoff  = new Date(Date.now() - 30 * 86400000);
    const trendMap = {};
    for (const c of completions) {
        if (new Date(c.completed_at) < cutoff) continue;
        const day = new Date(c.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!trendMap[day]) trendMap[day] = [];
        trendMap[day].push(c.csat_score);
    }
    const trend = Object.entries(trendMap)
        .map(([date, scores]) => ({
            date,
            avg: parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1))
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return { overall_avg, by_user, by_faction, trend };
}

// ==========================================
// ENDPOINT UNIFICADO — GET /api/metrics
// ==========================================
exports.getAllMetrics = async (req, res) => {
    try {
        const [curse, economy, sla, csat] = await Promise.all([
            computeCurse(),
            computeEconomy(),
            computeSla(),
            computeCsat()
        ]);
        res.json({ curse, economy, sla, csat });
    } catch (err) {
        console.error('[Metrics] Erro:', err);
        res.status(500).json({ message: 'Erro ao calcular métricas.', error: err.message });
    }
};
