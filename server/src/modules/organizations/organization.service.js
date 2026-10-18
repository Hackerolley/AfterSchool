import mongoose from "mongoose";
import { HttpError } from "../../utils/http-error.js";
import { Membership } from "../memberships/membership.model.js";
import { User, hashPassword } from "../users/user.model.js";
import { Organization } from "./organization.model.js";

export async function createOrganizationWithAdmin(input) {
  const databaseSession = await mongoose.startSession();
  let result;
  try {
    await databaseSession.withTransaction(async () => {
      if (await Organization.exists({ slug: input.slug }).session(databaseSession)) {
        throw new HttpError(409, "An organization with this slug already exists");
      }
      if (await User.exists({ email: input.admin.email }).session(databaseSession)) {
        throw new HttpError(409, "An account with this email already exists");
      }

      const [organization] = await Organization.create(
        [{ name: input.name, slug: input.slug }],
        { session: databaseSession },
      );
      const [admin] = await User.create(
        [{
          firstName: input.admin.firstName,
          lastName: input.admin.lastName,
          email: input.admin.email,
          passwordHash: await hashPassword(input.admin.password),
        }],
        { session: databaseSession },
      );
      const [membership] = await Membership.create(
        [{
          organization: organization._id,
          user: admin._id,
          role: "admin",
        }],
        { session: databaseSession },
      );

      result = {
        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
        },
        admin: {
          membershipId: membership._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: membership.role,
        },
      };
    });
  } finally {
    await databaseSession.endSession();
  }
  return result;
}
