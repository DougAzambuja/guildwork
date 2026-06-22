const router = require('express').Router();
const playerController = require('../controllers/playerController');
const authMiddleware = require('../middleware/auth'); // Protege as rotas

// Todas as rotas abaixo desta linha exigem que o usuário envie o Token JWT válido
router.use(authMiddleware);

// Roster Geral
router.get('/', playerController.getAllPlayers);

// Perfil Pessoal
router.get('/profile', playerController.getProfile);
router.put('/profile', playerController.updateProfile);

// Gamificação e Ações
router.put('/gamification', playerController.updateGamification);
router.put('/curse', playerController.updateCurse);
router.post('/checkout', playerController.checkout);

module.exports = router;