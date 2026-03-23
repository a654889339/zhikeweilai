const { Router } = require('express');
const serviceCategoryController = require('../controllers/serviceCategoryController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/', authMiddleware, adminMiddleware, serviceCategoryController.list);
router.post('/', authMiddleware, adminMiddleware, serviceCategoryController.create);
router.put('/:id', authMiddleware, adminMiddleware, serviceCategoryController.update);
router.delete('/:id', authMiddleware, adminMiddleware, serviceCategoryController.remove);

module.exports = router;
