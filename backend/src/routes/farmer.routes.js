const { Router } = require('express');
const router = Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { upload, handleMulterError } = require('../middleware/upload.middleware');
const ctrl = require('../controllers/farmer.controller');
const storageCtrl = require('../controllers/storage.controller');

router.use(authenticate, requireRole('farmer'));

router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);
router.get('/listings', ctrl.getListings);
router.post('/listings', ctrl.createListing);
router.post('/listings/:id/submit-for-review', ctrl.submitForReview);
router.put('/listings/:id', ctrl.updateListing);
router.delete('/listings/:id', ctrl.deleteListing);
router.get('/schemes', ctrl.getEligibleSchemes);
router.post('/schemes/:id/apply', ctrl.applyForScheme);
router.get('/schemes/applications', ctrl.getMySchemeApplications);
router.get('/prices', ctrl.getPrices);

router.get('/verification-status', ctrl.getVerificationStatus);

router.get('/storage-facilities', storageCtrl.browseFacilities);
router.post('/storage-requests', storageCtrl.createStorageRequest);
router.get('/storage-requests', storageCtrl.getMyStorageRequests);

router.post('/listings/:listingId/photos/:slot', upload.single('file'), handleMulterError, ctrl.uploadPhoto);
router.post('/listings/:listingId/receipt', upload.single('file'), handleMulterError, ctrl.uploadReceipt);

module.exports = router;
