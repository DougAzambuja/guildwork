const router           = require('express').Router();
const playerController = require('../controllers/playerController');
const authMiddleware   = require('../middleware/auth');

// Todas as rotas de player exigem token
router.use(authMiddleware);

router.get('/me',      playerController.getMe);
router.put('/me',      playerController.updateMe);
router.post('/xp',     playerController.addXP);
router.put('/curse',   playerController.updateCurse);

module.exports = router;