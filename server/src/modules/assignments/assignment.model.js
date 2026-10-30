import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true },
    originalFilename: { type: String, required: true },
    format: { type: String, required: true },
    bytes: { type: Number, required: true },
  },
  { _id: false, strict: "throw" },
);

const assignmentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    instructions: { type: String, trim: true, maxlength: 4000, default: "" },
    contentType: {
      type: String,
      enum: ["text", "document", "link", "youtube"],
      required: true,
    },
    contentText: { type: String, trim: true, maxlength: 12000, default: "" },
    attachment: { type: fileSchema, default: undefined },
    linkUrl: { type: String, maxlength: 2048 },
    youtubeUrl: { type: String, maxlength: 2048 },
    dueAt: { type: Date },
    status: { type: String, enum: ["published", "archived"], default: "published" },
  },
  { timestamps: true, strict: "throw" },
);

assignmentSchema.index({ organization: 1, class: 1, status: 1, dueAt: 1 });
assignmentSchema.index({ organization: 1, teacher: 1, createdAt: -1 });

const submissionSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    submissionType: { type: String, enum: ["text", "file", "link"], required: true },
    contentText: { type: String, trim: true, maxlength: 12000, default: "" },
    attachment: { type: fileSchema, default: undefined },
    linkUrl: { type: String, maxlength: 2048 },
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
    score: { type: Number, min: 0, max: 100 },
    feedback: { type: String, trim: true, maxlength: 4000, default: "" },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Membership" },
  },
  { timestamps: true, strict: "throw" },
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ organization: 1, assignment: 1, submittedAt: -1 });

export const Assignment = mongoose.model("Assignment", assignmentSchema);
export const AssignmentSubmission = mongoose.model("AssignmentSubmission", submissionSchema);
