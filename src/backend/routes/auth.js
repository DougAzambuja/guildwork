const router = require('express').Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const checkAdminRole = (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso negado.' });
};

router.post('/login', authController.login);
router.post('/register', authMiddleware, checkAdminRole, authController.register);

module.exports = router;
