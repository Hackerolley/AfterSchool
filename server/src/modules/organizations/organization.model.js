import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      maxlength: 80,
    },
    status: { type: String, enum: ["active", "suspended", "inactive"], default: "active" },
    logoUrl: { type: String, default: "" },
    logoPublicId: { type: String, default: "" },
  },
  { timestamps: true, strict: "throw" },
);

organizationSchema.index({ slug: 1 }, { unique: true });

export const Organization = mongoose.model("Organization", organizationSchema);
