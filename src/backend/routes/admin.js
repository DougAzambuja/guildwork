const router = require('express').Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// 1. Barreira Primária: Exige token válido (Qualquer pessoa logada passa)
router.use(authMiddleware);

// ==========================================
// ROTA PÚBLICA (Vitrine da Loja)
// ==========================================
// Aventureiros podem ver o catálogo
router.get('/inventory', adminController.getInventory);

// ==========================================
// BARREIRA SECUNDÁRIA (Apenas Admin)
// ==========================================
const checkAdminRole = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ message: 'Acesso negado. Apenas o Mestre da Guilda possui essa chave.' });
};

// As rotas abaixo passam por duas catracas: Tem token? E esse token é de admin?
router.post('/inventory', checkAdminRole, adminController.createInventoryItem);
router.put('/inventory/:id', checkAdminRole, adminController.updateInventoryItem);
router.delete('/inventory/:id', checkAdminRole, adminController.deleteInventoryItem);
router.post('/quests', checkAdminRole, adminController.createQuest);

module.exports = router;