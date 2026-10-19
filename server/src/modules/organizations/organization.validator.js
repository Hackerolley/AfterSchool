import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  admin: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(12).max(128),
  }).strict(),
}).strict();

export const listOrganizationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["active", "suspended", "inactive"]).optional(),
}).strict();

export const listOrganizationMembershipsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  role: z.enum(["admin", "teacher", "student"]).optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
}).strict();

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  status: z.enum(["active", "suspended", "inactive"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "Provide at least one organization field to update",
});

export const updatePlatformMembershipStatusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]),
}).strict();
