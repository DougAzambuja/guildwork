const User     = require('../models/User');
const LootItem = require('../models/LootItem');
const Quest    = require('../models/Quest');

// GET /api/admin/roster — lista todos os usuários
exports.getRoster = async (req, res) => {
    try {
        const users = await User.find({ role: 'adventurer' })
            .select('-password')
            .sort({ xp: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// GET /api/admin/loot — lista todos os itens da loja
exports.getLoot = async (req, res) => {
    try {
        const items = await LootItem.find({ is_active: true });
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/admin/loot — cria novo item
exports.createLoot = async (req, res) => {
    try {
        const { name, price, image_url } = req.body;
        const item = await LootItem.create({ 
            name, price, image_url, 
            created_by: req.user.id 
        });
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PUT /api/admin/loot/:id — edita item
exports.updateLoot = async (req, res) => {
    try {
        const { name, price } = req.body;
        const item = await LootItem.findByIdAndUpdate(
            req.params.id,
            { name, price },
            { new: true }
        );
        res.json(item);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// DELETE /api/admin/loot/:id — remove item
exports.deleteLoot = async (req, res) => {
    try {
        await LootItem.findByIdAndUpdate(req.params.id, { is_active: false });
        res.json({ message: 'Item removido com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};