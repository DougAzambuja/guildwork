const EventTemplate = require('../models/eventTemplate');

const VALID_EFFECT_KINDS = ['xp_bonus', 'gold_bonus', 'xp_penalty', 'gold_penalty', 'slow', 'luck', 'store_discount'];

// GET /api/event-templates (admin)
exports.listTemplates = async (req, res) => {
    try {
        const templates = await EventTemplate.find().sort({ createdAt: -1 });
        res.json(templates);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao listar templates.', error: err.message });
    }
};

// POST /api/event-templates (admin)
exports.createTemplate = async (req, res) => {
    try {
        const { title, description, effect_kind, default_value, default_duration, scope_type } = req.body;

        if (!title || !effect_kind || default_value === undefined || !default_duration) {
            return res.status(400).json({ message: 'title, effect_kind, default_value e default_duration são obrigatórios.' });
        }
        if (!VALID_EFFECT_KINDS.includes(effect_kind)) {
            return res.status(400).json({ message: `effect_kind inválido. Válidos: ${VALID_EFFECT_KINDS.join(', ')}.` });
        }
        if (Number(default_duration) < 1) {
            return res.status(400).json({ message: 'default_duration deve ser >= 1 hora.' });
        }
        if (Number(default_value) <= 0 || Number(default_value) > 1) {
            return res.status(400).json({ message: 'default_value deve ser entre 0 e 1 (ex: 0.5 = 50%).' });
        }

        const template = await EventTemplate.create({
            title,
            description:      description || '',
            effect_kind,
            default_value:    Number(default_value),
            default_duration: Number(default_duration),
            scope_type:       scope_type || 'global',
            created_by:       req.user.id,
        });

        res.status(201).json(template);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao criar template.', error: err.message });
    }
};

// PATCH /api/event-templates/:id (admin)
exports.updateTemplate = async (req, res) => {
    try {
        const { title, description, effect_kind, default_value, default_duration, scope_type } = req.body;
        const updates = {};

        if (title          !== undefined) updates.title          = title;
        if (description    !== undefined) updates.description    = description;
        if (effect_kind    !== undefined) updates.effect_kind    = effect_kind;
        if (scope_type     !== undefined) updates.scope_type     = scope_type;

        if (default_value !== undefined) {
            if (Number(default_value) <= 0 || Number(default_value) > 1) {
                return res.status(400).json({ message: 'default_value deve ser entre 0 e 1 (ex: 0.5 = 50%).' });
            }
            updates.default_value = Number(default_value);
        }
        if (default_duration !== undefined) {
            if (Number(default_duration) < 1) {
                return res.status(400).json({ message: 'default_duration deve ser >= 1 hora.' });
            }
            updates.default_duration = Number(default_duration);
        }

        const template = await EventTemplate.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!template) return res.status(404).json({ message: 'Template não encontrado.' });
        res.json(template);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atualizar template.', error: err.message });
    }
};

// DELETE /api/event-templates/:id (admin)
exports.deleteTemplate = async (req, res) => {
    try {
        const template = await EventTemplate.findByIdAndDelete(req.params.id);
        if (!template) return res.status(404).json({ message: 'Template não encontrado.' });
        res.json({ message: 'Template removido.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao remover template.', error: err.message });
    }
};
