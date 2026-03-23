const { Router } = require('express');
const orderController = require('../controllers/orderController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();

router.post('/', authMiddleware, orderController.create);
router.get('/mine', authMiddleware, orderController.myOrders);
router.post('/:id/pay-wechat', authMiddleware, orderController.payWechatPrepay);
router.get('/admin/list', authMiddleware, adminMiddleware, orderController.adminList);
router.get('/admin/stats', authMiddleware, adminMiddleware, orderController.adminStats);
router.get('/:id', authMiddleware, orderController.detail);
router.put('/:id/cancel', authMiddleware, orderController.cancel);
router.put('/admin/:id/status', authMiddleware, adminMiddleware, orderController.adminUpdateStatus);
router.put('/admin/:id/price', authMiddleware, adminMiddleware, orderController.adminUpdatePrice);
router.post('/admin/:id/remark', authMiddleware, adminMiddleware, orderController.adminAddRemark);
router.get('/admin/:id/logs', authMiddleware, adminMiddleware, orderController.adminLogs);

module.exports = router;
