const { Router } = require('express');
const productCategoryController = require('../controllers/productCategoryController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/', authMiddleware, adminMiddleware, productCategoryController.list);
router.post('/', authMiddleware, adminMiddleware, productCategoryController.create);
router.put('/:id', authMiddleware, adminMiddleware, productCategoryController.update);
router.delete('/:id', authMiddleware, adminMiddleware, productCategoryController.remove);

module.exports = router;
