import mongoose from "mongoose";

const studentAttendanceSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    sessionDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ["present", "late", "absent", "excused"], required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
  },
  { timestamps: true, strict: "throw" },
);

studentAttendanceSchema.index({ organization: 1, class: 1, student: 1, sessionDate: 1 }, { unique: true });
studentAttendanceSchema.index({ organization: 1, class: 1, sessionDate: 1 });

export const StudentAttendance = mongoose.model("StudentAttendance", studentAttendanceSchema);
