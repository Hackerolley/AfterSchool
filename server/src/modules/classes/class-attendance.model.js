import mongoose from "mongoose";

const classAttendanceSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolClass",
      required: true,
      index: true,
    },
    sessionDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    status: {
      type: String,
      enum: ["completed", "missed", "rescheduled"],
      required: true,
    },
    rescheduledDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    rescheduledStartTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    rescheduledEndTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    note: { type: String, trim: true, maxlength: 500 },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Membership",
      required: true,
    },
    markedAt: { type: Date, required: true },
  },
  { timestamps: true, strict: "throw" },
);

classAttendanceSchema.index(
  { organization: 1, class: 1, sessionDate: 1, startTime: 1 },
  { unique: true },
);
classAttendanceSchema.index({ organization: 1, sessionDate: -1 });

export const ClassAttendance = mongoose.model("ClassAttendance", classAttendanceSchema);
