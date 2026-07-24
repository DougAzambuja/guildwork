const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/eventTemplateController');

const checkAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'Acesso restrito ao Mestre da Guilda.' });
};

router.use(auth);
router.use(checkAdmin);

router.get('/',    ctrl.listTemplates);
router.post('/',   ctrl.createTemplate);
router.patch('/:id', ctrl.updateTemplate);
router.delete('/:id', ctrl.deleteTemplate);

module.exports = router;
