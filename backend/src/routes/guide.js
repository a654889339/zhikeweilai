const { Router } = require('express');
const multer = require('multer');
const guideController = require('../controllers/guideController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router = Router();

router.get('/categories', guideController.categories);
router.get('/', guideController.list);
router.get('/admin/list', authMiddleware, adminMiddleware, guideController.adminList);
router.get('/:id', guideController.detail);
router.post('/admin', authMiddleware, adminMiddleware, guideController.create);
router.put('/admin/:id', authMiddleware, adminMiddleware, guideController.update);
router.delete('/admin/:id', authMiddleware, adminMiddleware, guideController.remove);
router.post('/admin/upload', authMiddleware, adminMiddleware, upload.single('file'), guideController.uploadFile);
router.post('/:id/qrcode', authMiddleware, adminMiddleware, guideController.generateQRCode);

module.exports = router;
