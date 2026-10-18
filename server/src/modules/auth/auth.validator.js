import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
  organizationId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  organizationSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
}).strict().refine(
  (input) => Boolean(input.organizationId) !== Boolean(input.organizationSlug),
  { message: "Provide exactly one organizationId or organizationSlug" },
);

export const platformAdminLoginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();
