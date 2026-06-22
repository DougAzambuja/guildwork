const User = require('../models/User');
const LootItem = require('../models/LootItem');

const MAX_XP = 10000;

// GET /api/players/profile — retorna os dados do jogador logado
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PUT /api/players/profile — atualiza perfil (nome, avatar)
exports.updateProfile = async (req, res) => {
    try {
        const { nome, avatar_url } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { nome, avatar_url },
            { returnDocument: 'after' }
        ).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PUT /api/players/gamification — Atualiza XP, Moedas e Quests completadas
exports.updateGamification = async (req, res) => {
    try {
        const { xp = 0, coins = 0 } = req.body;
        const user = await User.findById(req.user.id);

        user.xp += xp;
        user.coins += coins;
        
        // Se a rota foi chamada, significa que ele concluiu uma task
        user.quests_completed = (user.quests_completed || 0) + 1;

        // Lógica de Level Up
        if (user.xp >= MAX_XP) {
            user.xp -= MAX_XP;
            user.level += 1;
        }

        await user.save();
        
        // Devolve o estado exato do banco para o Front-end sincronizar a tela
        res.json({ 
            xp: user.xp, 
            coins: user.coins, 
            level: user.level,
            quests_completed: user.quests_completed
        });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// PUT /api/players/curse — aplica ou remove maldição do SLA
exports.updateCurse = async (req, res) => {
    try {
        const isCursed = req.body.is_cursed !== undefined ? req.body.is_cursed : req.body.isCursed; // Front manda em CamelCase
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { is_cursed: isCursed }, // Banco salva em Snake_case
            { returnDocument: 'after' }
        ).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// POST /api/players/checkout — debita moedas com segurança consultando o banco
exports.checkout = async (req, res) => {
    try {
        const { items } = req.body; // Ignoramos o totalValue do front-end
        const user = await User.findById(req.user.id);

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'Carrinho vazio.' });
        }

        let realTotalValue = 0;

        // Calcula o valor real consultando a "fonte da verdade" (Banco de Dados)
        for (const cartItem of items) {
            const dbItem = await LootItem.findOne({ name: cartItem.name });
            if (!dbItem) {
                return res.status(404).json({ message: `Item ${cartItem.name} não encontrado na forja.` });
            }
            realTotalValue += (dbItem.price * cartItem.quantity);
        }

        // Validação back-end: Impede que o jogador burle o front-end
        if (user.coins < realTotalValue) {
            return res.status(400).json({ message: 'Gold insuficiente. A guilda detectou uma anomalia.' });
        }

        user.coins -= realTotalValue;
        await user.save();
        
        res.json({ message: 'Compra processada com segurança.', updatedCoins: user.coins });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};

// GET /api/players — Roster (Lista todos os usuários para a tabela do Admin)
exports.getAllPlayers = async (req, res) => {
    try {
        // Traz todos, mas não expõe a senha
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Erro interno.', error: err.message });
    }
};