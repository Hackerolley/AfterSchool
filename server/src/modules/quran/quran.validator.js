import { z } from "zod";

const verseKeySchema = z.string()
  .regex(/^(?:[1-9]|[1-9]\d|1[01]\d|12[0-3]):[1-9]\d{0,2}$/)
  .refine((value) => {
    const [chapter, verse] = value.split(":").map(Number);
    return chapter <= 114 && verse <= 286;
  });

export const listVersesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(20).default(1),
  recitation: z.coerce.number().int().positive().default(7),
  translation: z.coerce.number().int().positive().default(131),
});

export const updateProgressSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("goal"), dailyGoal: z.coerce.number().int().min(1).max(100) }),
  z.object({ action: z.literal("read"), verseKey: verseKeySchema }),
  z.object({ action: z.literal("bookmark"), verseKey: verseKeySchema }),
  z.object({ action: z.literal("unbookmark"), verseKey: verseKeySchema }),
  z.object({ action: z.literal("memorize"), verseKey: verseKeySchema }),
  z.object({ action: z.literal("unmemorize"), verseKey: verseKeySchema }),
  z.object({
    action: z.literal("task"),
    task: z.enum(["listen", "review", "quiz"]),
    completed: z.boolean(),
  }),
]);
