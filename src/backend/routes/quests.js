const router          = require('express').Router();
const questController = require('../controllers/questController');
const authMiddleware  = require('../middleware/auth');

router.use(authMiddleware);

router.get('/',           questController.getQuests);
router.patch('/:id/move', questController.moveQuest);
router.post('/complete',  questController.completeQuest);

module.exports = router;
