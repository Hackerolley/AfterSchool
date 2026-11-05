import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { archiveCourse, createCourse, getCourse, listCourses, updateCourse } from "./course.controller.js";
import { createCourseSchema, listCoursesQuerySchema, updateCourseSchema } from "./course.validator.js";

const router = Router();
router.use(authenticate, requireOrganization);
router.get("/", validate(listCoursesQuerySchema, "query"), asyncHandler(listCourses));
router.post("/", authorize("admin"), validate(createCourseSchema), asyncHandler(createCourse));
router.patch("/:courseId", authorize("admin"), validate(updateCourseSchema), asyncHandler(updateCourse));
router.delete("/:courseId", authorize("admin"), asyncHandler(archiveCourse));
router.get("/:courseId", asyncHandler(getCourse));

export default router;
