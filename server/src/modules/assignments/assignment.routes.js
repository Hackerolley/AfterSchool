import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createAssignment,
  getAssignment,
  getAssignmentFile,
  listAssignmentSubmissions,
  listAssignments,
  reviewAssignmentSubmission,
  submitAssignment,
} from "./assignment.controller.js";
import {
  createAssignmentSchema,
  reviewAssignmentSubmissionSchema,
  submitAssignmentSchema,
} from "./assignment.validator.js";
import { uploadAssignmentFile } from "./assignment.upload.js";

const router = Router();
router.use(authenticate);
router.use((req, res, next) => {
  if (req.method === "GET" && req.path.endsWith("/file") && typeof req.query.organizationId === "string") {
    req.headers["x-organization-id"] = req.query.organizationId;
  }
  next();
}, requireOrganization);
router.get("/", asyncHandler(listAssignments));
router.post(
  "/",
  authorize("teacher"),
  uploadAssignmentFile,
  validate(createAssignmentSchema),
  asyncHandler(createAssignment),
);
router.post(
  "/:assignmentId/submissions",
  authorize("student"),
  uploadAssignmentFile,
  validate(submitAssignmentSchema),
  asyncHandler(submitAssignment),
);
router.get(
  "/:assignmentId/submissions",
  authorize("teacher"),
  asyncHandler(listAssignmentSubmissions),
);
router.patch(
  "/:assignmentId/submissions/:submissionId/review",
  authorize("teacher"),
  validate(reviewAssignmentSubmissionSchema),
  asyncHandler(reviewAssignmentSubmission),
);
router.get("/:assignmentId/submissions/:submissionId/file", asyncHandler(getAssignmentFile));
router.get("/:assignmentId/file", asyncHandler(getAssignmentFile));
router.get("/:assignmentId", asyncHandler(getAssignment));

export default router;
