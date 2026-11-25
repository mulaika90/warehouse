import multer from "multer";

const storage = multer.memoryStorage()

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter(_req, file, callback) {
        const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!supportedTypes.includes(file.mimetype)) {
            return callback(new Error("Upload a JPG, PNG, or WebP image."));
        }
        return callback(null, true);
    }
})
export default upload