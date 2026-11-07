import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    type: {
      type: String,
      enum: [
        "assignment_submission",
        "assignment_review",
        "timetable_request",
        "timetable_approved",
        "timetable_rejected",
        "timetable_updated",
        "attendance_marked",
        "class_attendance",
        "enrollment_added",
        "enrollment_withdrawn",
      ],
      required: true,
    },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment" },
    submission: { type: mongoose.Schema.Types.ObjectId, ref: "AssignmentSubmission" },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass" },
    title: { type: String, trim: true, maxlength: 240 },
    message: { type: String, required: true, maxlength: 240 },
    readAt: { type: Date },
  },
  { timestamps: true, strict: "throw" },
);

notificationSchema.index({ organization: 1, recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { readAt: 1 },
  { expireAfterSeconds: 3 * 24 * 60 * 60, partialFilterExpression: { readAt: { $exists: true } } },
);

export const Notification = mongoose.model("Notification", notificationSchema);
