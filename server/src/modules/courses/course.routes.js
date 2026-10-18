import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createCourse, getCourse, listCourses } from "./course.controller.js";
import { createCourseSchema, listCoursesQuerySchema } from "./course.validator.js";

const router = Router();
router.use(authenticate, requireOrganization);
router.get("/", validate(listCoursesQuerySchema, "query"), asyncHandler(listCourses));
router.post("/", authorize("admin"), validate(createCourseSchema), asyncHandler(createCourse));
router.get("/:courseId", asyncHandler(getCourse));

export default router;
