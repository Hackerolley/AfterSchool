import mongoose from "mongoose";
import { DEFAULT_MEMBER_ID_FORMATS } from "../users/user-id.js";

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
    idFormats: {
      student: { type: String, default: DEFAULT_MEMBER_ID_FORMATS.student },
      teacher: { type: String, default: DEFAULT_MEMBER_ID_FORMATS.teacher },
    },
    idCounters: {
      student: { type: Number, default: 0 },
      teacher: { type: Number, default: 0 },
    },
  },
  { timestamps: true, strict: "throw" },
);

organizationSchema.index({ slug: 1 }, { unique: true });

export const Organization = mongoose.model("Organization", organizationSchema);
