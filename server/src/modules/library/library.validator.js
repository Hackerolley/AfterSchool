import { z } from "zod";
import { canonicalYouTubeUrl } from "../assignments/assignment.validator.js";

const youtubeUrl = z.string().trim().url().max(2048).transform((value, context) => {
  const canonical = canonicalYouTubeUrl(value);
  if (!canonical) {
    context.addIssue({ code: "custom", message: "Enter a valid YouTube video URL" });
    return z.NEVER;
  }
  return canonical;
});

export const createLibraryItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().default(""),
  contentType: z.enum(["ebook", "youtube"]),
  youtubeUrl: youtubeUrl.optional(),
}).strict().superRefine((value, context) => {
  if (value.contentType === "youtube" && !value.youtubeUrl) {
    context.addIssue({ code: "custom", path: ["youtubeUrl"], message: "A YouTube video link is required" });
  }
  if (value.contentType === "ebook" && value.youtubeUrl) {
    context.addIssue({ code: "custom", path: ["youtubeUrl"], message: "YouTube links are only valid for video items" });
  }
});

export const updateLibraryItemSchema = createLibraryItemSchema;
