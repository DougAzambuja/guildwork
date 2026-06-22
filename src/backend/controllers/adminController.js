const User = require('../models/User');
const LootItem = require('../models/LootItem');
const Quest = require('../models/Quest');

// GET /api/admin/inventory — Lista todos os itens da loja para a vitrine
exports.getInventory = async (req, res) => {
    try {
        const items = await LootItem.find();
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/admin/inventory — Cria novo item na forja
exports.createInventoryItem = async (req, res) => {
    try {
        // 1. Recebemos o 'image_url' do seu admin.js (Front-end)
        const { name, price, image_url } = req.body; 
        
        const item = await LootItem.create({ 
            name, 
            price, 
            // 2. Gravamos na coluna 'image' (que é o que o MongoDB espera)
            image: image_url || 'assets/imgs/caneca_pixel.jpg' 
        });
        
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno ao forjar.', error: err.message });
    }
};

// PUT /api/admin/inventory/:id — Edita item existente
exports.updateInventoryItem = async (req, res) => {
    try {
        const { name, price } = req.body;
        const item = await LootItem.findByIdAndUpdate(
            req.params.id,
            { name, price },
            { returnDocument: 'after' } // Retorna o documento já atualizado
        );
        res.json(item);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno ao atualizar.', error: err.message });
    }
};

// DELETE /api/admin/inventory/:id — Remove item da loja
exports.deleteInventoryItem = async (req, res) => {
    try {
        // Exclusão física para limpar o catálogo
        await LootItem.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item removido com sucesso pelo fogo do dragão.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro interno ao excluir.', error: err.message });
    }
};

// POST /api/admin/quests — Cria nova quest
exports.createQuest = async (req, res) => {
    try {
        const { title, type, xp_reward, coin_reward, sla_seconds } = req.body;
        
        const quest = await Quest.create({ 
            title, 
            type, 
            xp_reward, 
            coin_reward, 
            sla_seconds
        });
        
        res.status(201).json(quest);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao forjar quest.', error: err.message });
    }
};

exports.getRoster = async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Busca todos sem a senha
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar roster.', error: err.message });
    }
};

// GET /api/admin/quests — Lista todas as missões forjadas
exports.getQuests = async (req, res) => {
    try {
        const quests = await Quest.find();
        res.json(quests);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar pergaminhos (quests).', error: err.message });
    }
};
