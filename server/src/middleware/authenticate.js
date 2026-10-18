import { Membership } from "../modules/memberships/membership.model.js";
import { User } from "../modules/users/user.model.js";
import { HttpError } from "../utils/http-error.js";

export async function authenticate(req, res, next) {
  try {
    if (!req.session?.userId) {
      throw new HttpError(401, "Authentication required");
    }

    const user = await User.findOne({
      _id: req.session.userId,
      status: "active",
    }).select("_id firstName lastName email status platformRole");

    if (!user) {
      req.session.destroy(() => {});
      throw new HttpError(401, "Authentication required");
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePlatformAdmin(req, res, next) {
  if (req.user?.platformRole !== "platform_admin") {
    next(new HttpError(403, "Platform administrator permission required"));
    return;
  }
  next();
}

export async function requireOrganization(req, res, next) {
  try {
    const organizationId = req.get("X-Organization-Id");
    if (!organizationId) {
      throw new HttpError(400, "X-Organization-Id header is required");
    }

    const membership = await Membership.findOne({
      user: req.user._id,
      organization: organizationId,
      status: "active",
    }).populate("organization", "name slug status");

    if (!membership || membership.organization.status !== "active") {
      throw new HttpError(403, "Active membership in this organization is required");
    }
    req.membership = membership;
    req.organization = membership.organization;
    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.membership) {
      next(new HttpError(500, "Organization authorization middleware is missing"));
      return;
    }
    if (!roles.includes(req.membership.role)) {
      next(new HttpError(403, "You do not have permission"));
      return;
    }
    next();
  };
}
