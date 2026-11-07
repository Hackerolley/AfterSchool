import { Membership } from "../memberships/membership.model.js";
import { Course } from "../courses/course.model.js";
import { Enrollment } from "../enrollments/enrollment.model.js";
import { ClassAttendance } from "./class-attendance.model.js";
import { SchoolClass } from "./class.model.js";
import { User } from "../users/user.model.js";
import { HttpError } from "../../utils/http-error.js";
import { paginationResult } from "../../utils/pagination.js";
import { notifyMemberships } from "../notifications/notification.service.js";

async function classMemberRecipients(organizationId, schoolClass, { includeTeacher = true } = {}) {
  const students = await Enrollment.find({
    organization: organizationId,
    class: schoolClass._id,
    status: "active",
  }).distinct("student");
  return [...(includeTeacher && schoolClass.teacher ? [schoolClass.teacher] : []), ...students];
}

export async function listClassAttendance(req, res) {
  const { page, limit, classId } = req.validatedQuery;
  const filter = { organization: req.organization._id };
  if (req.membership.role === "teacher") {
    const assignedClasses = await SchoolClass.find({
      organization: req.organization._id,
      teacher: req.membership._id,
      status: "active",
    }).distinct("_id");
    filter.class = classId
      ? { $in: assignedClasses.filter((id) => id.toString() === classId) }
      : { $in: assignedClasses };
  } else if (req.membership.role === "student") {
    const enrolledClasses = await Enrollment.find({
      organization: req.organization._id,
      student: req.membership._id,
      status: "active",
    }).distinct("class");
    filter.class = classId
      ? { $in: enrolledClasses.filter((id) => id.toString() === classId) }
      : { $in: enrolledClasses };
  } else if (classId) {
    filter.class = classId;
  }

  let recordsQuery = ClassAttendance.find(filter).populate("class", "name");
  if (req.membership.role !== "student") {
    recordsQuery = recordsQuery.populate({
      path: "markedBy",
      select: "user",
      populate: { path: "user", select: "firstName lastName" },
    });
  }
  const [records, total] = await Promise.all([
    recordsQuery
      .sort({ sessionDate: -1, startTime: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ClassAttendance.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: records,
    pagination: paginationResult(page, limit, total),
  });
}

export async function recordClassAttendance(req, res) {
  const schoolClass = await SchoolClass.findOne({
    _id: req.params.classId,
    organization: req.organization._id,
    status: "active",
    ...(req.membership.role === "teacher" ? { teacher: req.membership._id } : {}),
  }).select("_id name teacher");
  if (!schoolClass) throw new HttpError(404, "Assigned active class not found");

  const { action, ...session } = req.body;
  const update = {
    status: action,
    endTime: session.endTime,
    markedBy: req.membership._id,
    markedAt: new Date(),
  };
  if (session.note !== undefined) update.note = session.note;
  if (action === "rescheduled") {
    update.rescheduledDate = session.rescheduledDate;
    update.rescheduledStartTime = session.rescheduledStartTime;
    update.rescheduledEndTime = session.rescheduledEndTime;
  }

  const attendance = await ClassAttendance.findOneAndUpdate(
    {
      organization: req.organization._id,
      class: schoolClass._id,
      sessionDate: session.sessionDate,
      startTime: session.startTime,
    },
    {
      $set: update,
      $setOnInsert: {
        organization: req.organization._id,
        class: schoolClass._id,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  const recipients = await classMemberRecipients(req.organization._id, schoolClass, {
    includeTeacher: schoolClass.teacher.toString() !== req.membership._id.toString(),
  });
  const actionMessage = action === "rescheduled"
    ? `Class session on ${session.sessionDate} was rescheduled to ${session.rescheduledDate} at ${session.rescheduledStartTime}.`
    : `The class session on ${session.sessionDate} was marked ${action}.`;
  await notifyMemberships({
    organization: req.organization._id,
    recipients,
    type: "class_attendance",
    title: `Class session · ${schoolClass.name}`,
    message: actionMessage,
    schoolClass,
  });
  res.status(200).json({ success: true, data: attendance });
}

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
    timetable: req.body.timetable,
  });
  res.status(201).json({ success: true, data: schoolClass });
}

export async function updateClass(req, res) {
  if (req.body.status === "active") {
    const currentClass = await SchoolClass.findOne({
      _id: req.params.classId,
      organization: req.organization._id,
    }).select("course teacher");
    if (!currentClass) throw new HttpError(404, "Class not found");
    const [course, teacher] = await Promise.all([
      Course.exists({ _id: currentClass.course, organization: req.organization._id, status: "active" }),
      Membership.exists({
        _id: currentClass.teacher,
        organization: req.organization._id,
        role: "teacher",
        status: "active",
      }),
    ]);
    if (!course || !teacher) {
      throw new HttpError(409, "Restore the assigned course and teacher before restoring this class");
    }
  }

  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.capacity !== undefined) updates.capacity = req.body.capacity;
  if (req.body.status !== undefined) updates.status = req.body.status;

  if (req.body.courseId !== undefined) {
    const course = await Course.findOne({
      _id: req.body.courseId,
      organization: req.organization._id,
      status: "active",
    }).select("_id");
    if (!course) throw new HttpError(400, "An active course in this organization is required");
    updates.course = course._id;
  }
  if (req.body.teacherMembershipId !== undefined) {
    const teacher = await Membership.findOne({
      _id: req.body.teacherMembershipId,
      organization: req.organization._id,
      role: "teacher",
      status: "active",
    }).select("_id");
    if (!teacher) throw new HttpError(400, "An active teacher in this organization is required");
    updates.teacher = teacher._id;
  }

  const schoolClass = await SchoolClass.findOneAndUpdate(
    { _id: req.params.classId, organization: req.organization._id },
    updates,
    { new: true, runValidators: true },
  );
  if (!schoolClass) throw new HttpError(404, "Class not found");
  res.json({ success: true, data: schoolClass });
}

export async function archiveClass(req, res) {
  const schoolClass = await SchoolClass.findOneAndUpdate(
    { _id: req.params.classId, organization: req.organization._id, status: "active" },
    { status: "archived" },
    { new: true, runValidators: true },
  );
  if (!schoolClass) throw new HttpError(404, "Active class not found");
  res.json({ success: true, data: schoolClass });
}

export async function updateClassTimetable(req, res) {
  const schoolClass = await SchoolClass.findOneAndUpdate(
    {
      _id: req.params.classId,
      organization: req.organization._id,
      status: "active",
    },
    {
      timetable: req.body.timetable,
      $unset: { pendingTimetable: 1, timetableRequestedAt: 1, timetableRequestedBy: 1 },
    },
    { new: true, runValidators: true },
  );
  if (!schoolClass) throw new HttpError(404, "Active class not found");
  await notifyMemberships({
    organization: req.organization._id,
    recipients: await classMemberRecipients(req.organization._id, schoolClass),
    type: "timetable_updated",
    title: `Timetable updated · ${schoolClass.name}`,
    message: `The timetable for ${schoolClass.name} has been updated.`,
    schoolClass,
  });
  res.json({ success: true, data: schoolClass });
}

export async function requestClassTimetableChange(req, res) {
  const schoolClass = await SchoolClass.findOneAndUpdate(
    {
      _id: req.params.classId,
      organization: req.organization._id,
      teacher: req.membership._id,
      status: "active",
    },
    {
      pendingTimetable: req.body.timetable,
      timetableRequestedAt: new Date(),
      timetableRequestedBy: req.membership._id,
    },
    { new: true, runValidators: true },
  );
  if (!schoolClass) throw new HttpError(404, "Assigned active class not found");
  const administrators = await Membership.find({
    organization: req.organization._id,
    role: "admin",
    status: "active",
  }).distinct("_id");
  await notifyMemberships({
    organization: req.organization._id,
    recipients: [req.membership._id, ...administrators],
    type: "timetable_request",
    title: `Timetable approval requested · ${schoolClass.name}`,
    message: `A teacher requested a timetable change for ${schoolClass.name}.`,
    schoolClass,
  });
  res.json({ success: true, data: schoolClass });
}

export async function approveClassTimetableChange(req, res) {
  const requestedClass = await SchoolClass.findOne({
    _id: req.params.classId,
    organization: req.organization._id,
    status: "active",
    timetableRequestedAt: { $ne: null },
  }).select("_id name teacher timetableRequestedBy").lean();
  if (!requestedClass) throw new HttpError(404, "No pending timetable change for this class");
  const schoolClass = await SchoolClass.findOneAndUpdate(
    {
      _id: req.params.classId,
      organization: req.organization._id,
      status: "active",
      timetableRequestedAt: { $ne: null },
    },
    [
      { $set: { timetable: "$pendingTimetable" } },
      { $unset: ["pendingTimetable", "timetableRequestedAt", "timetableRequestedBy"] },
    ],
    { new: true },
  );
  if (!schoolClass) throw new HttpError(404, "No pending timetable change for this class");
  const recipients = await classMemberRecipients(req.organization._id, requestedClass);
  await notifyMemberships({
    organization: req.organization._id,
    recipients,
    type: "timetable_approved",
    title: `Timetable change approved · ${schoolClass.name}`,
    message: `The timetable change for ${schoolClass.name} was approved.`,
    schoolClass,
  });
  res.json({ success: true, data: schoolClass });
}

export async function rejectClassTimetableChange(req, res) {
  const requestedClass = await SchoolClass.findOne({
    _id: req.params.classId,
    organization: req.organization._id,
    status: "active",
    timetableRequestedAt: { $ne: null },
  }).select("_id name timetableRequestedBy").lean();
  if (!requestedClass) throw new HttpError(404, "No pending timetable change for this class");
  const schoolClass = await SchoolClass.findOneAndUpdate(
    {
      _id: req.params.classId,
      organization: req.organization._id,
      status: "active",
      timetableRequestedAt: { $ne: null },
    },
    {
      $unset: { pendingTimetable: 1, timetableRequestedAt: 1, timetableRequestedBy: 1 },
    },
    { new: true },
  );
  if (!schoolClass) throw new HttpError(404, "No pending timetable change for this class");
  await notifyMemberships({
    organization: req.organization._id,
    recipients: [requestedClass.timetableRequestedBy],
    type: "timetable_rejected",
    title: `Timetable change not approved · ${schoolClass.name}`,
    message: `The timetable change request for ${schoolClass.name} was not approved.`,
    schoolClass,
  });
  res.json({ success: true, data: schoolClass });
}

function visibleClassesFilter(membership, organizationId) {
  const filter = { organization: organizationId };
  if (membership.role === "teacher") filter.teacher = membership._id;
  return filter;
}

export async function listClasses(req, res) {
  const { page, limit, search, status } = req.validatedQuery;
  const filter = visibleClassesFilter(req.membership, req.organization._id);
  filter.status = req.membership.role === "admin" ? status || "active" : "active";
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
      .populate({
        path: "timetableRequestedBy",
        select: "user",
        populate: { path: "user", select: "firstName lastName" },
      })
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SchoolClass.countDocuments(filter),
  ]);
  if (req.membership.role === "student") {
    for (const schoolClass of classes) {
      delete schoolClass.pendingTimetable;
      delete schoolClass.timetableRequestedAt;
      delete schoolClass.timetableRequestedBy;
    }
  }
  res.json({
    success: true,
    data: classes,
    pagination: paginationResult(page, limit, total),
  });
}

