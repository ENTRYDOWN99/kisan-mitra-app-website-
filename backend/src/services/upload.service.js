const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const s3 = new S3Client({
    region: process.env.S3_REGION || 'ap-south-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    },
});

const BUCKET = process.env.S3_BUCKET || 'kisan-mitra-dev';

function generateKey(prefix, ext) {
    return `${prefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
}

async function uploadFile(buffer, mimeType, prefix) {
    const ext = mimeType.split('/')[1] || 'bin';
    const key = generateKey(prefix, ext);

    const upload = new Upload({
        client: s3,
        params: {
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        },
    });

    await upload.done();
    return key;
}

async function getSignedFileUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
}

async function imageDimensions(buffer) {
    try {
        const sharp = require('sharp');
        const meta = await sharp(buffer).metadata();
        return meta ? { width: meta.width, height: meta.height } : null;
    } catch (e) {
        return null;
    }
}

const BASE_RESOLUTION = { width: 512, height: 384 };
const PHOTO_REQUIREMENTS = {
    overview:       { minWidth: BASE_RESOLUTION.width * 2, minHeight: BASE_RESOLUTION.height * 2, label: 'Overview' },
    closeup:        { minWidth: BASE_RESOLUTION.width * 4, minHeight: BASE_RESOLUTION.height * 4, label: 'Close-up' },
    quality_detail: { minWidth: BASE_RESOLUTION.width * 5, minHeight: BASE_RESOLUTION.height * 5, label: 'Quality Detail' },
};

function validatePhotoDimensions(width, height, slot) {
    const req = PHOTO_REQUIREMENTS[slot];
    if (!req) return { valid: false, message: `Unknown photo slot: ${slot}` };
    if (width < req.minWidth || height < req.minHeight) {
        return {
            valid: false,
            message: `${req.label} photo must be at least ${req.minWidth}×${req.minHeight}px (got ${width}×${height})`,
        };
    }
    return { valid: true };
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function validateFile(mimeType, size) {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return { valid: false, message: `Unsupported file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` };
    }
    if (size > MAX_FILE_SIZE) {
        return { valid: false, message: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
    }
    return { valid: true };
}

async function hydrateFileUrls(rows, configs, expiresIn = 900) {
    if (!rows) return rows;
    const items = Array.isArray(rows) ? rows : [rows];
    for (const item of items) {
        for (const cfg of configs) {
            if (typeof cfg === 'string') {
                if (item[cfg]) item[cfg] = await getSignedFileUrl(item[cfg], expiresIn);
            } else if (cfg.field && item[cfg.field]) {
                if (cfg.nested) {
                    const subKey = cfg.subField || 'file_url';
                    for (const sub of item[cfg.field]) {
                        if (sub[subKey]) sub[subKey] = await getSignedFileUrl(sub[subKey], expiresIn);
                    }
                } else if (typeof item[cfg.field] === 'string') {
                    item[cfg.field] = await getSignedFileUrl(item[cfg.field], expiresIn);
                }
            }
        }
    }
    return items;
}

module.exports = {
    uploadFile,
    getSignedFileUrl,
    hydrateFileUrls,
    validateFile,
    validatePhotoDimensions,
    PHOTO_REQUIREMENTS,
    BASE_RESOLUTION,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
};
