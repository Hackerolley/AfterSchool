import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/users/user.routes.js";
import studentRoutes from "../modules/students/student.routes.js";
import teacherRoutes from "../modules/teachers/teacher.routes.js";
import courseRoutes from "../modules/courses/course.routes.js";
import classRoutes from "../modules/classes/class.routes.js";
import organizationRoutes from "../modules/organizations/organization.routes.js";
import assignmentRoutes from "../modules/assignments/assignment.routes.js";
import libraryRoutes from "../modules/library/library.routes.js";
import quranRoutes from "../modules/quran/quran.routes.js";
import settingsRoutes from "../modules/settings/settings.routes.js";

const router = Router();
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/students", studentRoutes);
router.use("/teachers", teacherRoutes);
router.use("/courses", courseRoutes);
router.use("/classes", classRoutes);
router.use("/assignments", assignmentRoutes);
router.use("/library", libraryRoutes);
router.use("/quran", quranRoutes);
router.use("/settings", settingsRoutes);
router.use("/platform/organizations", organizationRoutes);

export default router;
