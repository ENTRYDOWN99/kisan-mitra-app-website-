const { Router } = require('express');
const router = Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const ctrl = require('../controllers/officer.controller');
const storageCtrl = require('../controllers/storage.controller');

router.use(authenticate, requireRole('officer'));

router.get('/dashboard', ctrl.getDashboard);
router.get('/farmers', ctrl.listFarmers);
router.get('/farmers/:id', ctrl.getFarmerDetail);
router.put('/farmers/:id/kyc', ctrl.updateKyc);
router.get('/listings', ctrl.getAllListings);
router.get('/schemes', ctrl.getSchemes);
router.post('/schemes', ctrl.createScheme);
router.put('/schemes/:id', ctrl.updateScheme);
router.delete('/schemes/:id', ctrl.deleteScheme);
router.get('/reports', ctrl.getReports);
router.post('/notifications', ctrl.sendNotification);

router.get('/verification-queue', ctrl.getVerificationQueue);
router.get('/verification/:farmerId/history', ctrl.getVerificationHistory);
router.put('/verification/:farmerId', ctrl.updateVerification);

router.get('/listings/verification-queue', ctrl.getListingVerificationQueue);
router.put('/listings/verification/:id', ctrl.updateListingVerification);

router.get('/scheme-applications', ctrl.getSchemeApplications);
router.post('/scheme-applications/:id/review', ctrl.reviewSchemeApplication);

router.get('/storage-facilities', storageCtrl.getAllFacilities);
router.get('/storage-requests', storageCtrl.getAllStorageRequests);
router.put('/storage-facilities/:id/flag', storageCtrl.flagFacility);

router.get('/history/trades', ctrl.getTradeHistory);
router.get('/history/logistics', ctrl.getLogisticsHistory);
router.get('/history/storage', ctrl.getStorageHistory);

module.exports = router;
