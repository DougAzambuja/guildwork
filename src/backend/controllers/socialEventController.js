const SocialEvent = require('../models/socialEvent');
const User        = require('../models/user');

// GET /api/social-events
exports.getEvents = async (req, res) => {
    try {
        const now = new Date();
        const player = req.user.role !== 'admin'
            ? await User.findById(req.user.id).select('faction')
            : null;

        const query = { is_active: true };

        if (player) {
            query.$or = [{ faction: null }, { faction: player.faction }];
        }

        const events = await SocialEvent.find(query)
            .sort({ event_date: 1 })
            .lean();

        // is_past usa display_until se definido, senão event_date
        const enriched = events.map(e => ({
            ...e,
            is_past: (e.display_until ?? e.event_date) < now,
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar eventos sociais.', error: err.message });
    }
};

// POST /api/social-events
exports.createEvent = async (req, res) => {
    try {
        const { title, description, event_date, display_until, faction } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ message: 'title é obrigatório.' });
        }
        if (!event_date) {
            return res.status(400).json({ message: 'event_date é obrigatório.' });
        }

        const event = await SocialEvent.create({
            title:         title.trim(),
            description:   description?.trim() || '',
            event_date:    new Date(event_date),
            display_until: display_until ? new Date(display_until) : null,
            faction:       faction || null,
            created_by:    req.user.id,
        });

        res.status(201).json(event);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao criar evento social.', error: err.message });
    }
};

// PATCH /api/social-events/:id
exports.editEvent = async (req, res) => {
    try {
        const event = await SocialEvent.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Evento não encontrado.' });

        const { title, description, event_date, display_until, faction } = req.body;

        if (title !== undefined)         event.title         = title.trim();
        if (description !== undefined)   event.description   = description.trim();
        if (event_date !== undefined)    event.event_date    = new Date(event_date);
        if (display_until !== undefined) event.display_until = display_until ? new Date(display_until) : null;
        if (faction !== undefined)       event.faction       = faction || null;

        await event.save();
        res.json(event);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao editar evento social.', error: err.message });
    }
};

// DELETE /api/social-events/:id
exports.deleteEvent = async (req, res) => {
    try {
        const event = await SocialEvent.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Evento não encontrado.' });

        event.is_active = false;
        await event.save();

        res.json({ message: 'Evento removido.', event });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao remover evento social.', error: err.message });
    }
};
