const { Router } = require('express');
const multer = require('multer');
const inventoryController = require('../controllers/inventoryController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/categories', authMiddleware, adminMiddleware, inventoryController.listCategories);
router.post('/categories', authMiddleware, adminMiddleware, inventoryController.createCategory);
router.put('/categories/:id', authMiddleware, adminMiddleware, inventoryController.updateCategory);
router.delete('/categories/:id', authMiddleware, adminMiddleware, inventoryController.removeCategory);

router.get('/sample-excel', authMiddleware, adminMiddleware, inventoryController.getSampleExcel);
router.post('/import-excel', authMiddleware, adminMiddleware, upload.single('file'), inventoryController.importExcel);
router.get('/sample-delete-excel', authMiddleware, adminMiddleware, inventoryController.getSampleDeleteExcel);
router.post('/delete-excel', authMiddleware, adminMiddleware, upload.single('file'), inventoryController.batchDeleteByExcel);

router.get('/export-products', authMiddleware, adminMiddleware, inventoryController.exportProducts);
router.get('/products', authMiddleware, adminMiddleware, inventoryController.listProducts);
router.post('/products', authMiddleware, adminMiddleware, inventoryController.createProduct);
router.put('/products/:id', authMiddleware, adminMiddleware, inventoryController.updateProduct);
router.delete('/products/:id', authMiddleware, adminMiddleware, inventoryController.removeProduct);

router.get('/products/:id/bind-qr-url', authMiddleware, adminMiddleware, inventoryController.getBindQrUrl);

module.exports = router;
