const { Router } = require('express');
const multer = require('multer');
const authController = require('../controllers/authController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();

router.post('/send-code', authController.sendCode);
router.post('/send-sms-code', authController.sendSmsCode);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/bind-phone', authMiddleware, authController.bindPhone);
router.post('/wx-login', authController.wxLogin);
router.post('/alipay-login', authController.alipayLogin);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/upload-avatar', authMiddleware, upload.single('avatar'), authController.uploadAvatar);
router.get('/admin/users', authMiddleware, adminMiddleware, authController.adminGetUsers);
router.delete('/admin/users/:userId/products/:productKey', authMiddleware, adminMiddleware, authController.adminUnbindProduct);
router.get('/my-products', authMiddleware, authController.myProducts);
router.post('/bind-product', authMiddleware, authController.bindProduct);
router.post('/bind-by-qr-image', authMiddleware, upload.single('image'), authController.bindByQrImage);

module.exports = router;
