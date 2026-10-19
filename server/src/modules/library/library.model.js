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

const libraryItemSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    contentType: { type: String, enum: ["ebook", "youtube"], required: true },
    attachment: { type: attachmentSchema, default: undefined },
    youtubeUrl: { type: String, maxlength: 2048 },
    status: { type: String, enum: ["published", "archived"], default: "published" },
  },
  { timestamps: true, strict: "throw" },
);

libraryItemSchema.index({ organization: 1, status: 1, createdAt: -1 });

export const LibraryItem = mongoose.model("LibraryItem", libraryItemSchema);
