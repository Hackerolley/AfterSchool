import { Membership } from "../memberships/membership.model.js";
import { Organization } from "../organizations/organization.model.js";
import { User } from "../users/user.model.js";
import { rotateCsrfToken } from "../../middleware/csrf.js";
import { HttpError } from "../../utils/http-error.js";

function regenerateSession(session) {
  return new Promise((resolve, reject) => {
    session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(session) {
  return new Promise((resolve, reject) => {
    session.save((error) => (error ? reject(error) : resolve()));
  });
}

export async function login(req, res) {
  const { email, password, organizationId, organizationSlug } = req.body;
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || user.status !== "active" || !(await user.verifyPassword(password))) {
    throw new HttpError(401, "Invalid email or password");
  }

  const organization = await Organization.findOne({
    ...(organizationId ? { _id: organizationId } : { slug: organizationSlug }),
    status: "active",
  }).select("_id name slug logoUrl");
  if (!organization) throw new HttpError(401, "Invalid email or password");

  const membership = await Membership.findOne({
    user: user._id,
    organization: organization._id,
    status: "active",
  }).populate("organization", "name slug status logoUrl");
  if (!membership || membership.organization.status !== "active") {
    throw new HttpError(401, "Invalid email or password");
  }

  await regenerateSession(req.session);
  req.session.userId = user._id.toString();
  rotateCsrfToken(req);
  await saveSession(req.session);

  res.json({
    success: true,
    data: {
      user: publicUser(user),
      organization: {
        id: membership.organization._id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        logoUrl: membership.organization.logoUrl,
      },
      role: membership.role,
      csrfToken: req.session.csrfToken,
    },
  });
}

export async function platformLogin(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({
    email,
    status: "active",
    platformRole: "platform_admin",
  }).select("+passwordHash");
  if (!user || !(await user.verifyPassword(password))) {
    throw new HttpError(401, "Invalid email or password");
  }

  await regenerateSession(req.session);
  req.session.userId = user._id.toString();
  rotateCsrfToken(req);
  await saveSession(req.session);

  res.json({
    success: true,
    data: {
      user: publicUser(user),
      role: user.platformRole,
      csrfToken: req.session.csrfToken,
    },
  });
}

export function platformMe(req, res) {
  res.json({
    success: true,
    data: {
      user: publicUser(req.user),
      role: req.user.platformRole,
    },
  });
}

export async function logout(req, res) {
  await new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
  res.clearCookie("afterschool.sid");
  res.json({ success: true, data: { message: "Logged out" } });
}

export function me(req, res) {
  res.json({
    success: true,
    data: {
      user: publicUser(req.user),
      organization: {
        id: req.organization._id,
        name: req.organization.name,
        slug: req.organization.slug,
        logoUrl: req.organization.logoUrl,
      },
      role: req.membership.role,
    },
  });
}

function publicUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl || "",
  };
}
