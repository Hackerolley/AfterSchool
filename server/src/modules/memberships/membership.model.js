import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: { type: String, enum: ["admin", "teacher", "student"], required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true, strict: "throw" },
);

membershipSchema.index({ organization: 1, user: 1 }, { unique: true });
membershipSchema.index({ organization: 1, role: 1, status: 1 });

export const Membership = mongoose.model("Membership", membershipSchema);
