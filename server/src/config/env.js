import dotenv from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

dotenv.config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "..", ".env")],
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  CLIENT_ORIGINS: z.string().default("http://localhost:5173"),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  SESSION_MAX_AGE_MS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60 * 1000),
  TRUST_PROXY: z.union([z.literal("true"), z.string().regex(/^\d+$/)]).default("0"),
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  QURAN_CLIENT_ID: z.string().default(""),
  QURAN_CLIENT_SECRET: z.string().default(""),
  QURAN_API_ENV: z.enum(["production", "prelive"]).default("production"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

const { CLIENT_ORIGINS, TRUST_PROXY, ...values } = parsed.data;
export const config = Object.freeze({
  ...values,
  clientOrigins: CLIENT_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  trustProxy: TRUST_PROXY === "true" ? 1 : Number(TRUST_PROXY),
});
