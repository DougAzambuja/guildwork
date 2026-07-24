const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/socialEventController');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.use(auth);

router.get('/',     ctrl.getEvents);
router.post('/',    checkAdmin, ctrl.createEvent);
router.patch('/:id', checkAdmin, ctrl.editEvent);
router.delete('/:id', checkAdmin, ctrl.deleteEvent);

module.exports = router;
