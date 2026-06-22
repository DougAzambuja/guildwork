const router          = require('express').Router();
const questController = require('../controllers/questController');
const authMiddleware  = require('../middleware/auth');

// Protege todas as rotas de quests
router.use(authMiddleware);

router.get('/',          questController.getQuests);
router.post('/complete', questController.completeQuest);

module.exports = router;