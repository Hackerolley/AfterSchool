import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getStudentProgress,
  listChapters,
  listRecitations,
  listVerses,
  updateStudentProgress,
} from "./quran.controller.js";
import { listVersesQuerySchema, updateProgressSchema } from "./quran.validator.js";

const router = Router();
router.use(authenticate, requireOrganization, authorize("student"));
router.get("/chapters", asyncHandler(listChapters));
router.get("/recitations", asyncHandler(listRecitations));
router.get("/chapters/:chapterId/verses", validate(listVersesQuerySchema, "query"), asyncHandler(listVerses));
router.get("/progress", asyncHandler(getStudentProgress));
router.post("/progress", validate(updateProgressSchema), asyncHandler(updateStudentProgress));

export default router;
