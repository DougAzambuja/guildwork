const router            = require('express').Router();
const sprintController  = require('../controllers/sprintController');
const authMiddleware    = require('../middleware/auth');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.use(authMiddleware);

// Leitura — qualquer usuário autenticado (dashboard do jogador pode consumir)
router.get('/',              sprintController.getSprints);
router.get('/active',        sprintController.getActiveSprint);
router.get('/:id/burndown',  sprintController.getSprintBurndown);
router.get('/:id',           sprintController.getSprintById);

// Escrita — admin only
router.post('/',                          checkAdmin, sprintController.createSprint);
router.patch('/:id',                      checkAdmin, sprintController.updateSprint);
router.delete('/:id',                     checkAdmin, sprintController.deleteSprint);
router.post('/:id/quests',                checkAdmin, sprintController.addQuestsToSprint);
router.delete('/:id/quests/:questId',     checkAdmin, sprintController.removeQuestFromSprint);

module.exports = router;
