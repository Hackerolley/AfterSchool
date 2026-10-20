import multer from "multer";
import { extname } from "node:path";
import { HttpError } from "../../utils/http-error.js";

const allowedTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (allowedTypes.get(extname(file.originalname).toLowerCase()) !== file.mimetype) {
      callback(new HttpError(400, "Choose a JPG, PNG, or WebP image"));
      return;
    }
    callback(null, true);
  },
});

export function isSupportedImage(buffer) {
  const isJpeg = buffer.length >= 3
    && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.length >= 12
    && buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WEBP";
  return isJpeg || isPng || isWebp;
}

export function uploadSettingsImage(req, res, next) {
  parser.single("file")(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(new HttpError(413, "Images must be 5 MB or smaller"));
        return;
      }
      if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
        next(new HttpError(400, "Upload one image at a time"));
        return;
      }
      next(error);
      return;
    }
    if (!req.file) {
      next(new HttpError(400, "Choose an image to upload"));
      return;
    }
    if (!isSupportedImage(req.file.buffer)) {
      next(new HttpError(400, "The uploaded file is not a valid JPG, PNG, or WebP image"));
      return;
    }
    next();
  });
}
