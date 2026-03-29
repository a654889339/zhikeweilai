const { Router } = require('express');
const authRoutes = require('./auth');
const orderRoutes = require('./order');
const addressRoutes = require('./address');
const guideRoutes = require('./guide');
const productCategoryRoutes = require('./productCategory');
const homeConfigRoutes = require('./homeConfig');
const messageRoutes = require('./message');
const inventoryRoutes = require('./inventory');
const outletRoutes = require('./outlet');
const chatGroupRoutes = require('./chatGroup');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const seedController = require('../controllers/seedController');

const router = Router();

router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/addresses', addressRoutes);
router.use('/guides', guideRoutes);
router.use('/product-categories', productCategoryRoutes);
router.use('/home-config', homeConfigRoutes);
router.use('/messages', messageRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/outlet', outletRoutes);
router.use('/chat-groups', chatGroupRoutes);

router.post('/admin/generate-thumbs', authMiddleware, adminMiddleware, adminController.generateThumbs);
router.post('/admin/seed', authMiddleware, adminMiddleware, seedController.seedData);

router.get('/health', (req, res) => {
  res.json({ code: 0, message: 'Vino服务运行中', timestamp: new Date().toISOString() });
});


module.exports = router;
