const express                  = require('express');
const router                   = express.Router();
const auth                     = require('../middleware/auth');
const guildController          = require('../controllers/guildController');
const kanbanColumnController   = require('../controllers/kanbanColumnController');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.get('/all',      auth, checkAdmin, guildController.getAllGuilds);
router.get('/',         auth, guildController.getGuild);
router.post('/spend',   auth, guildController.spendTreasury);
router.patch('/leader', auth, checkAdmin, guildController.setLeader);

// Colunas do kanban
router.get('/columns',                  auth, kanbanColumnController.getColumns);
router.post('/columns',                 auth, kanbanColumnController.createColumn);
router.patch('/columns/reorder',        auth, kanbanColumnController.reorderColumns);
router.patch('/columns/:col_id',        auth, kanbanColumnController.updateColumn);
router.delete('/columns/:col_id',       auth, kanbanColumnController.deleteColumn);

module.exports = router;
