const router               = require('express').Router();
const questController      = require('../controllers/questController');
const authMiddleware       = require('../middleware/auth');
const isAdminOrGuildLeader = require('../middleware/isAdminOrGuildLeader');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.use(authMiddleware);

// — Rotas do Jogador —
router.get('/',                  questController.getQuests);
router.patch('/:id/move',        questController.moveQuest);
router.patch('/:id/move-column', questController.moveQuestToColumn);
router.post('/complete',         questController.completeQuest);

// — Rotas Admin —
router.get('/all',              checkAdmin, questController.adminGetQuests);
router.patch('/:id/transfer',   checkAdmin, questController.adminTransferQuest);
router.post('/:id/copy',        checkAdmin, questController.adminCopyQuest);
router.get('/:id/subtasks',     questController.getSubtasks);
router.post('/:id/subtasks',    isAdminOrGuildLeader, questController.createSubtask);
router.patch('/:id/subtasks',   checkAdmin, questController.updateSubtasks);

// — Rotas Admin ou Líder de Guilda (restrito à própria guilda — ver middleware) —
router.post('/',            isAdminOrGuildLeader, questController.adminCreateQuest);
router.patch('/:id/assign',  isAdminOrGuildLeader, questController.adminAssignQuest);
router.patch('/:id/column', isAdminOrGuildLeader, questController.moveQuestColumn);
router.patch('/:id',           isAdminOrGuildLeader, questController.adminUpdateQuest);
router.patch('/:id/checklist', isAdminOrGuildLeader, questController.updateChecklistItems);
router.delete('/:id',          isAdminOrGuildLeader, questController.deleteQuest);

// — Detalhe completo e checklist (admin + aventureiro autenticado) —
router.get('/:id',                         questController.getQuestDetail);
router.patch('/:id/checklist/:itemId',     questController.toggleChecklistItem);

// — Comentários (admin + aventureiro autenticado) —
router.get('/:id/comments',  questController.getComments);
router.post('/:id/comments', questController.addComment);

module.exports = router;
