import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createUser, getDirectoryRole, listDirectoryRole } from "../users/user.controller.js";
import { createUserSchema } from "../users/user.validator.js";
import { z } from "zod";

const directoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
}).strict();
const createStudentSchema = createUserSchema.refine((input) => input.role === "student", {
  message: "Role must be student",
  path: ["role"],
});

const router = Router();
router.use(authenticate, requireOrganization);
router.get(
  "/",
  authorize("admin", "teacher"),
  validate(directoryQuerySchema, "query"),
  asyncHandler((req, res) => listDirectoryRole(req, res, "student")),
);
router.post("/", authorize("admin"), validate(createStudentSchema), asyncHandler(createUser));
router.get("/:membershipId", asyncHandler((req, res) => getDirectoryRole(req, res, "student")));

export default router;
