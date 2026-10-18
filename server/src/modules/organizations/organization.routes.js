import { Router } from "express";
import { authenticate, requirePlatformAdmin } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createOrganization } from "./organization.controller.js";
import { createOrganizationSchema } from "./organization.validator.js";

const router = Router();
router.post(
  "/",
  authenticate,
  requirePlatformAdmin,
  validate(createOrganizationSchema),
  asyncHandler(createOrganization),
);

export default router;
