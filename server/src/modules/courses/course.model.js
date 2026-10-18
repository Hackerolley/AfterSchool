import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    description: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true, strict: "throw" },
);

courseSchema.index({ organization: 1, code: 1 }, { unique: true });

export const Course = mongoose.model("Course", courseSchema);
