const multer = require('multer');
const { validateFile, MAX_FILE_SIZE } = require('../services/upload.service');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const result = validateFile(file.mimetype, 0);
    if (!result.valid) {
        cb(new Error(result.message), false);
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` });
        }
        return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
}

module.exports = { upload, handleMulterError };
