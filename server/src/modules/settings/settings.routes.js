import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getProfileSettings,
  getSchoolSettings,
  removeProfileAvatar,
  removeSchoolLogo,
  updateProfileAvatar,
  updateSchoolLogo,
} from "./settings.controller.js";
import { uploadSettingsImage } from "./settings.upload.js";

const router = Router();
router.get("/profile", authenticate, asyncHandler(getProfileSettings));
router.post("/profile/avatar", authenticate, uploadSettingsImage, asyncHandler(updateProfileAvatar));
router.delete("/profile/avatar", authenticate, asyncHandler(removeProfileAvatar));
router.use("/school", authenticate, requireOrganization);
router.get("/school", asyncHandler(getSchoolSettings));
router.post("/school/logo", authorize("admin"), uploadSettingsImage, asyncHandler(updateSchoolLogo));
router.delete("/school/logo", authorize("admin"), asyncHandler(removeSchoolLogo));

export default router;
