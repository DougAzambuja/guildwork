const RandomEncounter = require('../models/randomEncounter');
const EventTemplate   = require('../models/eventTemplate');
const User            = require('../models/user');

// POST /api/encounters/trigger (admin)
exports.triggerEncounter = async (req, res) => {
    try {
        const { template_id, type, affected_faction, duration_hours } = req.body;

        let title, description, effect_kind, effect_value, final_duration, scope_type;

        if (template_id) {
            const tpl = await EventTemplate.findById(template_id);
            if (!tpl) return res.status(404).json({ message: 'Template não encontrado.' });

            title        = tpl.title;
            description  = tpl.description;
            effect_kind  = tpl.effect_kind;
            effect_value = tpl.default_value;
            final_duration = Number(duration_hours) > 0 ? Number(duration_hours) : tpl.default_duration;
            scope_type   = type || tpl.scope_type;
        } else {
            // disparo ad hoc (sem template)
            const { title: t, description: d, effect } = req.body;
            if (!t || !effect?.kind || effect?.value === undefined || !effect?.duration_hours) {
                return res.status(400).json({ message: 'title, effect.kind, effect.value e effect.duration_hours são obrigatórios.' });
            }
            title        = t;
            description  = d || '';
            effect_kind  = effect.kind;
            effect_value = Number(effect.value);
            final_duration = Number(effect.duration_hours);
            scope_type   = type || 'global';
        }

        if (final_duration <= 0) {
            return res.status(400).json({ message: 'Duração deve ser maior que 0.' });
        }
        if (scope_type === 'faction' && !affected_faction) {
            return res.status(400).json({ message: 'affected_faction é obrigatório para escopo de facção.' });
        }

        const { start_at: startAtRaw } = req.body;
        const start_at = startAtRaw ? new Date(startAtRaw) : null;
        const baseTime = start_at || new Date();
        const active_until = new Date(baseTime.getTime() + final_duration * 3_600_000);

        const encounter = await RandomEncounter.create({
            template_id:      template_id || null,
            title,
            description,
            type:             scope_type,
            affected_faction: scope_type === 'faction' ? affected_faction : null,
            effect: {
                kind:           effect_kind,
                value:          effect_value,
                duration_hours: final_duration,
            },
            active:       true,
            triggered_by: req.user.id,
            start_at,
            active_until,
        });

        res.status(201).json(encounter);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao acionar evento.', error: err.message });
    }
};

// PATCH /api/encounters/:id (admin)
exports.editEncounter = async (req, res) => {
    try {
        const encounter = await RandomEncounter.findById(req.params.id);
        if (!encounter) return res.status(404).json({ message: 'Encontro não encontrado.' });

        const { active_until, start_at } = req.body;
        if (active_until) encounter.active_until = new Date(active_until);
        if (start_at !== undefined) encounter.start_at = start_at ? new Date(start_at) : null;

        await encounter.save();
        res.json(encounter);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao editar evento.', error: err.message });
    }
};

// DELETE /api/encounters/:id (admin)
exports.deactivateEncounter = async (req, res) => {
    try {
        const encounter = await RandomEncounter.findById(req.params.id);
        if (!encounter) return res.status(404).json({ message: 'Encontro não encontrado.' });

        encounter.active = false;
        await encounter.save();

        res.json({ message: 'Evento encerrado antecipadamente.', encounter });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao encerrar evento.', error: err.message });
    }
};

// GET /api/encounters/active
exports.getActiveEncounters = async (req, res) => {
    try {
        const now = new Date();
        const baseQuery = { active: true, active_until: { $gt: now } };

        // Admin sees all active encounters regardless of faction or schedule
        if (req.user.role === 'admin') {
            const encounters = await RandomEncounter.find(baseQuery).sort({ start_at: 1, createdAt: -1 });
            return res.json(encounters);
        }

        const player = await User.findById(req.user.id).select('faction');
        const encounters = await RandomEncounter.find({
            ...baseQuery,
            $and: [
                { $or: [{ start_at: null }, { start_at: { $lte: now } }] },
                { $or: [{ type: 'global' }, { type: 'faction', affected_faction: player.faction }] },
            ],
        }).sort({ createdAt: -1 });

        res.json(encounters);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar eventos ativos.', error: err.message });
    }
};
