const { Router } = require('express');
const router = Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const ctrl = require('../controllers/logistics.controller');

router.use(authenticate, requireRole('logistics'));

router.get('/orders', ctrl.getAvailableOrders);
router.post('/shipments', ctrl.createShipment);
router.get('/shipments', ctrl.getMyShipments);
router.put('/shipments/:id/status', ctrl.updateShipmentStatus);
router.post('/shipments/:id/tracking', ctrl.pushTrackingPing);
router.get('/shipments/:id/tracking', ctrl.getTrackingHistory);
router.get('/payments', ctrl.getPayments);
router.post('/payments/:id/mark-paid', ctrl.markPayment);
router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);

module.exports = router;
