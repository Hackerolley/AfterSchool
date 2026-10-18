import { z } from "zod";

export const createClassSchema = z.object({
  courseId: z.string().regex(/^[a-f\d]{24}$/i),
  name: z.string().trim().min(1).max(120),
  teacherMembershipId: z.string().regex(/^[a-f\d]{24}$/i),
  capacity: z.number().int().min(1).max(1000).default(30),
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
