import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createUser,
  getDirectoryRole,
  listDirectoryRole,
  listTeacherClasses,
} from "../users/user.controller.js";
import { createUserSchema } from "../users/user.validator.js";

const directoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
}).strict();
const listClassesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
const createTeacherSchema = createUserSchema.refine((input) => input.role === "teacher", {
  message: "Role must be teacher",
  path: ["role"],
});

const router = Router();
router.use(authenticate, requireOrganization);
router.get(
  "/",
  authorize("admin"),
  validate(directoryQuerySchema, "query"),
  asyncHandler((req, res) => listDirectoryRole(req, res, "teacher")),
);
router.post("/", authorize("admin"), validate(createTeacherSchema), asyncHandler(createUser));
router.get(
  "/:membershipId/classes",
  validate(listClassesQuerySchema, "query"),
  asyncHandler(listTeacherClasses),
);
router.get("/:membershipId", authorize("admin"), asyncHandler((req, res) => getDirectoryRole(req, res, "teacher")));

export default router;
