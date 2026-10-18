import mongoose from "mongoose";

const classSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    capacity: { type: Number, min: 1, max: 1000, default: 30 },
    enrolledCount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true, strict: "throw" },
);

classSchema.index({ organization: 1, name: 1 });
classSchema.index({ organization: 1, teacher: 1, status: 1 });

export const SchoolClass = mongoose.model("SchoolClass", classSchema);
