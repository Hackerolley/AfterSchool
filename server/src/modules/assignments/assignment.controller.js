import { Enrollment } from "../enrollments/enrollment.model.js";
import { SchoolClass } from "../classes/class.model.js";
import {
  Assignment,
  AssignmentSubmission,
} from "./assignment.model.js";
import {
  deleteDocument,
  privateDocumentUrl,
  uploadDocument,
} from "./cloudinary.service.js";
import { HttpError } from "../../utils/http-error.js";

function safeAttachment(attachment) {
  if (!attachment) return undefined;
  return {
    originalFilename: attachment.originalFilename,
    bytes: attachment.bytes,
  };
}

function safeAssignment(assignment) {
  return {
    ...assignment,
    attachment: safeAttachment(assignment.attachment),
  };
}

function safeSubmission(submission) {
  if (!submission) return null;
  return {
    ...submission,
    attachment: safeAttachment(submission.attachment),
  };
}

async function visibleAssignmentsFilter(req) {
  const filter = { organization: req.organization._id, status: "published" };
  if (req.membership.role === "teacher") filter.teacher = req.membership._id;
  if (req.membership.role === "student") {
    const classIds = await Enrollment.find({
      organization: req.organization._id,
      student: req.membership._id,
      status: "active",
    }).distinct("class");
    filter.class = { $in: classIds };
  }
  return filter;
}

export async function listAssignments(req, res) {
  const filter = await visibleAssignmentsFilter(req);
  const assignments = await Assignment.find(filter)
    .populate({ path: "class", select: "name course", populate: { path: "course", select: "name code" } })
    .sort({ dueAt: 1, createdAt: -1, _id: 1 })
    .limit(100)
    .lean();

  if (req.membership.role !== "student" || assignments.length === 0) {
    res.json({ success: true, data: assignments.map(safeAssignment) });
    return;
  }

  const submissions = await AssignmentSubmission.find({
    organization: req.organization._id,
    student: req.membership._id,
    assignment: { $in: assignments.map((assignment) => assignment._id) },
  }).lean();
  const byAssignment = new Map(submissions.map((submission) => [submission.assignment.toString(), submission]));
  res.json({
    success: true,
    data: assignments.map((assignment) => ({
      ...safeAssignment(assignment),
      submission: safeSubmission(byAssignment.get(assignment._id.toString())),
    })),
  });
}

export async function createAssignment(req, res) {
  const schoolClass = await SchoolClass.findOne({
    _id: req.body.classId,
    organization: req.organization._id,
    status: "active",
    teacher: req.membership._id,
  });
  if (!schoolClass) throw new HttpError(404, "An active class assigned to you is required");
  if (req.body.contentType === "document" && !req.file) {
    throw new HttpError(400, "Choose a document to upload");
  }
  if (req.body.contentType !== "document" && req.file) {
    throw new HttpError(400, "File uploads are only accepted for document assignments");
  }

  let attachment;
  try {
    if (req.file) attachment = await uploadDocument(req.file, req.organization._id, req.app.locals.config);
    const { classId, ...assignmentData } = req.body;
    const assignment = await Assignment.create({
      organization: req.organization._id,
      class: schoolClass._id,
      teacher: req.membership._id,
      ...assignmentData,
      ...(attachment ? { attachment } : {}),
    });
    res.status(201).json({ success: true, data: safeAssignment(assignment.toObject()) });
  } catch (error) {
    if (attachment) await deleteDocument(attachment, req.app.locals.config);
    throw error;
  }
}

async function getVisibleAssignment(req) {
  const assignment = await Assignment.findOne({
    _id: req.params.assignmentId,
    organization: req.organization._id,
    status: "published",
  }).populate({ path: "class", select: "name course", populate: { path: "course", select: "name code" } });
  if (!assignment) throw new HttpError(404, "Assignment not found");

  if (req.membership.role === "teacher" && assignment.teacher.toString() !== req.membership._id.toString()) {
    throw new HttpError(403, "You do not have permission");
  }
  if (req.membership.role === "student") {
    const enrolled = await Enrollment.exists({
      organization: req.organization._id,
      class: assignment.class._id,
      student: req.membership._id,
      status: "active",
    });
    if (!enrolled) throw new HttpError(403, "You do not have permission");
  }
  return assignment;
}

