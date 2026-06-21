const router          = require('express').Router();
const adminController = require('../controllers/adminController');
const authMiddleware  = require('../middleware/auth');

// Middleware que verifica se é admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito ao administrador.' });
    }
    next();
};

router.use(authMiddleware);
router.use(isAdmin);

router.get('/roster',       adminController.getRoster);
router.get('/loot',         adminController.getLoot);
router.post('/loot',        adminController.createLoot);
router.put('/loot/:id',     adminController.updateLoot);
router.delete('/loot/:id',  adminController.deleteLoot);

module.exports = router;