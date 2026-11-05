import mongoose from "mongoose";

const studentProgressSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    currentTopic: { type: String, trim: true, maxlength: 240, default: "" },
    nextTopic: { type: String, trim: true, maxlength: 240, default: "" },
    rating: { type: Number, min: 1, max: 5, required: true },
    grade: { type: Number, min: 0, max: 100 },
    teacherNotes: { type: String, trim: true, maxlength: 4000, default: "" },
    feedback: { type: String, trim: true, maxlength: 4000, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
  },
  { timestamps: true, strict: "throw" },
);

studentProgressSchema.index({ organization: 1, class: 1, student: 1, month: 1 }, { unique: true });

export const StudentProgress = mongoose.model("StudentProgress", studentProgressSchema);
