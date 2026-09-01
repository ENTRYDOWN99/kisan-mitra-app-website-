const { Router } = require('express');
const router = Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const ctrl = require('../controllers/fpo.controller');
const storageCtrl = require('../controllers/storage.controller');

router.use(authenticate, requireRole('fpo'));

router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);
router.get('/members', ctrl.getMembers);
router.post('/members/:farmerId', ctrl.addMember);
router.delete('/members/:farmerId', ctrl.removeMember);
router.get('/listings', ctrl.getListings);
router.post('/listings', ctrl.createListing);
router.put('/listings/:id', ctrl.updateListing);
router.get('/schemes', ctrl.getEligibleSchemes);
router.post('/schemes/:id/apply', ctrl.applyForScheme);
router.get('/prices', ctrl.getPrices);

router.get('/verification-queue', ctrl.getVerificationQueue);
router.get('/verification/:farmerId/history', ctrl.getVerificationHistory);
router.put('/verification/:farmerId', ctrl.updateVerification);

router.get('/listings/verification-queue', ctrl.getListingVerificationQueue);
router.put('/listings/verification/:id', ctrl.updateListingVerification);

router.get('/scheme-applications', ctrl.getSchemeApplications);
router.post('/scheme-applications/:id/review', ctrl.reviewSchemeApplication);

router.get('/storage-facilities', storageCtrl.getMyFacilities);
router.post('/storage-facilities', storageCtrl.createFacility);
router.put('/storage-facilities/:id', storageCtrl.updateFacility);
router.delete('/storage-facilities/:id', storageCtrl.deleteFacility);
router.get('/storage-requests', storageCtrl.getIncomingRequests);
router.put('/storage-requests/:id/verify', storageCtrl.verifyStorageRequest);

router.get('/history/trades', ctrl.getTradeHistory);
router.get('/history/logistics', ctrl.getLogisticsHistory);
router.get('/history/storage', ctrl.getStorageHistory);

module.exports = router;
