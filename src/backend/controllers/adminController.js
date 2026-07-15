const User = require('../models/user');
const LootItem = require('../models/lootItem');
const Quest = require('../models/quest');

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
        const { title, type, xp_reward, coin_reward, sla_seconds, faction } = req.body;

        const quest = await Quest.create({
            title,
            type,
            xp_reward,
            coin_reward,
            sla_seconds,
            faction: faction || 'Produto'
        });
        
        res.status(201).json(quest);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao forjar quest.', error: err.message });
    }
};

exports.getRoster = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar roster.', error: err.message });
    }
};

// PATCH /api/admin/roster/:id — Admin edita dados de um funcionário
exports.updateUser = async (req, res) => {
    try {
        const { nome, faction, role, password } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

        if (nome)    user.nome    = nome;
        if (faction) user.faction = faction;
        if (role)    user.role    = role;
        if (password && password.trim().length >= 6) {
            user.password = password; // pre-save hook faz o hash
        }

        await user.save();
        const updated = user.toObject();
        delete updated.password;
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao editar usuário.', error: err.message });
    }
};

// GET /api/admin/quests — Lista todas as missões com atribuição
exports.getQuests = async (req, res) => {
    try {
        const quests = await Quest.find()
            .populate('assigned_to', 'nome username')
            .sort({ createdAt: -1 });
        res.json(quests);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar pergaminhos (quests).', error: err.message });
    }
};

// PATCH /api/admin/quests/:id/assign — Admin atribui uma quest a um jogador
exports.assignQuest = async (req, res) => {
    try {
        const { userId } = req.body;
        const quest = await Quest.findById(req.params.id);

        if (!quest) return res.status(404).json({ message: 'Quest não encontrada.' });

        if (userId && quest.status !== 'todo') {
            return res.status(400).json({ message: 'Só é possível atribuir quests disponíveis (status: todo).' });
        }

        if (userId) {
            quest.assigned_to = userId;
            quest.status      = 'in_progress';
            quest.started_at  = new Date();
        } else {
            quest.assigned_to = null;
            quest.status      = 'todo';
            quest.started_at  = null;
        }

        await quest.save();
        const populated = await quest.populate('assigned_to', 'nome username');
        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atribuir quest.', error: err.message });
    }
};
