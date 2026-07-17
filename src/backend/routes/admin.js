const router          = require('express').Router();
const adminController = require('../controllers/adminController');
const authMiddleware  = require('../middleware/auth');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso negado.' });
};

router.use(authMiddleware);
router.use(checkAdmin);

router.get('/roster',       adminController.getRoster);
router.patch('/roster/:id', adminController.updateUser);

module.exports = router;
