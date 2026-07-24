const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/encounterController');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.use(auth);

router.post('/trigger', checkAdmin, ctrl.triggerEncounter);
router.patch('/:id',    checkAdmin, ctrl.editEncounter);
router.delete('/:id',   checkAdmin, ctrl.deactivateEncounter);
router.get('/active',              ctrl.getActiveEncounters);

module.exports = router;
