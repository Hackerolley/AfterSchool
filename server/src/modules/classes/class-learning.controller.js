import { extname } from "node:path";
import { Assignment, AssignmentSubmission } from "../assignments/assignment.model.js";
import { deleteDocument, deleteVideo, privateDocumentUrl, privateVideoUrl, uploadDocument, uploadVideo } from "../assignments/cloudinary.service.js";
import { Enrollment } from "../enrollments/enrollment.model.js";
import { Membership } from "../memberships/membership.model.js";
import { SchoolClass } from "./class.model.js";
import { ClassResource } from "./class-resource.model.js";
import { StudentAttendance } from "./student-attendance.model.js";
import { StudentProgress } from "./student-progress.model.js";
import { getVisibleClass } from "./class.controller.js";
import { createProgressReportPdf } from "./progress-report.pdf.js";
import { HttpError } from "../../utils/http-error.js";
import { notifyMemberships } from "../notifications/notification.service.js";

function safeResource(resource) {
  const value = resource.toObject ? resource.toObject() : resource;
  return {
    ...value,
    attachment: value.attachment
      ? { originalFilename: value.attachment.originalFilename, format: value.attachment.format, bytes: value.attachment.bytes }
      : undefined,
  };
}

function getMonthPeriod(month) {
  const selectedMonth = month || new Date().toISOString().slice(0, 7);
  const start = new Date(`${selectedMonth}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(start);
  return { month: selectedMonth, start, end, monthLabel };
}

function emptyAttendance() {
  return { present: 0, late: 0, absent: 0, excused: 0 };
}

async function getMonthlyClassMetrics(organizationId, classId, studentIds, period) {
  const metricsByStudent = new Map(studentIds.map((studentId) => [studentId.toString(), {
    attendance: emptyAttendance(),
    assignments: { total: 0, submitted: 0, reviewed: 0, averageScore: null },
  }]));
  if (!studentIds.length) return metricsByStudent;

  const [attendance, assignments] = await Promise.all([
    StudentAttendance.find({
      organization: organizationId,
      class: classId,
      student: { $in: studentIds },
      sessionDate: { $gte: period.month + "-01", $lt: period.end.toISOString().slice(0, 10) },
    }).select("student status").lean(),
    Assignment.find({
      organization: organizationId,
      class: classId,
      status: "published",
      $or: [
        { dueAt: { $gte: period.start, $lt: period.end } },
        { createdAt: { $gte: period.start, $lt: period.end } },
      ],
    }).select("_id").lean(),
  ]);
  for (const record of attendance) {
    const metrics = metricsByStudent.get(record.student.toString());
    if (metrics) metrics.attendance[record.status] += 1;
  }
  const assignmentIds = assignments.map((assignment) => assignment._id);
  for (const metrics of metricsByStudent.values()) metrics.assignments.total = assignmentIds.length;
  if (assignmentIds.length) {
    const submissions = await AssignmentSubmission.find({
      organization: organizationId,
      student: { $in: studentIds },
      assignment: { $in: assignmentIds },
      submittedAt: { $lt: period.end },
    }).select("student score").lean();
    const scoreTotals = new Map();
    for (const submission of submissions) {
      const metrics = metricsByStudent.get(submission.student.toString());
      if (!metrics) continue;
      metrics.assignments.submitted += 1;
      if (Number.isFinite(submission.score)) {
        metrics.assignments.reviewed += 1;
        const total = scoreTotals.get(submission.student.toString()) || { sum: 0, count: 0 };
        total.sum += submission.score;
        total.count += 1;
        scoreTotals.set(submission.student.toString(), total);
      }
    }
    for (const [studentId, total] of scoreTotals) {
      metricsByStudent.get(studentId).assignments.averageScore = Math.round(total.sum / total.count);
    }
  }
  return metricsByStudent;
}

async function getMonthlyStudentMetrics(organizationId, classId, studentId, period) {
  const metrics = await getMonthlyClassMetrics(organizationId, classId, [studentId], period);
  return metrics.get(studentId.toString());
}

async function listActiveStudents(organizationId, classId, studentId) {
  const filter = { organization: organizationId, class: classId, status: "active" };
  if (studentId) filter.student = studentId;
  const enrollments = await Enrollment.find(filter)
    .populate({ path: "student", select: "user", populate: { path: "user", select: "firstName lastName email" } })
    .sort({ enrolledAt: 1, _id: 1 })
    .lean();
  return enrollments.filter((enrollment) => enrollment.student);
}

async function requireEditableClass(req) {
  if (!["admin", "teacher"].includes(req.membership.role)) {
    throw new HttpError(403, "Teacher permission required");
  }
  const schoolClass = await getVisibleClass(req);
  if (schoolClass.status !== "active") throw new HttpError(404, "Active class not found");
  return schoolClass;
}

export async function listClassResources(req, res) {
  const schoolClass = await getVisibleClass(req);
  const resources = await ClassResource.find({
    organization: req.organization._id,
    class: schoolClass._id,
  }).sort({ createdAt: -1, _id: -1 }).lean();
  res.json({ success: true, data: resources.map(safeResource) });
}

export async function createClassResource(req, res) {
  const schoolClass = await requireEditableClass(req);
  const type = req.body.type;
  if (["pdf", "video"].includes(type) && !req.file) {
    throw new HttpError(400, type === "pdf" ? "Choose a PDF to upload" : "Choose a video to upload");
  }
  if (!["pdf", "video"].includes(type) && req.file) {
    throw new HttpError(400, "Files are only accepted for PDF and video resources");
  }
  const uploadedPdf = req.file && extname(req.file.originalname).toLowerCase() === ".pdf";
  if (req.file && ((type === "pdf") !== uploadedPdf)) {
    throw new HttpError(400, "The uploaded file type must match the selected resource type");
  }

  let attachment;
  try {
    if (type === "pdf") attachment = await uploadDocument(req.file, req.organization._id, req.app.locals.config);
    if (type === "video") attachment = await uploadVideo(req.file, req.organization._id, req.app.locals.config);
    const resource = await ClassResource.create({
      organization: req.organization._id,
      class: schoolClass._id,
      teacher: req.membership._id,
      ...req.body,
      ...(attachment ? { attachment } : {}),
    });
    res.status(201).json({ success: true, data: safeResource(resource) });
  } catch (error) {
    if (attachment) {
      if (type === "video") await deleteVideo(attachment, req.app.locals.config);
      else await deleteDocument(attachment, req.app.locals.config);
    }
    throw error;
  }
}

export async function deleteClassResource(req, res) {
  const schoolClass = await requireEditableClass(req);
  const resource = await ClassResource.findOneAndDelete({
    _id: req.params.resourceId,
    organization: req.organization._id,
    class: schoolClass._id,
  });
  if (!resource) throw new HttpError(404, "Class resource not found");
  if (resource.attachment) {
    if (resource.type === "video") await deleteVideo(resource.attachment, req.app.locals.config);
    else await deleteDocument(resource.attachment, req.app.locals.config);
  }
  res.json({ success: true, data: { id: resource._id } });
}

export async function getClassResourceFile(req, res) {
  const schoolClass = await getVisibleClass(req);
  const resource = await ClassResource.findOne({
    _id: req.params.resourceId,
    organization: req.organization._id,
    class: schoolClass._id,
  }).select("type attachment");
  if (!resource?.attachment) throw new HttpError(404, "Class resource file not found");
  const url = resource.type === "video"
    ? privateVideoUrl(resource.attachment, req.app.locals.config)
    : privateDocumentUrl(resource.attachment, req.app.locals.config);
  res.redirect(url);
}

export async function getClassLearning(req, res) {
  const schoolClass = await getVisibleClass(req);
  const period = getMonthPeriod(req.validatedQuery.month);
  const studentId = req.membership.role === "student" ? req.membership._id : undefined;
  const [resources, enrollments, progressRecords] = await Promise.all([
    ClassResource.find({ organization: req.organization._id, class: schoolClass._id })
      .sort({ createdAt: -1, _id: -1 }).lean(),
    listActiveStudents(req.organization._id, schoolClass._id, studentId),
    StudentProgress.find({
      organization: req.organization._id,
      class: schoolClass._id,
      month: period.month,
      ...(studentId ? { student: studentId } : {}),
    }).lean(),
  ]);
  const metricsByStudent = await getMonthlyClassMetrics(
    req.organization._id,
    schoolClass._id,
    enrollments.map((enrollment) => enrollment.student._id),
    period,
  );
  const progressByStudent = new Map(progressRecords.map((record) => [record.student.toString(), record]));
  const students = enrollments.map((enrollment) => {
    const membership = enrollment.student;
    const metrics = metricsByStudent.get(membership._id.toString());
    const progress = progressByStudent.get(membership._id.toString()) || null;
    if (req.membership.role === "student" && progress) delete progress.teacherNotes;
    return {
      membershipId: membership._id,
      user: membership.user,
      enrolledAt: enrollment.enrolledAt,
      progress,
      ...metrics,
    };
  });
  res.json({
    success: true,
    data: {
      month: period.month,
      resources: resources.map(safeResource),
      students,
    },
  });
}

export async function updateStudentProgress(req, res) {
  const schoolClass = await requireEditableClass(req);
  const enrollment = await Enrollment.exists({
    organization: req.organization._id,
    class: schoolClass._id,
    student: req.body.studentMembershipId,
    status: "active",
  });
  if (!enrollment) throw new HttpError(404, "Active student enrollment not found");

  const { studentMembershipId, month, ...progressData } = req.body;
  const filter = {
    organization: req.organization._id,
    class: schoolClass._id,
    student: studentMembershipId,
    month,
  };
  const progress = await StudentProgress.findOneAndUpdate(
    filter,
    { $set: { ...progressData, updatedBy: req.membership._id }, $setOnInsert: filter },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  res.json({ success: true, data: progress });
}

export async function updateStudentAttendance(req, res) {
  const schoolClass = await requireEditableClass(req);
  if (req.body.sessionDate > new Date().toISOString().slice(0, 10)) {
    throw new HttpError(400, "Attendance cannot be recorded for a future date");
  }
  const studentIds = req.body.records.map((record) => record.studentMembershipId);
  const enrollments = await Enrollment.find({
    organization: req.organization._id,
    class: schoolClass._id,
    student: { $in: studentIds },
    status: "active",
  }).distinct("student");
  if (enrollments.length !== studentIds.length) {
    throw new HttpError(400, "Attendance can only be recorded for active students in this class");
  }

  await StudentAttendance.bulkWrite(req.body.records.map(({ studentMembershipId, status }) => ({
    updateOne: {
      filter: {
        organization: req.organization._id,
        class: schoolClass._id,
        student: studentMembershipId,
        sessionDate: req.body.sessionDate,
      },
      update: {
        $set: { status, markedBy: req.membership._id },
        $setOnInsert: {
          organization: req.organization._id,
          class: schoolClass._id,
          student: studentMembershipId,
          sessionDate: req.body.sessionDate,
        },
      },
      upsert: true,
    },
  })));
  await Promise.all(req.body.records.map(({ studentMembershipId, status }) => notifyMemberships({
    organization: req.organization._id,
    recipients: [studentMembershipId],
    type: "attendance_marked",
    title: `Attendance updated · ${schoolClass.name}`,
    message: `Your attendance for ${req.body.sessionDate} was marked ${status}.`,
    schoolClass,
  })));
  res.json({ success: true, data: { sessionDate: req.body.sessionDate, updated: studentIds.length } });
}

export async function downloadProgressReport(req, res) {
  const schoolClass = await getVisibleClass(req);
  const studentId = req.params.studentId;
  if (!/^[a-f\d]{24}$/i.test(studentId)) throw new HttpError(400, "Invalid student membership ID");
  if (req.membership.role === "student" && req.membership._id.toString() !== studentId) {
    throw new HttpError(403, "You do not have permission");
  }
  const [enrollment, membership] = await Promise.all([
    Enrollment.exists({
      organization: req.organization._id,
      class: schoolClass._id,
      student: studentId,
      status: "active",
    }),
    Membership.findOne({
      _id: studentId,
      organization: req.organization._id,
      role: "student",
    }).populate("user", "firstName lastName"),
  ]);
  if (!enrollment || !membership) throw new HttpError(404, "Active student enrollment not found");

  const period = getMonthPeriod(req.validatedQuery.month);
  const [progress, metrics] = await Promise.all([
    StudentProgress.findOne({
      organization: req.organization._id,
      class: schoolClass._id,
      student: studentId,
      month: period.month,
    }).select("-teacherNotes").lean(),
    getMonthlyStudentMetrics(req.organization._id, schoolClass._id, studentId, period),
  ]);
  const studentName = [membership.user.firstName, membership.user.lastName].filter(Boolean).join(" ");
  const pdf = await createProgressReportPdf({
    studentName,
    className: schoolClass.name,
    courseName: schoolClass.course?.name,
    monthLabel: period.monthLabel,
    generatedAt: new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date()),
    ...metrics,
    progress: {
      rating: progress?.rating ?? null,
      grade: progress?.grade ?? null,
      currentTopic: progress?.currentTopic || "",
      nextTopic: progress?.nextTopic || "",
      feedback: progress?.feedback || "",
    },
  });
  const filename = `progress-report-${period.month}-${studentId}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(pdf);
}
