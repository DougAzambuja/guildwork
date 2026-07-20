const router = require('express').Router();
const playerController = require('../controllers/playerController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/me',          playerController.getProfile);
router.put('/me',          playerController.updateProfile);
router.get('/leaderboard', playerController.getLeaderboard);
router.get('/:id/public',  playerController.getPublicProfile);
router.post('/xp',      playerController.updateGamification);
router.put('/curse',    playerController.updateCurse);
router.post('/checkout',       playerController.checkout);
router.put('/equip-cosmetic',  playerController.equipCosmetic);

module.exports = router;
