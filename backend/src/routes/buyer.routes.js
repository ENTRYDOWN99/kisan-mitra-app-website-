const { Router } = require('express');
const router = Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const ctrl = require('../controllers/buyer.controller');

router.use(authenticate, requireRole('buyer'));

router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);
router.get('/market', ctrl.getMarketListings);
router.post('/bids', ctrl.createBid);
router.get('/bids', ctrl.getBids);
router.put('/bids/:id', ctrl.updateBid);
router.get('/prices', ctrl.getPrices);

module.exports = router;
