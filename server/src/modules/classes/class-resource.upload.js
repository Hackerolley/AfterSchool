import multer from "multer";
import { extname } from "node:path";
import { HttpError } from "../../utils/http-error.js";

const pdfTypes = new Set(["", "application/pdf", "application/octet-stream", "application/x-pdf"]);
const videoTypes = new Map([
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
]);

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = extname(file.originalname).toLowerCase();
    const validPdf = extension === ".pdf" && pdfTypes.has(file.mimetype);
    const validVideo = videoTypes.get(extension) === file.mimetype;
    if (!validPdf && !validVideo) {
      callback(new HttpError(400, "Upload a PDF, MP4, WebM, or MOV file"));
      return;
    }
    callback(null, true);
  },
});

export function uploadClassResourceFile(req, res, next) {
  parser.single("file")(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(413, "Class resource files must be 50 MB or smaller"));
      return;
    }
    if (error?.code === "LIMIT_FILE_COUNT" || error?.code === "LIMIT_UNEXPECTED_FILE") {
      next(new HttpError(400, "Upload one class resource file at a time"));
      return;
    }
    if (error) {
      next(error);
      return;
    }

    if (req.file) {
      const extension = extname(req.file.originalname).toLowerCase();
      const isPdf = extension === ".pdf";
      const validSignature = isPdf
        ? req.file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))
        : extension === ".webm"
          ? req.file.buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
          : req.file.buffer.subarray(4, 8).toString() === "ftyp";
      if (!validSignature) {
        next(new HttpError(400, isPdf ? "The uploaded file is not a valid PDF" : "The uploaded file is not a valid video"));
        return;
      }
    }
    next();
  });
}
