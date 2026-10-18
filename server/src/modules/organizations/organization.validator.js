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
