const { Router } = require('express');
const addressController = require('../controllers/addressController');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/', authMiddleware, addressController.list);
router.post('/', authMiddleware, addressController.create);
router.put('/:id', authMiddleware, addressController.update);
router.delete('/:id', authMiddleware, addressController.remove);
router.put('/:id/default', authMiddleware, addressController.setDefault);

module.exports = router;
