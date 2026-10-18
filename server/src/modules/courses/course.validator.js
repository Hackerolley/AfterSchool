import { z } from "zod";

export const createCourseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()),
  description: z.string().trim().max(2000).optional(),
}).strict();

export const listCoursesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["active", "archived"]).optional(),
}).strict();
