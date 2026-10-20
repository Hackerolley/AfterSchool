import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    avatarUrl: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },
    platformRole: {
      type: String,
      enum: ["platform_admin"],
      default: null,
    },
  },
  { timestamps: true, strict: "throw" },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export const User = mongoose.model("User", userSchema);
