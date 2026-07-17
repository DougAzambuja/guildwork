const router          = require('express').Router();
const questController = require('../controllers/questController');
const authMiddleware  = require('../middleware/auth');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.use(authMiddleware);

// — Rotas do Jogador —
router.get('/',           questController.getQuests);
router.patch('/:id/move', questController.moveQuest);
router.post('/complete',  questController.completeQuest);

// — Rotas Admin —
router.get('/all',           checkAdmin, questController.adminGetQuests);
router.post('/',             checkAdmin, questController.adminCreateQuest);
router.patch('/:id/assign',  checkAdmin, questController.adminAssignQuest);

module.exports = router;
