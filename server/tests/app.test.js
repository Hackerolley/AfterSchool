import assert from "node:assert/strict";
import test from "node:test";
import session from "express-session";
import request from "supertest";
import { createApp } from "../src/app.js";
import { requirePlatformAdmin } from "../src/middleware/authenticate.js";
import { loginSchema, platformAdminLoginSchema } from "../src/modules/auth/auth.validator.js";
import { createOrganizationSchema } from "../src/modules/organizations/organization.validator.js";
import { createUserSchema } from "../src/modules/users/user.validator.js";
import {
  canonicalYouTubeUrl,
  createAssignmentSchema,
  submitAssignmentSchema,
} from "../src/modules/assignments/assignment.validator.js";
import { privateDocumentUrl } from "../src/modules/assignments/cloudinary.service.js";

function makeApp() {
  return createApp({
    config: {
      NODE_ENV: "test",
      SESSION_SECRET: "test-session-secret-at-least-32-characters",
      SESSION_MAX_AGE_MS: 60_000,
      COOKIE_SAME_SITE: "lax",
      clientOrigins: ["http://localhost:5173"],
      trustProxy: 0,
    },
    sessionStore: new session.MemoryStore(),
    getDatabaseState: () => "connected",
  });
}

test("health check reports MongoDB connectivity", async () => {
  const response = await request(makeApp()).get("/api/v1/health").expect(200);
  assert.match(response.headers["content-security-policy"], /frame-src 'self' https:\/\/www\.youtube-nocookie\.com/);
  assert.deepEqual(response.body, {
    success: true,
    data: { status: "ok", database: "connected" },
  });
});

test("private assignment document URLs use authenticated, expiring Cloudinary downloads", () => {
  const attachment = {
    publicId: "afterschool/example/reading",
    originalFilename: "reading.pdf",
    format: "pdf",
  };
  assert.throws(
    () => privateDocumentUrl(attachment, {}),
    (error) => error.status === 503,
  );
  const before = Math.floor(Date.now() / 1000);
  const url = new URL(privateDocumentUrl(attachment, {
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-api-key",
    CLOUDINARY_API_SECRET: "test-api-secret",
  }));
  assert.equal(url.hostname, "api.cloudinary.com");
  assert.match(url.pathname, /\/download$/);
  assert.equal(url.searchParams.get("type"), "authenticated");
  const expiresAt = Number(url.searchParams.get("expires_at"));
  assert.ok(expiresAt >= before + 300 && expiresAt <= before + 301);
  assert.equal(url.searchParams.get("attachment"), "reading.pdf");
});

test("health check is unavailable when MongoDB is disconnected", async () => {
  const app = createApp({
    config: {
      NODE_ENV: "test",
      SESSION_SECRET: "test-session-secret-at-least-32-characters",
      SESSION_MAX_AGE_MS: 60_000,
      COOKIE_SAME_SITE: "lax",
      clientOrigins: [],
      trustProxy: 0,
    },
    sessionStore: new session.MemoryStore(),
    getDatabaseState: () => "disconnected",
  });
  const response = await request(app).get("/api/v1/health").expect(503);
  assert.equal(response.body.data.database, "disconnected");
});

test("assignment routes require a signed-in school member", async () => {
  await request(makeApp()).get("/api/v1/assignments").expect(401);
});

test("assignment validation accepts each supported content format and rejects unsafe video hosts", () => {
  const base = {
    classId: "507f1f77bcf86cd799439011",
    title: "Read and respond",
  };
  assert.equal(createAssignmentSchema.safeParse({
    ...base,
    contentType: "text",
    contentText: "Write a short response.",
  }).success, true);
  assert.equal(createAssignmentSchema.safeParse({
    ...base,
    contentType: "document",
  }).success, true);
  assert.equal(createAssignmentSchema.safeParse({
    ...base,
    contentType: "link",
    linkUrl: "https://example.com/reading",
  }).success, true);
  const youtube = createAssignmentSchema.safeParse({
    ...base,
    contentType: "youtube",
    youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
  });
  assert.equal(youtube.success, true);
  assert.equal(youtube.data.youtubeUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(canonicalYouTubeUrl("https://notyoutube.example/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(canonicalYouTubeUrl("http://youtube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(createAssignmentSchema.safeParse({
    ...base,
    contentType: "text",
    contentText: "",
  }).success, false);
});

test("assignment submissions validate text, file, and link response requirements", () => {
  assert.equal(submitAssignmentSchema.safeParse({
    submissionType: "text",
    contentText: "My response",
  }).success, true);
  assert.equal(submitAssignmentSchema.safeParse({ submissionType: "file" }).success, true);
  assert.equal(submitAssignmentSchema.safeParse({
    submissionType: "link",
    linkUrl: "https://example.com/my-work",
  }).success, true);
  assert.equal(submitAssignmentSchema.safeParse({
    submissionType: "link",
  }).success, false);
  assert.equal(submitAssignmentSchema.safeParse({
    submissionType: "text",
    contentText: "My response",
    linkUrl: "https://example.com",
  }).success, false);
});

test("unsafe requests require a session CSRF token", async () => {
  const response = await request(makeApp())
    .post("/api/v1/auth/login")
    .send({ email: "invalid", password: "x", organizationId: "invalid" })
    .expect(403);
  assert.equal(response.body.message, "Valid CSRF token required");
});

