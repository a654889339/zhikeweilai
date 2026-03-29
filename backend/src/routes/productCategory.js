const { Router } = require('express');
const multer = require('multer');
const productCategoryController = require('../controllers/productCategoryController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.get('/', authMiddleware, adminMiddleware, productCategoryController.list);
router.post('/', authMiddleware, adminMiddleware, productCategoryController.create);
router.put('/:id', authMiddleware, adminMiddleware, productCategoryController.update);
router.delete('/:id', authMiddleware, adminMiddleware, productCategoryController.remove);
router.post('/upload', authMiddleware, adminMiddleware, upload.single('file'), productCategoryController.uploadThumb);

module.exports = router;