export async function getVisibleClass(req) {
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
    .populate({
      path: "timetableRequestedBy",
      select: "user",
      populate: { path: "user", select: "firstName lastName" },
    })
    .lean();

  if (!schoolClass) throw new HttpError(404, "Class not found");
  if (schoolClass.status !== "active" && req.membership.role !== "admin") {
    throw new HttpError(404, "Class not found");
  }
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
    delete schoolClass.pendingTimetable;
    delete schoolClass.timetableRequestedAt;
    delete schoolClass.timetableRequestedBy;
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

  let enrollment;
  try {
    enrollment = await Enrollment.create({
      organization: req.organization._id,
      student: student._id,
      class: schoolClass._id,
    });
  } catch (error) {
    await SchoolClass.updateOne(
      { _id: schoolClass._id, organization: req.organization._id },
      { $inc: { enrolledCount: -1 } },
    );
    throw error;
  }
  await notifyMemberships({
    organization: req.organization._id,
    recipients: [student._id, schoolClass.teacher],
    type: "enrollment_added",
    title: `Class enrollment · ${schoolClass.name}`,
    message: `A student was enrolled in ${schoolClass.name}.`,
    schoolClass,
  });
  res.status(201).json({ success: true, data: enrollment });
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
  const schoolClass = await SchoolClass.findById(enrollment.class).select("_id name teacher");
  const recipients = [enrollment.student, schoolClass?.teacher].filter((recipient) =>
    recipient && recipient.toString() !== req.membership._id.toString());
  await notifyMemberships({
    organization: req.organization._id,
    recipients,
    type: "enrollment_withdrawn",
    title: `Class enrollment ended · ${schoolClass?.name || "Class"}`,
    message: `A student was withdrawn from ${schoolClass?.name || "the class"}.`,
    schoolClass,
  });
  res.json({ success: true, data: enrollment });
}
