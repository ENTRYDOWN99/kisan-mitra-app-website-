const Joi = require('joi');

const mobileSchema = Joi.string().length(10).pattern(/^\d+$/).required();

const photoSlotSchema = Joi.object({
    slot: Joi.string().valid('overview', 'closeup', 'quality_detail').required()
});

const receiptUploadSchema = Joi.object({
    listing_id: Joi.string().uuid().required()
});

const createListingExtSchema = Joi.object({
    photo_keys: Joi.object({
        overview: Joi.string().required(),
        closeup: Joi.string().required(),
        quality_detail: Joi.string().required()
    }).required()
});

const sendOtpSchema = Joi.object({
    mobile: mobileSchema,
    role: Joi.string().valid('farmer', 'buyer', 'officer', 'fpo', 'logistics').required()
});

const verifyOtpSchema = Joi.object({
    mobile: mobileSchema,
    otp: Joi.string().length(4).required(),
    role: Joi.string().valid('farmer', 'buyer', 'officer', 'fpo', 'logistics').required()
});

const refreshSchema = Joi.object({
    refreshToken: Joi.string().required()
});

const createListingSchema = Joi.object({
    crop: Joi.string().min(2).max(100).required(),
    quantity_quintal: Joi.number().positive().required(),
    price_per_quintal: Joi.number().positive().required(),
    grade: Joi.string().valid('A', 'B', 'C').required(),
    description: Joi.string().max(500).allow(''),
    is_bulk: Joi.boolean().default(false),
    district: Joi.string().max(100)
});

const updateListingSchema = Joi.object({
    crop: Joi.string().min(2).max(100),
    quantity_quintal: Joi.number().positive(),
    price_per_quintal: Joi.number().positive(),
    grade: Joi.string().valid('A', 'B', 'C'),
    description: Joi.string().max(500).allow(''),
    status: Joi.string().valid('Active', 'Sold', 'Cancelled')
});

const createBidSchema = Joi.object({
    listing_id: Joi.string().uuid().required(),
    bid_price: Joi.number().positive().required(),
    quantity: Joi.number().positive()
});

const updateKycSchema = Joi.object({
    status: Joi.string().valid('Verified', 'Rejected').required()
});

const createSchemeSchema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    department: Joi.string().max(100),
    benefit_description: Joi.string().max(2000).required(),
    eligible_roles: Joi.array().items(Joi.string().valid('farmer', 'buyer', 'officer', 'fpo')).min(1).required()
});

const updateProfileSchema = Joi.object({
    name: Joi.string().min(2).max(255),
    district: Joi.string().max(100),
    state: Joi.string().max(100)
});

const sendNotificationSchema = Joi.object({
    targetRole: Joi.string().valid('farmer', 'buyer', 'officer', 'fpo', 'all').required(),
    message: Joi.string().min(1).max(1000).required()
});

const fpoVerificationSchema = Joi.object({
    decision: Joi.string().valid('approve', 'reject').required(),
    reason: Joi.string().min(10).when('decision', { is: 'reject', then: Joi.required(), otherwise: Joi.optional().allow('') })
});

const officerVerificationSchema = Joi.object({
    decision: Joi.string().valid('approve', 'reject', 'override').required(),
    reason: Joi.string().min(10).when('decision', { is: Joi.valid('reject', 'override'), then: Joi.required(), otherwise: Joi.optional().allow('') }),
    fieldUpdates: Joi.object({
        land_acres: Joi.number().positive(),
        crops: Joi.array().items(Joi.string()),
        district: Joi.string().max(100)
    }).optional()
});

const fpoListingVerificationSchema = Joi.object({
    decision: Joi.string().valid('approve', 'reject').required(),
    reason: Joi.string().min(10).when('decision', { is: 'reject', then: Joi.required(), otherwise: Joi.optional().allow('') })
});

const officerListingVerificationSchema = Joi.object({
    decision: Joi.string().valid('approve', 'reject').required(),
    reason: Joi.string().min(10).when('decision', { is: 'reject', then: Joi.required(), otherwise: Joi.optional().allow('') })
});

// ─── Storage ──────────────────────────────────────────────────

const createStorageFacilitySchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    district: Joi.string().max(100),
    state: Joi.string().max(100),
    capacity_quintal: Joi.number().positive().required(),
    rate_per_quintal_month: Joi.number().positive().required(),
    accepted_crops: Joi.array().items(Joi.string())
});

const createStorageRequestSchema = Joi.object({
    facility_id: Joi.string().uuid().required(),
    crop: Joi.string().min(2).max(100).required(),
    quantity_quintal: Joi.number().positive().required(),
    duration_months: Joi.number().integer().min(1).required()
});

const storageVerifySchema = Joi.object({
    decision: Joi.string().valid('approve', 'reject').required(),
    reason: Joi.string().min(10).when('decision', { is: 'reject', then: Joi.required(), otherwise: Joi.optional().allow('') })
});

// ─── Scheme Application (full) ────────────────────────────────

const schemeApplicationSchema = Joi.object({
    scheme_id: Joi.string().uuid().required(),
    full_name: Joi.string().min(2).max(255).required(),
    dob: Joi.date().iso().required(),
    gender: Joi.string().valid('Male', 'Female', 'Other').required(),
    mobile: mobileSchema,
    email: Joi.string().email().allow(''),
    category: Joi.string().valid('SC', 'ST', 'OBC', 'EWS', 'General')
});

const schemeAppReviewSchema = Joi.object({
    decision: Joi.string().valid('approve', 'reject').required(),
    reason: Joi.string().min(10).when('decision', { is: 'reject', then: Joi.required(), otherwise: Joi.optional().allow('') })
});

// ─── Logistics ────────────────────────────────────────────────

const createShipmentSchema = Joi.object({
    purpose: Joi.string().valid('buyer_delivery', 'storage_delivery').default('buyer_delivery'),
    bid_id: Joi.string().uuid().when('purpose', { is: 'buyer_delivery', then: Joi.required(), otherwise: Joi.forbidden() }),
    storage_request_id: Joi.string().uuid().when('purpose', { is: 'storage_delivery', then: Joi.required(), otherwise: Joi.forbidden() }),
    pickup_location: Joi.string().min(5).max(500).required(),
    drop_location: Joi.string().min(5).max(500).required(),
    crop: Joi.string().max(100),
    quantity_quintal: Joi.number().positive(),
    vehicle_type: Joi.string().max(50),
    scheduled_pickup_at: Joi.date().iso()
});

const updateShipmentStatusSchema = Joi.object({
    status: Joi.string().valid('Booked', 'Picked_Up', 'In_Transit', 'Delivered', 'Cancelled').required()
});

const trackingPingSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
});

const markPaymentSchema = Joi.object({
    amount: Joi.number().positive().required(),
    status: Joi.string().valid('Paid', 'Failed').required(),
    method: Joi.string().max(30).allow(''),
    transaction_ref: Joi.string().max(100).allow('')
});

const updateLogisticsProfileSchema = Joi.object({
    company_name: Joi.string().min(2).max(255),
    gst_number: Joi.string().max(15),
    license_number: Joi.string().max(50),
    service_area: Joi.array().items(Joi.string()),
    fleet_size: Joi.number().integer().min(0)
});

function validate(schema, data) {
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
        const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
        return { valid: false, errors, value: null };
    }
    return { valid: true, errors: null, value };
}

// ─── History ────────────────────────────────────────────────────

const historyQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    from_date: Joi.date().iso(),
    to_date: Joi.date().iso(),
    crop: Joi.string().max(100),
    district: Joi.string().max(100)
});

module.exports = {
    validate,
    sendOtpSchema,
    verifyOtpSchema,
    refreshSchema,
    createListingSchema,
    updateListingSchema,
    createBidSchema,
    updateKycSchema,
    createSchemeSchema,
    updateProfileSchema,
    sendNotificationSchema,
    fpoVerificationSchema,
    officerVerificationSchema,
    fpoListingVerificationSchema,
    officerListingVerificationSchema,
    photoSlotSchema,
    receiptUploadSchema,
    createListingExtSchema,
    createStorageFacilitySchema,
    createStorageRequestSchema,
    storageVerifySchema,
    schemeApplicationSchema,
    schemeAppReviewSchema,
    createShipmentSchema,
    updateShipmentStatusSchema,
    trackingPingSchema,
    markPaymentSchema,
    updateLogisticsProfileSchema,
    historyQuerySchema
};
