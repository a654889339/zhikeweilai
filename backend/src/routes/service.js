const { Router } = require('express');
const serviceController = require('../controllers/serviceController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/', serviceController.list);
router.get('/admin/list', authMiddleware, adminMiddleware, serviceController.adminList);
router.get('/:id', serviceController.detail);
router.post('/', authMiddleware, adminMiddleware, serviceController.create);
router.put('/:id', authMiddleware, adminMiddleware, serviceController.update);
router.delete('/:id', authMiddleware, adminMiddleware, serviceController.remove);

module.exports = router;
