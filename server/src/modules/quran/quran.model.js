import mongoose from "mongoose";

const quranProgressSchema = new mongoose.Schema(
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
    dailyGoal: { type: Number, min: 1, max: 100, default: 5 },
    bookmarks: { type: [String], default: [] },
    memorizedVerses: { type: [String], default: [] },
    readVerses: { type: [String], default: [] },
    readingLog: {
      type: [{
        date: { type: String, required: true },
        verseKeys: { type: [String], default: [] },
      }],
      default: [],
    },
    completedTasks: {
      type: [{
        date: { type: String, required: true },
        task: { type: String, enum: ["listen", "review", "quiz"], required: true },
      }],
      default: [],
    },
  },
  { timestamps: true, strict: "throw" },
);

quranProgressSchema.index({ organization: 1, user: 1 }, { unique: true });

export const QuranProgress = mongoose.model("QuranProgress", quranProgressSchema);
