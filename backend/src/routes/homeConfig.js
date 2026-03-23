const { Router } = require('express');
const multer = require('multer');
const ctrl = require('../controllers/homeConfigController');
const { authMiddleware: auth, adminMiddleware: adminOnly } = require('../middleware/auth');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', ctrl.list);
router.post('/', auth, adminOnly, ctrl.create);

// 图片上传 - 必须在 /:id 路由之前
router.post('/upload', auth, adminOnly, upload.single('file'), ctrl.uploadImage);

router.put('/:id', auth, adminOnly, ctrl.update);
router.delete('/:id', auth, adminOnly, ctrl.remove);

module.exports = router;
