const router = require('express').Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// 1. Barreira Primária: Exige token válido
router.use(authMiddleware);

// ==========================================
// BARREIRA SECUNDÁRIA (Apenas Admin)
// ==========================================
const checkAdminRole = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ message: 'Acesso negado.' });
};

// ==========================================
// ROTAS DE LOOT (Padronizado para /loot)
// ==========================================
// Rotas que o Front-end espera:
router.get('/loot', adminController.getInventory); // Front chama /admin/loot
router.post('/loot', checkAdminRole, adminController.createInventoryItem);
router.put('/loot/:id', checkAdminRole, adminController.updateInventoryItem);
router.delete('/loot/:id', checkAdminRole, adminController.deleteInventoryItem);

// ==========================================
// ROTAS DE QUESTS
// ==========================================
router.post('/quests', checkAdminRole, adminController.createQuest);

// ==========================================
// ROTAS DE USUÁRIOS
// ==========================================
router.get('/roster', checkAdminRole, adminController.getRoster);

// ROTAS DE QUESTS
router.get('/quests', checkAdminRole, adminController.getQuests); // Adicione esta linha!
router.post('/quests', checkAdminRole, adminController.createQuest);

module.exports = router;