const router                 = require('express').Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware         = require('../middleware/auth');

router.use(authMiddleware);

router.get('/',           notificationController.getNotifications);
router.patch('/read-all', notificationController.markAllRead);    // DEVE vir antes de /:id/read
router.patch('/:id/read', notificationController.markRead);

module.exports = router;
