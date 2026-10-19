import { z } from "zod";

const timetableEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  googleMeetLink: z.string().url().max(2048).refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:"
        && url.hostname === "meet.google.com"
        && url.pathname.length > 1
        && !url.username
        && !url.password;
    } catch {
      return false;
    }
  }, "Google Meet links must use https://meet.google.com"),
}).strict().refine((entry) => entry.endTime > entry.startTime, {
  message: "Class end time must be after the start time",
  path: ["endTime"],
});

const sessionDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid session date");

const sessionTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const attendanceSessionSchema = z.object({
  sessionDate: sessionDateSchema,
  startTime: sessionTimeSchema,
  endTime: sessionTimeSchema,
  note: z.string().trim().max(500).optional(),
}).strict();

export const recordAttendanceSchema = z.discriminatedUnion("action", [
  attendanceSessionSchema.extend({
    action: z.enum(["completed", "missed"]),
  }),
  attendanceSessionSchema.extend({
    action: z.literal("rescheduled"),
    rescheduledDate: sessionDateSchema,
    rescheduledStartTime: sessionTimeSchema,
    rescheduledEndTime: sessionTimeSchema,
  }).refine((entry) => entry.rescheduledEndTime > entry.rescheduledStartTime, {
    message: "Rescheduled end time must be after the start time",
    path: ["rescheduledEndTime"],
  }),
]).refine((entry) => entry.endTime > entry.startTime, {
  message: "Class end time must be after the start time",
  path: ["endTime"],
});

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  classId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).strict();

export const createClassSchema = z.object({
  courseId: z.string().regex(/^[a-f\d]{24}$/i),
  name: z.string().trim().min(1).max(120),
  teacherMembershipId: z.string().regex(/^[a-f\d]{24}$/i),
  capacity: z.number().int().min(1).max(1000).default(30),
  timetable: z.array(timetableEntrySchema).max(14).default([]),
}).strict();

export const updateClassTimetableSchema = z.object({
  timetable: z.array(timetableEntrySchema).max(14),
}).strict();

export const listClassesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["active", "archived"]).optional(),
}).strict();

export const enrollStudentSchema = z.object({
  studentMembershipId: z.string().regex(/^[a-f\d]{24}$/i),
}).strict();

export const listClassStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
