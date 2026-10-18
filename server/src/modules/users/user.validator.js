import { z } from "zod";

const passwordSchema = z.string().min(12).max(128);
const optionalString = (max) => z.string().trim().max(max).optional();
const studentPhoneSchema = z.string()
  .trim()
  .max(30)
  .regex(/^\+?[0-9][0-9().\s-]{5,28}$/)
  .refine((value) => {
    const digitCount = value.replace(/\D/g, "").length;
    return digitCount >= 7 && digitCount <= 15;
  }, "Phone number must contain between 7 and 15 digits")
  .optional();
const studentDateOfBirthSchema = z.iso.date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((value) => value <= new Date(), "Date of birth cannot be in the future")
  .optional();
const countryCodeSchema = z.string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Use a two-letter ISO 3166-1 alpha-2 country code")
  .transform((value) => value.toUpperCase())
  .optional();

const studentOnlyFields = [
  "studentNumber",
  "guardianName",
  "guardianEmail",
  "guardianPhone",
  "dateOfBirth",
  "gender",
  "genderDescription",
  "countryOfResidence",
  "homeCountry",
  "phoneNumber",
];

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  password: passwordSchema.optional(),
  role: z.enum(["teacher", "student"]),
  employeeId: optionalString(40),
  qualifications: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  specialization: optionalString(120),
  studentNumber: optionalString(40),
  dateOfBirth: studentDateOfBirthSchema,
  gender: z.enum(["female", "male", "non_binary", "self_described", "prefer_not_to_say"]).optional(),
  genderDescription: optionalString(80),
  countryOfResidence: countryCodeSchema,
  homeCountry: countryCodeSchema,
  phoneNumber: studentPhoneSchema,
  guardianName: optionalString(160),
  guardianEmail: z.string().email().max(254).optional(),
  guardianPhone: optionalString(40),
}).strict().superRefine((user, context) => {
  if (user.role === "teacher") {
    const suppliedStudentField = studentOnlyFields.find((field) => user[field] !== undefined);
    if (suppliedStudentField) {
      context.addIssue({
        code: "custom",
        path: [suppliedStudentField],
        message: "Student fields are not valid for teachers",
      });
    }
  }
  if (user.role === "student" && (user.employeeId || user.qualifications || user.specialization)) {
    context.addIssue({ code: "custom", path: ["role"], message: "Teacher fields are not valid for students" });
  }
  if (user.gender === "self_described" && !user.genderDescription) {
    context.addIssue({
      code: "custom",
      path: ["genderDescription"],
      message: "Provide a description when gender is self-described",
    });
  } else if (user.gender !== "self_described" && user.genderDescription) {
    context.addIssue({
      code: "custom",
      path: ["genderDescription"],
      message: "Gender description is only valid when gender is self-described",
    });
  }
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]),
}).strict();

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  role: z.enum(["admin", "teacher", "student"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).strict();
