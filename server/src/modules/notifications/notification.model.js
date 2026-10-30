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
    type: { type: String, enum: ["assignment_submission", "assignment_review"], required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    submission: { type: mongoose.Schema.Types.ObjectId, ref: "AssignmentSubmission", required: true },
    message: { type: String, required: true, maxlength: 240 },
    readAt: { type: Date },
  },
  { timestamps: true, strict: "throw" },
);

notificationSchema.index({ organization: 1, recipient: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
