import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createClass,
  enrollStudent,
  getClass,
  listClassStudents,
  listClasses,
  withdrawStudent,
} from "./class.controller.js";
import {
  createClassSchema,
  enrollStudentSchema,
  listClassStudentsQuerySchema,
  listClassesQuerySchema,
} from "./class.validator.js";

const router = Router();
router.use(authenticate, requireOrganization);
router.get("/", validate(listClassesQuerySchema, "query"), asyncHandler(listClasses));
router.post("/", authorize("admin"), validate(createClassSchema), asyncHandler(createClass));
router.get(
  "/:classId/students",
  validate(listClassStudentsQuerySchema, "query"),
  asyncHandler(listClassStudents),
);
router.post(
  "/:classId/enrollments",
  authorize("admin"),
  validate(enrollStudentSchema),
  asyncHandler(enrollStudent),
);
router.delete(
  "/:classId/enrollments/:enrollmentId",
  authorize("admin"),
  asyncHandler(withdrawStudent),
);
router.get("/:classId", asyncHandler(getClass));

export default router;
