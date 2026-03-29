const { Router } = require('express');
const multer = require('multer');
const ctrl = require('../controllers/chatGroupController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.get('/admin/list', authMiddleware, adminMiddleware, ctrl.adminListAll);
router.get('/mine', authMiddleware, ctrl.listMine);
router.post('/', authMiddleware, ctrl.create);
router.post('/:id/join', authMiddleware, ctrl.join);
router.get('/:id/messages', authMiddleware, ctrl.listMessages);
router.post('/:id/messages', authMiddleware, ctrl.sendMessage);
router.post('/:id/upload-image', authMiddleware, upload.single('image'), ctrl.uploadImage);

module.exports = router;
