import { randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError } from "../utils/http-error.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function issueCsrfToken(req, res) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  res.json({ success: true, data: { csrfToken: req.session.csrfToken } });
}

export function csrfProtection(req, res, next) {
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  const supplied = req.get("X-CSRF-Token");
  const expected = req.session?.csrfToken;
  if (typeof supplied !== "string" || typeof expected !== "string") {
    next(new HttpError(403, "Valid CSRF token required"));
    return;
  }
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    next(new HttpError(403, "Valid CSRF token required"));
    return;
  }
  next();
}

export function rotateCsrfToken(req) {
  req.session.csrfToken = randomBytes(32).toString("hex");
}
