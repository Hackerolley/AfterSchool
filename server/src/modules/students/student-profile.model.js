import mongoose from "mongoose";

const studentProfileSchema = new mongoose.Schema(
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
    dateOfBirth: {
      type: Date,
      validate: {
        validator: (value) => value <= new Date(),
        message: "Date of birth cannot be in the future",
      },
    },
    gender: {
      type: String,
      enum: ["female", "male", "non_binary", "self_described", "prefer_not_to_say"],
    },
    genderDescription: { type: String, trim: true, maxlength: 80 },
    countryOfResidence: {
      type: String,
      uppercase: true,
      match: /^[A-Z]{2}$/,
    },
    homeCountry: {
      type: String,
      uppercase: true,
      match: /^[A-Z]{2}$/,
    },
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: 30,
      match: /^\+?[0-9][0-9().\s-]{5,28}$/,
    },
    guardianName: { type: String, trim: true, maxlength: 160 },
    guardianEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    guardianPhone: { type: String, trim: true, maxlength: 40 },
    studentNumber: { type: String, trim: true, maxlength: 40 },
  },
  { timestamps: true, strict: "throw" },
);

studentProfileSchema.index({ organization: 1, membership: 1 }, { unique: true });
studentProfileSchema.index(
  { organization: 1, studentNumber: 1 },
  { unique: true, sparse: true },
);

studentProfileSchema.pre("validate", function validateStudentProfile(next) {
  if (this.gender === "self_described" && !this.genderDescription) {
    this.invalidate("genderDescription", "Provide a description when gender is self-described");
  } else if (this.gender !== "self_described" && this.genderDescription) {
    this.invalidate("genderDescription", "Gender description is only valid when gender is self-described");
  }

  if (this.phoneNumber) {
    const digitCount = this.phoneNumber.replace(/\D/g, "").length;
    if (digitCount < 7 || digitCount > 15) {
      this.invalidate("phoneNumber", "Phone number must contain between 7 and 15 digits");
    }
  }

  next();
});

export const StudentProfile = mongoose.model("StudentProfile", studentProfileSchema);
