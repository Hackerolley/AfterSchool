import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    status: {
      type: String,
      enum: ["active", "completed", "withdrawn"],
      default: "active",
    },
    enrolledAt: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: "throw" },
);

enrollmentSchema.index({ student: 1, class: 1 }, { unique: true });
enrollmentSchema.index({ organization: 1, class: 1, status: 1 });
enrollmentSchema.index({ organization: 1, student: 1, status: 1 });

export const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
