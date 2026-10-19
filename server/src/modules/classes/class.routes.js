import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createClass,
  approveClassTimetableChange,
  enrollStudent,
  getClass,
  listClassAttendance,
  listClassStudents,
  listClasses,
  recordClassAttendance,
  rejectClassTimetableChange,
  requestClassTimetableChange,
  updateClassTimetable,
  withdrawStudent,
} from "./class.controller.js";
import {
  createClassSchema,
  enrollStudentSchema,
  listClassStudentsQuerySchema,
  listAttendanceQuerySchema,
  listClassesQuerySchema,
  recordAttendanceSchema,
  updateClassTimetableSchema,
} from "./class.validator.js";

const router = Router();
router.use(authenticate, requireOrganization);
router.get("/", validate(listClassesQuerySchema, "query"), asyncHandler(listClasses));
router.get(
  "/attendance",
  authorize("admin", "teacher", "student"),
  validate(listAttendanceQuerySchema, "query"),
  asyncHandler(listClassAttendance),
);
router.post("/", authorize("admin"), validate(createClassSchema), asyncHandler(createClass));
router.post(
  "/:classId/attendance",
  authorize("admin", "teacher"),
  validate(recordAttendanceSchema),
  asyncHandler(recordClassAttendance),
);
router.patch(
  "/:classId/timetable",
  authorize("admin"),
  validate(updateClassTimetableSchema),
  asyncHandler(updateClassTimetable),
);
router.post(
  "/:classId/timetable-requests",
  authorize("teacher"),
  validate(updateClassTimetableSchema),
  asyncHandler(requestClassTimetableChange),
);
router.post(
  "/:classId/timetable-requests/approve",
  authorize("admin"),
  asyncHandler(approveClassTimetableChange),
);
router.post(
  "/:classId/timetable-requests/reject",
  authorize("admin"),
  asyncHandler(rejectClassTimetableChange),
);
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
