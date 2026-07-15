const router = require('express').Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

const checkAdminRole = (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso negado.' });
};

// LOOT
router.get('/loot',         adminController.getInventory);
router.post('/loot',        checkAdminRole, adminController.createInventoryItem);
router.put('/loot/:id',     checkAdminRole, adminController.updateInventoryItem);
router.delete('/loot/:id',  checkAdminRole, adminController.deleteInventoryItem);

// QUESTS
router.get('/quests',              checkAdminRole, adminController.getQuests);
router.post('/quests',             checkAdminRole, adminController.createQuest);
router.patch('/quests/:id/assign', checkAdminRole, adminController.assignQuest);

// USUÁRIOS
router.get('/roster',         checkAdminRole, adminController.getRoster);
router.patch('/roster/:id',   checkAdminRole, adminController.updateUser);

module.exports = router;
