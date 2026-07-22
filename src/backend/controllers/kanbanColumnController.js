const KanbanColumn = require('../models/kanbanColumn');
const Guild        = require('../models/guild');
const Quest        = require('../models/quest');
const User         = require('../models/user');

const DEFAULT_COLUMNS = [
    { name: 'A Fazer',      order: 1, color: '#2c3e50', status_map: 'todo'        },
    { name: 'Em Progresso', order: 2, color: '#e67e22', status_map: 'in_progress' },
    { name: 'Concluído',    order: 3, color: '#27ae60', status_map: 'done'        }
];

async function getGuildForUser(userId) {
    const user  = await User.findById(userId).select('faction role');
    const guild = await Guild.findOne({ faction_key: user.faction });
    return { user, guild };
}

async function ensureColumns(guildId) {
    const count = await KanbanColumn.countDocuments({ guild_id: guildId });
    if (count === 0) {
        await KanbanColumn.insertMany(
            DEFAULT_COLUMNS.map(c => ({ ...c, guild_id: guildId }))
        );
    }
    return KanbanColumn.find({ guild_id: guildId }).sort({ order: 1 }).lean();
}

// GET /api/guilds/columns?guild_id=<id>
// guild_id é opcional — admin pode passar, player usa a própria guilda
exports.getColumns = async (req, res) => {
    try {
        let guildId = req.query.guild_id;

        if (!guildId) {
            const { guild } = await getGuildForUser(req.user.id);
            if (!guild) return res.status(404).json({ message: 'Guilda não encontrada.' });
            guildId = guild._id;
        }

        const columns = await ensureColumns(guildId);
        res.json(columns);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/guilds/columns
exports.createColumn = async (req, res) => {
    try {
        const { guild, user } = await getGuildForUser(req.user.id);
        if (!guild) return res.status(404).json({ message: 'Guilda não encontrada.' });

        const isLeader = guild.leader_id && guild.leader_id.toString() === req.user.id;
        if (user.role !== 'admin' && !isLeader) {
            return res.status(403).json({ message: 'Apenas admin ou líder pode gerenciar colunas.' });
        }

        const { name, color, status_map } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ message: 'Nome da coluna é obrigatório.' });
        if (!['todo', 'in_progress', 'done'].includes(status_map)) {
            return res.status(400).json({ message: 'status_map inválido.' });
        }

        const last = await KanbanColumn.findOne({ guild_id: guild._id }).sort({ order: -1 }).lean();
        const order = last ? last.order + 1 : 1;

        const column = await KanbanColumn.create({
            guild_id: guild._id,
            name: name.trim(),
            order,
            color: color || '#2c3e50',
            status_map
        });

        res.status(201).json(column);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PATCH /api/guilds/columns/:col_id
exports.updateColumn = async (req, res) => {
    try {
        const { guild, user } = await getGuildForUser(req.user.id);
        if (!guild) return res.status(404).json({ message: 'Guilda não encontrada.' });

        const isLeader = guild.leader_id && guild.leader_id.toString() === req.user.id;
        if (user.role !== 'admin' && !isLeader) {
            return res.status(403).json({ message: 'Apenas admin ou líder pode gerenciar colunas.' });
        }

        const column = await KanbanColumn.findOne({ _id: req.params.col_id, guild_id: guild._id });
        if (!column) return res.status(404).json({ message: 'Coluna não encontrada.' });

        const { name, color, order, status_map } = req.body;
        if (name       !== undefined) column.name       = name.trim() || column.name;
        if (color      !== undefined) column.color      = color;
        if (order      !== undefined) column.order      = order;
        if (status_map !== undefined && ['todo', 'in_progress', 'done'].includes(status_map)) {
            column.status_map = status_map;
        }

        await column.save();
        res.json(column);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// DELETE /api/guilds/columns/:col_id
exports.deleteColumn = async (req, res) => {
    try {
        const { guild, user } = await getGuildForUser(req.user.id);
        if (!guild) return res.status(404).json({ message: 'Guilda não encontrada.' });

        const isLeader = guild.leader_id && guild.leader_id.toString() === req.user.id;
        if (user.role !== 'admin' && !isLeader) {
            return res.status(403).json({ message: 'Apenas admin ou líder pode gerenciar colunas.' });
        }

        const totalColumns = await KanbanColumn.countDocuments({ guild_id: guild._id });
        if (totalColumns <= 3) {
            return res.status(400).json({ message: 'A guilda deve ter no mínimo 3 colunas.' });
        }

        const questsInColumn = await Quest.countDocuments({ column_id: req.params.col_id });
        if (questsInColumn > 0) {
            return res.status(400).json({ message: 'Mova as missões desta coluna antes de removê-la.' });
        }

        await KanbanColumn.deleteOne({ _id: req.params.col_id, guild_id: guild._id });
        res.json({ message: 'Coluna removida.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PATCH /api/guilds/columns/reorder — salva nova ordem em lote
// body: [{ _id, order }, ...]
exports.reorderColumns = async (req, res) => {
    try {
        const { guild, user } = await getGuildForUser(req.user.id);
        if (!guild) return res.status(404).json({ message: 'Guilda não encontrada.' });

        const isLeader = guild.leader_id && guild.leader_id.toString() === req.user.id;
        if (user.role !== 'admin' && !isLeader) {
            return res.status(403).json({ message: 'Apenas admin ou líder pode gerenciar colunas.' });
        }

        const updates = req.body;
        if (!Array.isArray(updates)) return res.status(400).json({ message: 'Payload inválido.' });

        await Promise.all(
            updates.map(({ _id, order }) =>
                KanbanColumn.updateOne({ _id, guild_id: guild._id }, { order })
            )
        );

        const columns = await KanbanColumn.find({ guild_id: guild._id }).sort({ order: 1 }).lean();
        res.json(columns);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};
