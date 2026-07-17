const router         = require('express').Router();
const lootController = require('../controllers/lootController');
const authMiddleware = require('../middleware/auth');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.use(authMiddleware);

router.get('/',        lootController.getItems);
router.post('/',       checkAdmin, lootController.createItem);
router.put('/:id',     checkAdmin, lootController.updateItem);
router.delete('/:id',  checkAdmin, lootController.deleteItem);

module.exports = router;
