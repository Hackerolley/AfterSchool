import { Membership } from "../memberships/membership.model.js";
import { Course } from "../courses/course.model.js";
import { Enrollment } from "../enrollments/enrollment.model.js";
import { SchoolClass } from "./class.model.js";
import { User } from "../users/user.model.js";
import { HttpError } from "../../utils/http-error.js";
import { paginationResult } from "../../utils/pagination.js";

export async function createClass(req, res) {
  const [course, teacher] = await Promise.all([
    Course.findOne({
      _id: req.body.courseId,
      organization: req.organization._id,
      status: "active",
    }),
    Membership.findOne({
      _id: req.body.teacherMembershipId,
      organization: req.organization._id,
      role: "teacher",
      status: "active",
    }),
  ]);
  if (!course) throw new HttpError(400, "An active course in this organization is required");
  if (!teacher) throw new HttpError(400, "An active teacher in this organization is required");

  const schoolClass = await SchoolClass.create({
    organization: req.organization._id,
    course: course._id,
    name: req.body.name,
    teacher: teacher._id,
    capacity: req.body.capacity,
  });
  res.status(201).json({ success: true, data: schoolClass });
}

function visibleClassesFilter(membership, organizationId) {
  const filter = { organization: organizationId };
  if (membership.role === "teacher") filter.teacher = membership._id;
  return filter;
}

export async function listClasses(req, res) {
  const { page, limit, search, status } = req.validatedQuery;
  const filter = visibleClassesFilter(req.membership, req.organization._id);
  if (status) filter.status = status;
  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: safeSearch, $options: "i" };
  }

  if (req.membership.role === "student") {
    const classIds = await Enrollment.find({
      organization: req.organization._id,
      student: req.membership._id,
      status: "active",
    }).distinct("class");
    filter._id = { $in: classIds };
  }

  const [classes, total] = await Promise.all([
    SchoolClass.find(filter)
      .populate("course", "name code")
      .populate({
        path: "teacher",
        select: "user",
        populate: { path: "user", select: "firstName lastName email" },
      })
      .sort({ createdAt: -1, _id: 1 })
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

async function getVisibleClass(req) {
  const schoolClass = await SchoolClass.findOne({
    _id: req.params.classId,
    organization: req.organization._id,
  })
    .populate("course", "name code")
    .populate({
      path: "teacher",
      select: "user",
      populate: { path: "user", select: "firstName lastName email" },
    })
    .lean();

  if (!schoolClass) throw new HttpError(404, "Class not found");
  if (req.membership.role === "teacher" && schoolClass.teacher._id.toString() !== req.membership._id.toString()) {
    throw new HttpError(403, "You do not have permission");
  }
  if (req.membership.role === "student") {
    const enrolled = await Enrollment.exists({
      organization: req.organization._id,
      class: schoolClass._id,
      student: req.membership._id,
      status: "active",
    });
    if (!enrolled) throw new HttpError(403, "You do not have permission");
  }
  return schoolClass;
}

export async function getClass(req, res) {
  const schoolClass = await getVisibleClass(req);
  res.json({ success: true, data: schoolClass });
}

export async function listClassStudents(req, res) {
  const schoolClass = await getVisibleClass(req);
  const { page, limit } = req.validatedQuery;
  const filter = {
    organization: req.organization._id,
    class: schoolClass._id,
    status: "active",
  };
  if (req.membership.role === "student") filter.student = req.membership._id;

  const [enrollments, total] = await Promise.all([
    Enrollment.find(filter)
      .populate({
        path: "student",
        select: "user",
        populate: { path: "user", select: "firstName lastName email status" },
      })
      .sort({ enrolledAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Enrollment.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: enrollments,
    pagination: paginationResult(page, limit, total),
  });
}

export async function enrollStudent(req, res) {
  const [schoolClass, student] = await Promise.all([
    SchoolClass.findOne({
      _id: req.params.classId,
      organization: req.organization._id,
      status: "active",
    }),
    Membership.findOne({
      _id: req.body.studentMembershipId,
      organization: req.organization._id,
      role: "student",
      status: "active",
    }),
  ]);
  if (!schoolClass) throw new HttpError(404, "Active class not found");
  if (!student) throw new HttpError(400, "An active student in this organization is required");

  const reserved = await SchoolClass.findOneAndUpdate(
    {
      _id: schoolClass._id,
      organization: req.organization._id,
      status: "active",
      $expr: { $lt: ["$enrolledCount", "$capacity"] },
    },
    { $inc: { enrolledCount: 1 } },
    { new: true },
  );
  if (!reserved) throw new HttpError(409, "Class has reached its capacity");

  try {
    const enrollment = await Enrollment.create({
      organization: req.organization._id,
      student: student._id,
      class: schoolClass._id,
    });
    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    await SchoolClass.updateOne(
      { _id: schoolClass._id, organization: req.organization._id },
      { $inc: { enrolledCount: -1 } },
    );
    throw error;
  }
}

export async function withdrawStudent(req, res) {
  const enrollment = await Enrollment.findOneAndUpdate(
    {
      _id: req.params.enrollmentId,
      class: req.params.classId,
      organization: req.organization._id,
      status: "active",
    },
    { status: "withdrawn" },
    { new: true },
  );
  if (!enrollment) throw new HttpError(404, "Active enrollment not found");

  const updatedClass = await SchoolClass.updateOne(
    {
      _id: enrollment.class,
      organization: req.organization._id,
      enrolledCount: { $gt: 0 },
    },
    { $inc: { enrolledCount: -1 } },
  );
  if (updatedClass.modifiedCount !== 1) {
    throw new HttpError(500, "Enrollment count could not be updated");
  }
  res.json({ success: true, data: enrollment });
}
