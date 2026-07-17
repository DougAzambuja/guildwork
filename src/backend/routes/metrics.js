const router            = require('express').Router();
const metricsController = require('../controllers/metricsController');
const authMiddleware    = require('../middleware/auth');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.use(authMiddleware);
router.use(checkAdmin);

router.get('/', metricsController.getAllMetrics);

module.exports = router;
