const express         = require('express');
const router          = express.Router();
const auth            = require('../middleware/auth');
const guildController = require('../controllers/guildController');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.get('/all',      auth, checkAdmin, guildController.getAllGuilds);
router.get('/',         auth, guildController.getGuild);
router.post('/spend',   auth, guildController.spendTreasury);
router.patch('/leader', auth, checkAdmin, guildController.setLeader);

module.exports = router;
