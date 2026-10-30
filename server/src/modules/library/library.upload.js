import multer from "multer";
import { extname } from "node:path";
import { HttpError } from "../../utils/http-error.js";

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (
      extname(file.originalname).toLowerCase() !== ".pdf"
      || !["", "application/pdf", "application/octet-stream", "application/x-pdf"].includes(file.mimetype)
    ) {
      callback(new HttpError(400, "Upload an ebook as a PDF file"));
      return;
    }
    callback(null, true);
  },
});

export function uploadEbook(req, res, next) {
  parser.single("file")(req, res, (error) => {
    if (!error && req.file && !req.file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      next(new HttpError(400, "The uploaded ebook is not a valid PDF file"));
      return;
    }
    if (!error) {
      next();
      return;
    }
    if (error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(413, "Ebooks must be 25 MB or smaller"));
      return;
    }
    if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
      next(new HttpError(400, "Upload one PDF ebook at a time"));
      return;
    }
    next(error);
  });
}
