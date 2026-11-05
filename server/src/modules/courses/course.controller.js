import { SchoolClass } from "../classes/class.model.js";
import { Enrollment } from "../enrollments/enrollment.model.js";
import { Course } from "./course.model.js";
import { HttpError } from "../../utils/http-error.js";
import { paginationResult } from "../../utils/pagination.js";

export async function createCourse(req, res) {
  const course = await Course.create({
    ...req.body,
    organization: req.organization._id,
  });
  res.status(201).json({ success: true, data: course });
}

export async function updateCourse(req, res) {
  const filter = { _id: req.params.courseId, organization: req.organization._id };
  const existing = await Course.exists(filter);
  if (!existing) throw new HttpError(404, "Course not found");
  if (req.body.status === "archived") {
    const activeClass = await SchoolClass.exists({
      organization: req.organization._id,
      course: req.params.courseId,
      status: "active",
    });
    if (activeClass) {
      throw new HttpError(409, "Archive the course's active classes before archiving this course");
    }
  }

  const course = await Course.findOneAndUpdate(
    filter,
    req.body,
    { new: true, runValidators: true },
  );
  if (!course) throw new HttpError(404, "Course not found");
  res.json({ success: true, data: course });
}

export async function archiveCourse(req, res) {
  const filter = { _id: req.params.courseId, organization: req.organization._id };
  const course = await Course.findOne(filter).select("_id");
  if (!course) throw new HttpError(404, "Course not found");

  const activeClass = await SchoolClass.exists({
    organization: req.organization._id,
    course: course._id,
    status: "active",
  });
  if (activeClass) {
    throw new HttpError(409, "Archive the course's active classes before archiving this course");
  }

  const archived = await Course.findOneAndUpdate(
    { ...filter, status: "active" },
    { status: "archived" },
    { new: true, runValidators: true },
  );
  if (!archived) throw new HttpError(404, "Active course not found");
  res.json({ success: true, data: archived });
}

export async function listCourses(req, res) {
  const { page, limit, search, status } = req.validatedQuery;
  const filter = { organization: req.organization._id };
  filter.status = req.membership.role === "admin" ? status || "active" : "active";

  if (req.membership.role === "teacher") {
    const classes = await SchoolClass.find({
      organization: req.organization._id,
      teacher: req.membership._id,
      status: "active",
    }).distinct("course");
    filter._id = { $in: classes };
  } else if (req.membership.role === "student") {
    const enrollments = await Enrollment.find({
      organization: req.organization._id,
      student: req.membership._id,
      status: "active",
    }).distinct("class");
    const courses = await SchoolClass.find({
      organization: req.organization._id,
      _id: { $in: enrollments },
      status: "active",
    }).distinct("course");
    filter._id = { $in: courses };
  }

  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { code: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const [courses, total] = await Promise.all([
    Course.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Course.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: courses,
    pagination: paginationResult(page, limit, total),
  });
}

export async function getCourse(req, res) {
  const course = await Course.findOne({
    _id: req.params.courseId,
    organization: req.organization._id,
  }).lean();
  if (!course) throw new HttpError(404, "Course not found");
  if (course.status !== "active" && req.membership.role !== "admin") {
    throw new HttpError(404, "Course not found");
  }

  if (req.membership.role === "teacher") {
    const assigned = await SchoolClass.exists({
      organization: req.organization._id,
      course: course._id,
      teacher: req.membership._id,
    });
    if (!assigned) throw new HttpError(403, "You do not have permission");
  } else if (req.membership.role === "student") {
    const classIds = await Enrollment.find({
      organization: req.organization._id,
      student: req.membership._id,
      status: "active",
    }).distinct("class");
    const enrolled = await SchoolClass.exists({
      organization: req.organization._id,
      _id: { $in: classIds },
      course: course._id,
    });
    if (!enrolled) throw new HttpError(403, "You do not have permission");
  }

  res.json({ success: true, data: course });
}
