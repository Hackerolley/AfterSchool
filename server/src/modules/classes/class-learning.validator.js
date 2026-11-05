import { z } from "zod";
import { canonicalYouTubeUrl } from "../assignments/assignment.validator.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const urlSchema = z.string().trim().url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}, "URL must use HTTP or HTTPS");
const youtubeUrlSchema = z.string().trim().url().max(2048).transform((value, context) => {
  const canonical = canonicalYouTubeUrl(value);
  if (!canonical) {
    context.addIssue({ code: "custom", message: "Enter a valid YouTube video URL" });
    return z.NEVER;
  }
  return canonical;
});

const resourceDetails = {
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().default(""),
};

export const createClassResourceSchema = z.union([
  z.object({
    ...resourceDetails,
    type: z.literal("youtube"),
    youtubeUrl: youtubeUrlSchema,
  }).strict(),
  z.object({
    ...resourceDetails,
    type: z.literal("pdf"),
  }).strict(),
  z.object({
    ...resourceDetails,
    type: z.literal("video"),
  }).strict(),
  z.object({
    ...resourceDetails,
    type: z.literal("link"),
    linkUrl: urlSchema,
  }).strict(),
  z.object({
    ...resourceDetails,
    type: z.literal("note"),
    content: z.string().trim().min(1).max(5000),
  }).strict(),
]);

export const updateStudentProgressSchema = z.object({
  studentMembershipId: objectId,
  month: monthSchema,
  currentTopic: z.string().trim().max(240).optional().default(""),
  nextTopic: z.string().trim().max(240).optional().default(""),
  rating: z.coerce.number().int().min(1).max(5),
  grade: z.number().int().min(0).max(100).nullable().optional(),
  teacherNotes: z.string().trim().max(4000).optional().default(""),
  feedback: z.string().trim().max(4000).optional().default(""),
}).strict();

export const listClassLearningQuerySchema = z.object({
  month: monthSchema.optional(),
  organizationId: objectId.optional(),
}).strict();

const attendanceEntrySchema = z.object({
  studentMembershipId: objectId,
  status: z.enum(["present", "late", "absent", "excused"]),
}).strict();

export const updateStudentAttendanceSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid session date"),
  records: z.array(attendanceEntrySchema).min(1).max(100),
}).strict().superRefine(({ records }, context) => {
  const seen = new Set();
  records.forEach((record, index) => {
    if (seen.has(record.studentMembershipId)) {
      context.addIssue({
        code: "custom",
        path: ["records", index, "studentMembershipId"],
        message: "Each student can appear only once",
      });
    }
    seen.add(record.studentMembershipId);
  });
});