test("CSRF token is session-bound and request validation runs afterward", async () => {
  const agent = request.agent(makeApp());
  const tokenResponse = await agent.get("/api/v1/auth/csrf").expect(200);
  const token = tokenResponse.body.data.csrfToken;
  assert.match(token, /^[a-f\d]{64}$/);

  const response = await agent
    .post("/api/v1/auth/login")
    .set("X-CSRF-Token", token)
    .send({ email: "invalid", password: "x", organizationId: "invalid" })
    .expect(400);
  assert.equal(response.body.message, "Request validation failed");
});

test("CSRF validation rejects non-ASCII tokens without throwing", async () => {
  const agent = request.agent(makeApp());
  const tokenResponse = await agent.get("/api/v1/auth/csrf").expect(200);
  const token = tokenResponse.body.data.csrfToken;
  await agent
    .post("/api/v1/auth/login")
    .set("X-CSRF-Token", "é".repeat(token.length))
    .send({ email: "invalid", password: "x", organizationId: "invalid" })
    .expect(403);
});

test("user creation cannot assign the administrator role", () => {
  const result = createUserSchema.safeParse({
    firstName: "Ada",
    lastName: "Example",
    email: "ada@example.com",
    password: "a-long-unique-password",
    role: "admin",
  });
  assert.equal(result.success, false);
});

test("student profile fields are accepted and country codes are normalized", () => {
  const result = createUserSchema.safeParse({
    firstName: "Ada",
    lastName: "Example",
    email: "ada@example.com",
    password: "a-long-unique-password",
    role: "student",
    dateOfBirth: "2012-04-15",
    gender: "female",
    countryOfResidence: "gb",
    homeCountry: "NG",
    phoneNumber: "+44 20 7946 0958",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.countryOfResidence, "GB");
  assert.equal(result.data.homeCountry, "NG");
  assert.equal(result.data.dateOfBirth.toISOString(), "2012-04-15T00:00:00.000Z");
});

test("student profile validation rejects future birthdays and malformed country and phone values", () => {
  const base = {
    firstName: "Ada",
    lastName: "Example",
    email: "ada@example.com",
    password: "a-long-unique-password",
    role: "student",
  };
  assert.equal(
    createUserSchema.safeParse({ ...base, dateOfBirth: "2999-01-01" }).success,
    false,
  );
  assert.equal(
    createUserSchema.safeParse({ ...base, homeCountry: "England" }).success,
    false,
  );
  assert.equal(
    createUserSchema.safeParse({ ...base, phoneNumber: "123" }).success,
    false,
  );
});

test("self-described gender requires a description and student-only fields are rejected for teachers", () => {
  const base = {
    firstName: "Ada",
    lastName: "Example",
    email: "ada@example.com",
    password: "a-long-unique-password",
  };
  assert.equal(
    createUserSchema.safeParse({
      ...base,
      role: "student",
      gender: "self_described",
    }).success,
    false,
  );
  assert.equal(
    createUserSchema.safeParse({
      ...base,
      role: "student",
      gender: "self_described",
      genderDescription: "Another identity",
    }).success,
    true,
  );
  assert.equal(
    createUserSchema.safeParse({
      ...base,
      role: "teacher",
      dateOfBirth: "2012-04-15",
    }).success,
    false,
  );
});

test("login accepts an organization slug but requires one organization identifier", () => {
  assert.equal(
    loginSchema.safeParse({
      email: "user@example.com",
      password: "correct-horse",
      organizationSlug: "example-school",
    }).success,
    true,
  );
  assert.equal(
    loginSchema.safeParse({
      email: "user@example.com",
      password: "correct-horse",
    }).success,
    false,
  );
});

test("platform organization creation requires an initial school admin and rejects extra fields", () => {
  const valid = createOrganizationSchema.safeParse({
    name: "Example School",
    slug: "example-school",
    admin: {
      firstName: "School",
      lastName: "Admin",
      email: "admin@example.com",
      password: "unique-long-password",
    },
  });
  assert.equal(valid.success, true);
  assert.equal(
    createOrganizationSchema.safeParse({
      name: "Example School",
      slug: "example-school",
      admin: {
        firstName: "School",
        lastName: "Admin",
        email: "admin@example.com",
        password: "short",
      },
    }).success,
    false,
  );
  assert.equal(
    createOrganizationSchema.safeParse({
      name: "Example School",
      slug: "example-school",
      platformRole: "platform_admin",
      admin: {
        firstName: "School",
        lastName: "Admin",
        email: "admin@example.com",
        password: "unique-long-password",
      },
    }).success,
    false,
  );
});

test("platform admin login does not accept an organization context", () => {
  assert.equal(
    platformAdminLoginSchema.safeParse({
      email: "platform@example.com",
      password: "valid-password",
    }).success,
    true,
  );
  assert.equal(
    platformAdminLoginSchema.safeParse({
      email: "platform@example.com",
      password: "valid-password",
      organizationSlug: "example-school",
    }).success,
    false,
  );
});

test("creating an organization is denied without an authenticated platform admin", async () => {
  const agent = request.agent(makeApp());
  const { body } = await agent.get("/api/v1/auth/csrf").expect(200);
  const response = await agent
    .post("/api/v1/platform/organizations")
    .set("X-CSRF-Token", body.data.csrfToken)
    .send({})
    .expect(401);
  assert.equal(response.body.message, "Authentication required");
});

test("only platform-admin accounts pass platform authorization", () => {
  let deniedError;
  requirePlatformAdmin({ user: { platformRole: null } }, {}, (error) => {
    deniedError = error;
  });
  assert.equal(deniedError.status, 403);

  let allowed = false;
  requirePlatformAdmin({ user: { platformRole: "platform_admin" } }, {}, (error) => {
    assert.equal(error, undefined);
    allowed = true;
  });
  assert.equal(allowed, true);
});