export async function getAssignment(req, res) {
  const assignment = await getVisibleAssignment(req);
  let submission;
  if (req.membership.role === "student") {
    submission = await AssignmentSubmission.findOne({
      organization: req.organization._id,
      assignment: assignment._id,
      student: req.membership._id,
    }).lean();
  }
  res.json({
    success: true,
    data: {
      ...safeAssignment(assignment.toObject()),
      ...(req.membership.role === "student" ? { submission: safeSubmission(submission) } : {}),
    },
  });
}

export async function submitAssignment(req, res) {
  const assignment = await getVisibleAssignment(req);
  if (req.membership.role !== "student") throw new HttpError(403, "Only students can submit assignments");
  if (req.body.submissionType === "file" && !req.file) {
    throw new HttpError(400, "Choose a document to submit");
  }
  if (req.body.submissionType !== "file" && req.file) {
    throw new HttpError(400, "File uploads are only accepted for file submissions");
  }

  let attachment;
  if (req.file) attachment = await uploadDocument(req.file, req.organization._id, req.app.locals.config);
  const filter = {
    organization: req.organization._id,
    assignment: assignment._id,
    student: req.membership._id,
  };
  const previous = await AssignmentSubmission.findOne(filter).lean();
  const update = {
    submissionType: req.body.submissionType,
    ...(req.body.submissionType === "text" ? { contentText: req.body.contentText } : {}),
    ...(req.body.submissionType === "link" ? { linkUrl: req.body.linkUrl } : {}),
    ...(attachment ? { attachment } : {}),
    submittedAt: new Date(),
    isLate: Boolean(assignment.dueAt && Date.now() > assignment.dueAt.getTime()),
  };

  try {
    const unset = {
      ...(!attachment ? { attachment: 1 } : {}),
      ...(req.body.submissionType !== "link" ? { linkUrl: 1 } : {}),
      ...(req.body.submissionType !== "text" ? { contentText: 1 } : {}),
    };
    const submission = await AssignmentSubmission.findOneAndUpdate(
      filter,
      {
        $set: update,
        $setOnInsert: filter,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    if (previous?.attachment && (attachment || req.body.submissionType !== "file")) {
      await deleteDocument(previous.attachment, req.app.locals.config);
    }
    res.status(previous ? 200 : 201).json({ success: true, data: safeSubmission(submission) });
  } catch (error) {
    if (attachment) await deleteDocument(attachment, req.app.locals.config);
    throw error;
  }
}

export async function listAssignmentSubmissions(req, res) {
  const assignment = await getVisibleAssignment(req);
  if (req.membership.role !== "teacher") throw new HttpError(403, "Teacher permission required");
  const submissions = await AssignmentSubmission.find({
    organization: req.organization._id,
    assignment: assignment._id,
  })
    .populate({
      path: "student",
      select: "user",
      populate: { path: "user", select: "firstName lastName email" },
    })
    .sort({ submittedAt: -1, _id: 1 })
    .lean();
  res.json({ success: true, data: submissions.map(safeSubmission) });
}

export async function getAssignmentFile(req, res) {
  const assignment = await getVisibleAssignment(req);
  const submissionId = req.params.submissionId;
  if (!submissionId) {
    if (!assignment.attachment) throw new HttpError(404, "Assignment document not found");
    res.redirect(privateDocumentUrl(assignment.attachment, req.app.locals.config));
    return;
  }

  const submission = await AssignmentSubmission.findOne({
    _id: submissionId,
    organization: req.organization._id,
    assignment: assignment._id,
    ...(req.membership.role === "student" ? { student: req.membership._id } : {}),
  }).lean();
  if (!submission?.attachment) throw new HttpError(404, "Submission document not found");
  res.redirect(privateDocumentUrl(submission.attachment, req.app.locals.config));
}
