import mongoose from "mongoose";

const teacherProfileSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    membership: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Membership",
      required: true,
    },
    employeeId: { type: String, trim: true, maxlength: 40 },
    qualifications: [{ type: String, trim: true, maxlength: 120 }],
    specialization: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true, strict: "throw" },
);

teacherProfileSchema.index({ organization: 1, membership: 1 }, { unique: true });
teacherProfileSchema.index(
  { organization: 1, employeeId: 1 },
  { unique: true, sparse: true },
);

export const TeacherProfile = mongoose.model("TeacherProfile", teacherProfileSchema);
