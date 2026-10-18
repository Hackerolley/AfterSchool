import { Membership } from "../memberships/membership.model.js";
import { SchoolClass } from "../classes/class.model.js";
import { Enrollment } from "../enrollments/enrollment.model.js";
import { StudentProfile } from "../students/student-profile.model.js";
import { TeacherProfile } from "../teachers/teacher-profile.model.js";
import { User } from "./user.model.js";
import { createOrganizationUser } from "./user.service.js";
import { HttpError } from "../../utils/http-error.js";
import { paginationResult } from "../../utils/pagination.js";

export async function createUser(req, res) {
  const created = await createOrganizationUser(req.organization._id, req.body);
  res.status(201).json({ success: true, data: created });
}

export async function listUsers(req, res) {
  const { page, limit, search, role, status } = req.validatedQuery;
  const filter = { organization: req.organization._id };
  if (role) filter.role = role;
  if (status) filter.status = status;

  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchingUsers = await User.find({
      $or: [
        { firstName: { $regex: safeSearch, $options: "i" } },
        { lastName: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
      ],
    }).select("_id");
    filter.user = { $in: matchingUsers.map((user) => user._id) };
  }

  const [memberships, total] = await Promise.all([
    Membership.find(filter)
      .populate("user", "firstName lastName email status")
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Membership.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: memberships,
    pagination: paginationResult(page, limit, total),
  });
}

export async function getUser(req, res) {
  const membership = await Membership.findOne({
    _id: req.params.membershipId,
    organization: req.organization._id,
  }).populate("user", "firstName lastName email status");
  if (!membership) throw new HttpError(404, "User not found");
  res.json({ success: true, data: membership });
}

export async function updateMembershipStatus(req, res) {
  const membership = await Membership.findOneAndUpdate(
    { _id: req.params.membershipId, organization: req.organization._id },
    { status: req.body.status },
    { new: true, runValidators: true },
  ).populate("user", "firstName lastName email status");
  if (!membership) throw new HttpError(404, "User not found");
  res.json({ success: true, data: membership });
}

export async function listDirectoryRole(req, res, role) {
  const { page, limit, search } = req.validatedQuery;
  const query = { organization: req.organization._id, role, status: "active" };
  if (req.membership.role === "teacher") {
    if (role !== "student") throw new HttpError(403, "You do not have permission");
    const assignedClasses = await SchoolClass.find({
      organization: req.organization._id,
      teacher: req.membership._id,
      status: "active",
    }).distinct("_id");
    const assignedStudents = await Enrollment.find({
      organization: req.organization._id,
      class: { $in: assignedClasses },
      status: "active",
    }).distinct("student");
    query._id = { $in: assignedStudents };
  } else if (req.membership.role === "student") {
    if (role !== "student") throw new HttpError(403, "You do not have permission");
    query._id = req.membership._id;
  } else if (req.membership.role !== "admin") {
    throw new HttpError(403, "You do not have permission");
  }

  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchingUsers = await User.find({
      $or: [
        { firstName: { $regex: safeSearch, $options: "i" } },
        { lastName: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
      ],
    }).select("_id");
    query.user = { $in: matchingUsers.map((user) => user._id) };
  }

  const [memberships, total] = await Promise.all([
    Membership.find(query)
      .populate("user", "firstName lastName email status")
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Membership.countDocuments(query),
  ]);
  const profileModel = role === "student" ? StudentProfile : TeacherProfile;
  const profiles = await profileModel.find({
    organization: req.organization._id,
    membership: { $in: memberships.map((membership) => membership._id) },
  }).lean();
  const profileByMembership = new Map(profiles.map((profile) => [profile.membership.toString(), profile]));
  res.json({
    success: true,
    data: memberships.map((membership) => ({
      ...membership,
      profile: profileByMembership.get(membership._id.toString()) ?? null,
    })),
    pagination: paginationResult(page, limit, total),
  });
}

export async function getDirectoryRole(req, res, role) {
  const membership = await Membership.findOne({
    _id: req.params.membershipId,
    organization: req.organization._id,
    role,
    status: "active",
  }).populate("user", "firstName lastName email status").lean();
  if (!membership) throw new HttpError(404, "User not found");

  if (req.membership.role === "teacher") {
    const canView = role === "student" && await Enrollment.exists({
      organization: req.organization._id,
      student: membership._id,
      class: {
        $in: await SchoolClass.find({
          organization: req.organization._id,
          teacher: req.membership._id,
          status: "active",
        }).distinct("_id"),
      },
      status: "active",
    });
    if (!canView) throw new HttpError(403, "You do not have permission");
  } else if (req.membership.role === "student") {
    if (role !== "student" || membership._id.toString() !== req.membership._id.toString()) {
      throw new HttpError(403, "You do not have permission");
    }
  } else if (req.membership.role !== "admin") {
    throw new HttpError(403, "You do not have permission");
  }

  const profileModel = role === "student" ? StudentProfile : TeacherProfile;
  const profile = await profileModel.findOne({
    organization: req.organization._id,
    membership: membership._id,
  }).lean();
  res.json({ success: true, data: { ...membership, profile: profile ?? null } });
}

export async function listTeacherClasses(req, res) {
  const { page, limit } = req.validatedQuery;
  const teacherId = req.params.membershipId;
  if (req.membership.role !== "admin" && req.membership._id.toString() !== teacherId) {
    throw new HttpError(403, "You do not have permission");
  }
  const teacher = await Membership.exists({
    _id: teacherId,
    organization: req.organization._id,
    role: "teacher",
  });
  if (!teacher) throw new HttpError(404, "Teacher not found");

  const filter = { organization: req.organization._id, teacher: teacherId };
  const [classes, total] = await Promise.all([
    SchoolClass.find(filter)
      .populate("course", "name code")
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SchoolClass.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: classes,
    pagination: paginationResult(page, limit, total),
  });
}
