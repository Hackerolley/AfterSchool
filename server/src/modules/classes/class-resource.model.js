import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true },
    originalFilename: { type: String, required: true },
    format: { type: String, required: true },
    bytes: { type: Number, required: true },
  },
  { _id: false, strict: "throw" },
);

const classResourceSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    type: { type: String, enum: ["youtube", "pdf", "video", "link", "note"], required: true },
    youtubeUrl: { type: String, maxlength: 2048 },
    linkUrl: { type: String, maxlength: 2048 },
    content: { type: String, trim: true, maxlength: 5000 },
    attachment: { type: attachmentSchema, default: undefined },
  },
  { timestamps: true, strict: "throw" },
);

classResourceSchema.index({ organization: 1, class: 1, createdAt: -1 });

export const ClassResource = mongoose.model("ClassResource", classResourceSchema);
