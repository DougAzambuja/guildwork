const Guild = require('../models/guild');
const Quest = require('../models/quest');

// Libera Admin irrestrito. Para não-admin, só libera se ele for líder de alguma guilda —
// e, em rotas com :id, só se a quest de destino pertencer à guilda desse líder
// (Server-Side Authority: a checagem de posse nunca confia em dado vindo do Front-end).
module.exports = async (req, res, next) => {
    if (req.user?.role === 'admin') return next();

    try {
        const guild = await Guild.findOne({ leader_id: req.user.id });
        if (!guild) {
            return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda ou ao líder de guilda.' });
        }

        if (req.params.id) {
            const quest = await Quest.findById(req.params.id);
            if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });
            if (quest.faction !== guild.faction_key) {
                return res.status(403).json({ message: 'Você só pode gerenciar quests da sua própria guilda.' });
            }
            req.targetQuest = quest;
        }

        req.leaderGuild = guild;
        next();
    } catch (err) {
        res.status(500).json({ message: 'Erro ao verificar permissão.', error: err.message });
    }
};
