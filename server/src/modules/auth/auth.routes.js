import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate, requireOrganization } from "../../middleware/authenticate.js";
import { issueCsrfToken } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { requirePlatformAdmin } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { login, logout, me, platformLogin, platformMe } from "./auth.controller.js";
import { loginSchema, platformAdminLoginSchema } from "./auth.validator.js";

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts; try again later" },
});
const platformLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts; try again later" },
});

router.get("/csrf", issueCsrfToken);
router.post("/login", loginLimiter, validate(loginSchema), asyncHandler(login));
router.post(
  "/platform/login",
  platformLoginLimiter,
  validate(platformAdminLoginSchema),
  asyncHandler(platformLogin),
);
router.post("/logout", authenticate, asyncHandler(logout));
router.get("/me", authenticate, requireOrganization, me);
router.get("/platform/me", authenticate, requirePlatformAdmin, platformMe);

export default router;
