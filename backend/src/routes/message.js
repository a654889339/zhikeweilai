const { Router } = require('express');
const multer = require('multer');
const ctrl = require('../controllers/messageController');
const { authMiddleware: auth, adminMiddleware: adminOnly } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

// ===== 用户端接口（需登录） =====
router.get('/mine', auth, ctrl.myMessages);           // 获取我的聊天记录
router.post('/send', auth, ctrl.send);                 // 发送消息给客服
router.post('/upload-image', auth, upload.single('image'), ctrl.uploadImage); // 上传聊天图片
router.get('/unread', auth, ctrl.unreadCount);         // 获取未读消息数

// ===== 管理员接口（需登录 + 管理员权限） =====
router.get('/admin/conversations', auth, adminOnly, ctrl.adminConversations);  // 会话列表
router.get('/admin/:userId', auth, adminOnly, ctrl.adminGetMessages);          // 查看用户聊天记录
router.post('/admin/:userId/reply', auth, adminOnly, ctrl.adminReply);         // 回复用户

module.exports = router;
