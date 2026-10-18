import { Membership } from "../memberships/membership.model.js";
import { StudentProfile } from "../students/student-profile.model.js";
import { TeacherProfile } from "../teachers/teacher-profile.model.js";
import { hashPassword, User } from "./user.model.js";
import { HttpError } from "../../utils/http-error.js";

export async function createOrganizationUser(organizationId, input) {
  let user = await User.findOne({ email: input.email });
  let createdUser = false;
  if (user) {
    if (user.status !== "active") {
      throw new HttpError(409, "This account is not active");
    }
    if (await Membership.exists({ organization: organizationId, user: user._id })) {
      throw new HttpError(409, "This user is already a member of the organization");
    }
  } else {
    if (!input.password) {
      throw new HttpError(400, "A password is required when creating a new account");
    }
    user = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    });
    createdUser = true;
  }

  let membership;
  try {
    membership = await Membership.create({
      organization: organizationId,
      user: user._id,
      role: input.role,
    });

    if (input.role === "teacher") {
      await TeacherProfile.create({
        organization: organizationId,
        membership: membership._id,
        employeeId: input.employeeId,
        qualifications: input.qualifications,
        specialization: input.specialization,
      });
    } else {
      await StudentProfile.create({
        organization: organizationId,
        membership: membership._id,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        genderDescription: input.genderDescription,
        countryOfResidence: input.countryOfResidence,
        homeCountry: input.homeCountry,
        phoneNumber: input.phoneNumber,
        studentNumber: input.studentNumber,
        guardianName: input.guardianName,
        guardianEmail: input.guardianEmail,
        guardianPhone: input.guardianPhone,
      });
    }
  } catch (error) {
    if (membership) {
      await Promise.all([
        TeacherProfile.deleteOne({ membership: membership._id }),
        StudentProfile.deleteOne({ membership: membership._id }),
        Membership.deleteOne({ _id: membership._id }),
      ]);
    }
    if (createdUser && !(await Membership.exists({ user: user._id }))) {
      await User.deleteOne({ _id: user._id });
    }
    throw error;
  }

  return {
    membership,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
    },
  };
}
