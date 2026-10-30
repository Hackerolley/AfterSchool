import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const httpUrl = z.string().trim().url().max(2048).refine(
  (value) => ["http:", "https:"].includes(new URL(value).protocol),
  "URL must use HTTP or HTTPS",
);

export function canonicalYouTubeUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  let videoId = null;
  if (host === "youtu.be") {
    videoId = parsed.pathname.split("/").filter(Boolean)[0];
  } else if (["youtube.com", "youtube-nocookie.com"].includes(host)) {
    if (parsed.pathname === "/watch") videoId = parsed.searchParams.get("v");
    else if (/^\/(embed|shorts|live)\//.test(parsed.pathname)) {
      videoId = parsed.pathname.split("/")[2];
    }
  }
  return /^[\w-]{11}$/.test(videoId || "")
    ? `https://www.youtube.com/watch?v=${videoId}`
    : null;
}

const youtubeUrl = z.string().trim().url().max(2048).transform((value, context) => {
  const canonical = canonicalYouTubeUrl(value);
  if (!canonical) {
    context.addIssue({ code: "custom", message: "Enter a valid YouTube video URL" });
    return z.NEVER;
  }
  return canonical;
});

export const createAssignmentSchema = z.object({
  classId: objectId,
  title: z.string().trim().min(1).max(160),
  instructions: z.string().trim().max(4000).optional().default(""),
  contentType: z.enum(["text", "document", "link", "youtube"]),
  contentText: z.string().trim().max(12000).optional().default(""),
  linkUrl: httpUrl.optional(),
  youtubeUrl: youtubeUrl.optional(),
  dueAt: z.coerce.date().optional(),
}).strict().superRefine((value, context) => {
  if (value.contentType !== "link" && value.linkUrl) {
    context.addIssue({ code: "custom", path: ["linkUrl"], message: "A link is only valid for link assignments" });
  }
  if (value.contentType !== "youtube" && value.youtubeUrl) {
    context.addIssue({ code: "custom", path: ["youtubeUrl"], message: "A video URL is only valid for YouTube assignments" });
  }
  if (value.contentType !== "text" && value.contentText) {
    context.addIssue({ code: "custom", path: ["contentText"], message: "Text is only valid for text assignments" });
  }
  if (value.contentType === "text" && !value.contentText) {
    context.addIssue({ code: "custom", path: ["contentText"], message: "Text assignment content is required" });
  }
  if (value.contentType === "link" && !value.linkUrl) {
    context.addIssue({ code: "custom", path: ["linkUrl"], message: "A link is required" });
  }
  if (value.contentType === "youtube" && !value.youtubeUrl) {
    context.addIssue({ code: "custom", path: ["youtubeUrl"], message: "A YouTube video link is required" });
  }
});

export const submitAssignmentSchema = z.object({
  submissionType: z.enum(["text", "file", "link"]),
  contentText: z.string().trim().max(12000).optional().default(""),
  linkUrl: httpUrl.optional(),
}).strict().superRefine((value, context) => {
  if (value.submissionType !== "link" && value.linkUrl) {
    context.addIssue({ code: "custom", path: ["linkUrl"], message: "A link is only valid for link submissions" });
  }
  if (value.submissionType !== "text" && value.contentText) {
    context.addIssue({ code: "custom", path: ["contentText"], message: "Text is only valid for text submissions" });
  }
  if (value.submissionType === "text" && !value.contentText) {
    context.addIssue({ code: "custom", path: ["contentText"], message: "Your response is required" });
  }
  if (value.submissionType === "link" && !value.linkUrl) {
    context.addIssue({ code: "custom", path: ["linkUrl"], message: "A submission link is required" });
  }
});

export const reviewAssignmentSubmissionSchema = z.object({
  score: z.number().int().min(0).max(100),
  feedback: z.string().trim().max(4000).optional().default(""),
}).strict();
