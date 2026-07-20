const LootItem = require('../models/lootItem');

/**
 * GET /api/loot
 * Lista todos os itens disponíveis. Acessível a qualquer usuário autenticado (vitrine da loja).
 */
exports.getItems = async (req, res) => {
    try {
        const items = await LootItem.find().sort({ price: 1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar itens.', error: err.message });
    }
};

/**
 * POST /api/loot
 * Admin cria novo item na forja.
 */
exports.createItem = async (req, res) => {
    try {
        const { name, price, image_url, is_cosmetic } = req.body;

        if (!name || !price) {
            return res.status(400).json({ message: 'Nome e preço são obrigatórios.' });
        }

        const item = await LootItem.create({
            name,
            price,
            image:       image_url || 'assets/imgs/caneca_pixel.jpg',
            is_cosmetic: !!is_cosmetic
        });

        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao criar item.', error: err.message });
    }
};

/**
 * PUT /api/loot/:id
 * Admin edita nome e preço de um item existente.
 */
exports.updateItem = async (req, res) => {
    try {
        const { name, price } = req.body;

        const item = await LootItem.findByIdAndUpdate(
            req.params.id,
            { name, price },
            { new: true, runValidators: true }
        );

        if (!item) return res.status(404).json({ message: 'Item não encontrado.' });

        res.json(item);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atualizar item.', error: err.message });
    }
};

/**
 * DELETE /api/loot/:id
 * Admin remove item do catálogo.
 */
exports.deleteItem = async (req, res) => {
    try {
        const item = await LootItem.findByIdAndDelete(req.params.id);

        if (!item) return res.status(404).json({ message: 'Item não encontrado.' });

        res.json({ message: 'Item removido com sucesso.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao remover item.', error: err.message });
    }
};
