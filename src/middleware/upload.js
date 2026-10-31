const multer = require("multer");

const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedVideoMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "image" && allowedImageMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    if (file.fieldname === "video" && allowedVideoMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    return cb(new Error(`Unsupported file type for field ${file.fieldname}`));
  }
});

module.exports = upload;
