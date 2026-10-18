import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createUser,
  getUser,
  listUsers,
  updateMembershipStatus,
} from "./user.controller.js";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserStatusSchema,
} from "./user.validator.js";

const router = Router();
router.use(authenticate, requireOrganization);
router.get("/", authorize("admin"), (req, res, next) => {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) return next({ status: 400, message: "Invalid query parameters", details: parsed.error.flatten() });
  req.validatedQuery = parsed.data;
  next();
}, asyncHandler(listUsers));
router.post("/", authorize("admin"), validate(createUserSchema), asyncHandler(createUser));
router.get("/:membershipId", authorize("admin"), asyncHandler(getUser));
router.patch(
  "/:membershipId/status",
  authorize("admin"),
  validate(updateUserStatusSchema),
  asyncHandler(updateMembershipStatus),
);

export default router;
