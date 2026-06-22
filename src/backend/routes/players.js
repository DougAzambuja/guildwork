const router = require('express').Router();
const playerController = require('../controllers/playerController');
const authMiddleware = require('../middleware/auth');

// Barreira Primária: Exige token
router.use(authMiddleware);

// Roster Geral
router.get('/', playerController.getAllPlayers);

// Perfil Pessoal (O Front-end chama /me)
router.get('/me', playerController.getProfile);
router.put('/me', playerController.updateProfile);

// Gamificação e Ações (O Front-end chama /xp via POST)
router.post('/xp', playerController.updateGamification);
router.put('/curse', playerController.updateCurse);
router.post('/checkout', playerController.checkout);

module.exports = router;