import { Router } from "express";
import { authenticate, requirePlatformAdmin } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createOrganization,
  getOrganization,
  listOrganizationMemberships,
  listOrganizations,
  updateOrganization,
  updateOrganizationMembershipStatus,
} from "./organization.controller.js";
import {
  createOrganizationSchema,
  listOrganizationMembershipsQuerySchema,
  listOrganizationsQuerySchema,
  updateOrganizationSchema,
  updatePlatformMembershipStatusSchema,
} from "./organization.validator.js";

const router = Router();
router.use(authenticate, requirePlatformAdmin);

router.get(
  "/",
  validate(listOrganizationsQuerySchema, "query"),
  asyncHandler(listOrganizations),
);
router.post(
  "/",
  validate(createOrganizationSchema),
  asyncHandler(createOrganization),
);
router.get(
  "/:organizationId/memberships",
  validate(listOrganizationMembershipsQuerySchema, "query"),
  asyncHandler(listOrganizationMemberships),
);
router.patch(
  "/:organizationId/memberships/:membershipId/status",
  validate(updatePlatformMembershipStatusSchema),
  asyncHandler(updateOrganizationMembershipStatus),
);
router.get("/:organizationId", asyncHandler(getOrganization));
router.patch(
  "/:organizationId",
  validate(updateOrganizationSchema),
  asyncHandler(updateOrganization),
);

export default router;
