const Notification = require('../models/notification');
const User         = require('../models/user');

// Marcos de conquista por quests concluídas
const ACHIEVEMENTS = [
    { key: 'first_quest', at: 1,  title: '🎖️ Aventureiro Estreante', message: 'Você concluiu sua primeira missão na Guilda!' },
    { key: 'quests_5',   at: 5,  title: '⚔️ Guerreiro Dedicado',    message: '5 missões concluídas! Sua lenda começa a crescer.' },
    { key: 'quests_10',  at: 10, title: '🛡️ Veterano da Guilda',    message: '10 missões! Você é um pilar desta guilda.' },
    { key: 'quests_25',  at: 25, title: '👑 Herói Lendário',         message: '25 missões! Seu nome é lembrado em todas as tavernas.' },
    { key: 'quests_50',  at: 50, title: '🌟 Mestre das Missões',     message: '50 missões! A guilda nunca viu tamanha dedicação.' }
];

// Exporta a lista para o frontend poder renderizar conquistas bloqueadas
const ALL_ACHIEVEMENTS = ACHIEVEMENTS;

// ==========================================
// PRIMITIVA — cria qualquer notificação
// ==========================================
async function create(userId, type, title, message, meta = {}) {
    try {
        return await Notification.create({ user_id: userId, type, title, message, meta });
    } catch (err) {
        console.error('[NotificationService] Erro ao criar notificação:', err.message);
    }
}

// ==========================================
// TRIGGER: Quest atribuída pelo admin
// ==========================================
async function notifyQuestAssigned(quest, userId) {
    await create(
        userId,
        'quest_assigned',
        '⚔️ Nova Missão Atribuída',
        `A missão "${quest.title}" foi atribuída a você pelo Mestre da Guilda!`,
        { quest_id: quest._id }
    );
}

// ==========================================
// TRIGGER: Level up
// ==========================================
async function notifyLevelUp(userId, newLevel) {
    await create(
        userId,
        'level_up',
        '🎉 LEVEL UP!',
        `Parabéns! Você alcançou o Nível ${newLevel}! Continue sua jornada, aventureiro!`,
        { level: newLevel }
    );
}

// ==========================================
// TRIGGER: Conquista desbloqueada
// ==========================================
async function checkAndNotifyAchievement(userId, questsCompleted) {
    const milestone = ACHIEVEMENTS.find(a => a.at === questsCompleted);
    if (!milestone) return;

    // Persistir conquista no User (se ainda não foi desbloqueada)
    const user = await User.findById(userId).select('achievements');
    const alreadyUnlocked = user?.achievements?.some(a => a.key === milestone.key);
    if (!alreadyUnlocked) {
        await User.findByIdAndUpdate(userId, {
            $push: { achievements: { key: milestone.key, title: milestone.title } }
        });
    }

    await create(
        userId,
        'achievement',
        milestone.title,
        milestone.message,
        { quests_completed: questsCompleted }
    );
}

// ==========================================
// TRIGGER: SLA quase estourando (background job)
// Evita spam: uma notificação por quest a cada 24h
// ==========================================
async function notifySlaWarning(quest, userId) {
    const alreadySent = await Notification.findOne({
        user_id:          userId,
        type:             'sla_warning',
        'meta.quest_id':  String(quest._id),
        createdAt:        { $gte: new Date(Date.now() - 24 * 3600 * 1000) }
    });
    if (alreadySent) return false;

    await create(
        userId,
        'sla_warning',
        '⏰ SLA em Risco!',
        `Sua missão "${quest.title}" está perto do limite de tempo. Conclua-a logo!`,
        { quest_id: quest._id }
    );
    return true;
}

// ==========================================
// TRIGGER: Quest atrasada — alerta ao admin
// Evita spam: um alerta por quest a cada 4h por admin
// ==========================================
async function notifyAdminAlert(adminId, quest) {
    const alreadySent = await Notification.findOne({
        user_id:         adminId,
        type:            'admin_alert',
        'meta.quest_id': String(quest._id),
        createdAt:       { $gte: new Date(Date.now() - 4 * 3600 * 1000) }
    });
    if (alreadySent) return false;

    await create(
        adminId,
        'admin_alert',
        '🚨 Quest do Time Atrasada!',
        `A missão "${quest.title}" (${quest.faction}) ultrapassou o SLA e ninguém concluiu ainda.`,
        { quest_id: quest._id, faction: quest.faction }
    );
    return true;
}

module.exports = {
    create,
    notifyQuestAssigned,
    notifyLevelUp,
    checkAndNotifyAchievement,
    notifySlaWarning,
    notifyAdminAlert,
    ALL_ACHIEVEMENTS
};
