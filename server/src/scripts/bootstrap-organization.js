import { config } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { Organization } from "../modules/organizations/organization.model.js";
import { Membership } from "../modules/memberships/membership.model.js";
import { User, hashPassword } from "../modules/users/user.model.js";

const name = process.env.BOOTSTRAP_ORG_NAME?.trim();
const slug = process.env.BOOTSTRAP_ORG_SLUG?.trim().toLowerCase();
const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim();
const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim();
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!name || !slug || !firstName || !lastName || !email || !password) {
  throw new Error(
    "Set BOOTSTRAP_ORG_NAME, BOOTSTRAP_ORG_SLUG, BOOTSTRAP_ADMIN_FIRST_NAME, BOOTSTRAP_ADMIN_LAST_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD",
  );
}
if (password.length < 12 || password.length > 128) {
  throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be between 12 and 128 characters");
}

let organization;
let user;
try {
  await connectDatabase(config.MONGODB_URI);
  if (await Organization.exists({ slug })) throw new Error("Organization slug already exists");
  if (await User.exists({ email })) throw new Error("Admin email already exists");

  organization = await Organization.create({ name, slug });
  user = await User.create({
    firstName,
    lastName,
    email,
    passwordHash: await hashPassword(password),
  });
  await Membership.create({
    organization: organization._id,
    user: user._id,
    role: "admin",
  });

  console.info(`Created organization "${organization.name}" and its initial administrator.`);
} catch (error) {
  if (user) await User.deleteOne({ _id: user._id });
  if (organization) await Organization.deleteOne({ _id: organization._id });
  console.error("Organization bootstrap failed", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
