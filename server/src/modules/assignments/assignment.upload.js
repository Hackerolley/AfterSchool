import multer from "multer";
import { extname } from "node:path";
import { HttpError } from "../../utils/http-error.js";

const allowedTypes = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"],
]);

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = extname(file.originalname).toLowerCase();
    if (allowedTypes.get(extension) !== file.mimetype) {
      callback(new HttpError(400, "Upload a PDF, Word document, or plain-text file"));
      return;
    }
    callback(null, true);
  },
});

export function uploadAssignmentFile(req, res, next) {
  parser.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(413, "Files must be 10 MB or smaller"));
      return;
    }
    if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
      next(new HttpError(400, "Upload one file per assignment or submission"));
      return;
    }
    next(error);
  });
}
