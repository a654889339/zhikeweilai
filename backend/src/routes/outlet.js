const { Router } = require('express');
const multer = require('multer');
const { outletAuthMiddleware: auth } = require('../middleware/outletAuth');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const outletAuthCtrl = require('../controllers/outletAuthController');
const outletOrderCtrl = require('../controllers/outletOrderController');
const outletHomeConfigCtrl = require('../controllers/outletHomeConfigController');
const outletMsgCtrl = require('../controllers/outletMessageController');
const outletAddrCtrl = require('../controllers/outletAddressController');
const outletServiceCtrl = require('../controllers/outletServiceController');
const outletServiceCategoryCtrl = require('../controllers/outletServiceCategoryController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

// ===== Auth =====
router.post('/auth/send-code', outletAuthCtrl.sendCode);
router.post('/auth/send-sms-code', outletAuthCtrl.sendSmsCode);
router.post('/auth/register', outletAuthCtrl.register);
router.post('/auth/login', outletAuthCtrl.login);
router.get('/auth/profile', auth, outletAuthCtrl.getProfile);
router.put('/auth/profile', auth, outletAuthCtrl.updateProfile);
router.post('/auth/avatar', auth, upload.single('avatar'), outletAuthCtrl.uploadAvatar);
router.post('/auth/bind-phone', auth, outletAuthCtrl.bindPhone);

// ===== Orders (outlet user) =====
router.post('/orders', auth, outletOrderCtrl.create);
router.get('/orders/mine', auth, outletOrderCtrl.myOrders);
router.get('/orders/:id', auth, outletOrderCtrl.detail);
router.put('/orders/:id/cancel', auth, outletOrderCtrl.cancel);

// ===== Addresses (outlet user) =====
router.get('/addresses', auth, outletAddrCtrl.list);
router.post('/addresses', auth, outletAddrCtrl.create);
router.put('/addresses/:id', auth, outletAddrCtrl.update);
router.delete('/addresses/:id', auth, outletAddrCtrl.remove);
router.put('/addresses/:id/default', auth, outletAddrCtrl.setDefault);

// ===== HomeConfig (public list, admin write) =====
router.get('/home-config', outletHomeConfigCtrl.list);
router.post('/home-config', authMiddleware, adminMiddleware, outletHomeConfigCtrl.create);
router.post('/home-config/upload', authMiddleware, adminMiddleware, upload.single('file'), outletHomeConfigCtrl.uploadImage);
router.put('/home-config/:id', authMiddleware, adminMiddleware, outletHomeConfigCtrl.update);
router.delete('/home-config/:id', authMiddleware, adminMiddleware, outletHomeConfigCtrl.remove);

// ===== Services (outlet) =====
// 前台使用：服务商前端只访问这些接口
router.get('/service-categories', outletServiceCategoryCtrl.list);
router.get('/services', outletServiceCtrl.list);

// 后台管理：服务配置（服务商/分销商管理下）
router.get('/services/admin/list', authMiddleware, adminMiddleware, outletServiceCtrl.adminList);
router.post('/service-categories', authMiddleware, adminMiddleware, outletServiceCategoryCtrl.create);
router.put('/service-categories/:id', authMiddleware, adminMiddleware, outletServiceCategoryCtrl.update);
router.delete('/service-categories/:id', authMiddleware, adminMiddleware, outletServiceCategoryCtrl.remove);
router.post('/services', authMiddleware, adminMiddleware, outletServiceCtrl.create);
router.put('/services/:id', authMiddleware, adminMiddleware, outletServiceCtrl.update);
router.delete('/services/:id', authMiddleware, adminMiddleware, outletServiceCtrl.remove);

// ===== Messages (outlet user) =====
router.get('/messages/mine', auth, outletMsgCtrl.myMessages);
router.post('/messages/send', auth, outletMsgCtrl.send);
router.post('/messages/upload-image', auth, upload.single('image'), outletMsgCtrl.uploadImage);
router.get('/messages/unread', auth, outletMsgCtrl.unreadCount);

// ===== Admin endpoints (for admin panel managing outlet) =====
router.get('/admin/users', authMiddleware, adminMiddleware, outletAuthCtrl.adminGetUsers);
router.get('/admin/users/:id/detail', authMiddleware, adminMiddleware, outletAuthCtrl.adminGetUserDetail);
router.get('/admin/orders', authMiddleware, adminMiddleware, outletOrderCtrl.adminList);
router.get('/admin/orders/stats', authMiddleware, adminMiddleware, outletOrderCtrl.adminStats);
router.put('/admin/orders/:id/status', authMiddleware, adminMiddleware, outletOrderCtrl.adminUpdateStatus);
router.put('/admin/orders/:id/price', authMiddleware, adminMiddleware, outletOrderCtrl.adminUpdatePrice);
router.post('/admin/orders/:id/remark', authMiddleware, adminMiddleware, outletOrderCtrl.adminAddRemark);
router.get('/admin/orders/:id/logs', authMiddleware, adminMiddleware, outletOrderCtrl.adminLogs);
router.get('/admin/messages/conversations', authMiddleware, adminMiddleware, outletMsgCtrl.adminConversations);
router.get('/admin/messages/:userId', authMiddleware, adminMiddleware, outletMsgCtrl.adminGetMessages);
router.post('/admin/messages/:userId/reply', authMiddleware, adminMiddleware, outletMsgCtrl.adminReply);

module.exports = router;
