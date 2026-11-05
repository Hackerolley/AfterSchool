import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createClass,
  archiveClass,
  approveClassTimetableChange,
  enrollStudent,
  getClass,
  listClassAttendance,
  listClassStudents,
  listClasses,
  recordClassAttendance,
  rejectClassTimetableChange,
  requestClassTimetableChange,
  updateClass,
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
  updateClassSchema,
  updateClassTimetableSchema,
} from "./class.validator.js";
import {
  createClassResource,
  deleteClassResource,
  downloadProgressReport,
  getClassLearning,
  getClassResourceFile,
  listClassResources,
  updateStudentAttendance,
  updateStudentProgress,
} from "./class-learning.controller.js";
import {
  createClassResourceSchema,
  listClassLearningQuerySchema,
  updateStudentAttendanceSchema,
  updateStudentProgressSchema,
} from "./class-learning.validator.js";
import { uploadClassResourceFile } from "./class-resource.upload.js";

const router = Router();
router.use(authenticate);
router.use((req, res, next) => {
  if (
    req.method === "GET"
    && (req.path.endsWith("/file") || req.path.endsWith(".pdf"))
    && typeof req.query.organizationId === "string"
  ) {
    req.headers["x-organization-id"] = req.query.organizationId;
  }
  next();
}, requireOrganization);
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
router.patch(
  "/:classId",
  authorize("admin"),
  validate(updateClassSchema),
  asyncHandler(updateClass),
);
router.delete("/:classId", authorize("admin"), asyncHandler(archiveClass));
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
router.get(
  "/:classId/learning",
  validate(listClassLearningQuerySchema, "query"),
  asyncHandler(getClassLearning),
);
router.get("/:classId/resources", asyncHandler(listClassResources));
router.post(
  "/:classId/resources",
  authorize("admin", "teacher"),
  uploadClassResourceFile,
  validate(createClassResourceSchema),
  asyncHandler(createClassResource),
);
router.get("/:classId/resources/:resourceId/file", asyncHandler(getClassResourceFile));
router.delete(
  "/:classId/resources/:resourceId",
  authorize("admin", "teacher"),
  asyncHandler(deleteClassResource),
);
router.patch(
  "/:classId/progress",
  authorize("admin", "teacher"),
  validate(updateStudentProgressSchema),
  asyncHandler(updateStudentProgress),
);
router.patch(
  "/:classId/student-attendance",
  authorize("admin", "teacher"),
  validate(updateStudentAttendanceSchema),
  asyncHandler(updateStudentAttendance),
);
router.get(
  "/:classId/progress-report/:studentId.pdf",
  validate(listClassLearningQuerySchema, "query"),
  asyncHandler(downloadProgressReport),
);
router.get("/:classId", asyncHandler(getClass));

export default router;
