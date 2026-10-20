import assert from "node:assert/strict";
import test from "node:test";
import session from "express-session";
import request from "supertest";
import { createApp } from "../src/app.js";
import { requirePlatformAdmin } from "../src/middleware/authenticate.js";
import { loginSchema, platformAdminLoginSchema } from "../src/modules/auth/auth.validator.js";
import {
  createOrganizationSchema,
  listOrganizationMembershipsQuerySchema,
  listOrganizationsQuerySchema,
  updateOrganizationSchema,
  updatePlatformMembershipStatusSchema,
} from "../src/modules/organizations/organization.validator.js";
import { createUserSchema } from "../src/modules/users/user.validator.js";
import {
  listAttendanceQuerySchema,
  recordAttendanceSchema,
  updateClassTimetableSchema,
} from "../src/modules/classes/class.validator.js";
import {
  canonicalYouTubeUrl,
  createAssignmentSchema,
  submitAssignmentSchema,
} from "../src/modules/assignments/assignment.validator.js";
import { privateDocumentUrl } from "../src/modules/assignments/cloudinary.service.js";
import { createLibraryItemSchema } from "../src/modules/library/library.validator.js";
import { updateProgressSchema } from "../src/modules/quran/quran.validator.js";
import { clearQuranTokenCache, fetchQuranContent } from "../src/modules/quran/quran.service.js";

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

test("Quran routes require an authenticated school student", async () => {
  await request(makeApp()).get("/api/v1/quran/chapters").expect(401);
  await request(makeApp()).get("/api/v1/quran/progress").expect(401);
});

test("Quran progress actions validate goals and canonical verse keys", () => {
  assert.equal(updateProgressSchema.safeParse({ action: "goal", dailyGoal: 5 }).success, true);
  assert.equal(updateProgressSchema.safeParse({ action: "goal", dailyGoal: 0 }).success, false);
  assert.equal(updateProgressSchema.safeParse({ action: "bookmark", verseKey: "2:255" }).success, true);
  assert.equal(updateProgressSchema.safeParse({ action: "read", verseKey: "115:1" }).success, false);
  assert.equal(updateProgressSchema.safeParse({ action: "memorize", verseKey: "2:0" }).success, false);
});

test("Quran content requests fail explicitly until server credentials are configured", async () => {
  await assert.rejects(
    fetchQuranContent({ QURAN_CLIENT_ID: "", QURAN_CLIENT_SECRET: "" }, "/chapters"),
    (error) => error.status === 503 && /not configured/.test(error.message),
  );
});

test("Quran content client obtains and uses a server-side client-credentials token", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  clearQuranTokenCache();
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const isTokenRequest = String(url).endsWith("/oauth2/token");
    return new Response(JSON.stringify(isTokenRequest
      ? { access_token: "test-access-token", expires_in: 3600 }
      : { chapters: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await fetchQuranContent({
      QURAN_CLIENT_ID: "test-client",
      QURAN_CLIENT_SECRET: "test-secret",
      QURAN_API_ENV: "prelive",
    }, "/chapters", new URLSearchParams({ language: "en" }));
    assert.deepEqual(result, { chapters: [] });
    assert.match(calls[0].url, /^https:\/\/prelive-oauth2\.quran\.foundation\/oauth2\/token$/);
    assert.match(calls[0].options.headers.Authorization, /^Basic /);
    assert.match(String(calls[0].options.body), /grant_type=client_credentials/);
    assert.match(String(calls[0].options.body), /scope=content/);
    assert.match(calls[1].url, /^https:\/\/apis-prelive\.quran\.foundation\/content\/api\/v4\/chapters\?language=en$/);
    assert.equal(calls[1].options.headers["x-auth-token"], "test-access-token");
    assert.equal(calls[1].options.headers["x-client-id"], "test-client");
  } finally {
    global.fetch = originalFetch;
    clearQuranTokenCache();
  }
});

test("Quran invalid client credentials return an actionable configuration error", async () => {
  const originalFetch = global.fetch;
  clearQuranTokenCache();
  global.fetch = async () => new Response(JSON.stringify({
    error: "invalid_client",
    error_description: "Client authentication failed",
  }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
  try {
    await assert.rejects(
      fetchQuranContent({
        QURAN_CLIENT_ID: "invalid-client",
        QURAN_CLIENT_SECRET: "invalid-secret",
        QURAN_API_ENV: "production",
      }, "/chapters"),
      (error) => error.status === 502 && /credentials/.test(error.message) && /environment/.test(error.message),
    );
  } finally {
    global.fetch = originalFetch;
    clearQuranTokenCache();
  }
});

test("assignment routes require a signed-in school member", async () => {
  await request(makeApp()).get("/api/v1/assignments").expect(401);
});

test("library routes require a signed-in school member", async () => {
  const agent = request.agent(makeApp());
  const csrfResponse = await agent.get("/api/v1/auth/csrf").expect(200);
  await agent.get("/api/v1/library").expect(401);
  await agent
    .post("/api/v1/library")
    .set("X-CSRF-Token", csrfResponse.body.data.csrfToken)
    .send({})
    .expect(401);
});

test("library validation accepts YouTube resources and rejects unsafe or incomplete entries", () => {
  const youtube = createLibraryItemSchema.safeParse({
    title: "Fractions explained",
    contentType: "youtube",
    youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
  });
  assert.equal(youtube.success, true);
  assert.equal(youtube.data.youtubeUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(createLibraryItemSchema.safeParse({
    title: "Untrusted embed",
    contentType: "youtube",
    youtubeUrl: "https://example.com/watch?v=dQw4w9WgXcQ",
  }).success, false);
  assert.equal(createLibraryItemSchema.safeParse({
    title: "Missing video",
    contentType: "youtube",
  }).success, false);
  assert.equal(createLibraryItemSchema.safeParse({
    title: "An ebook",
    contentType: "ebook",
    youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
  }).success, false);
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

test("class timetables accept weekly Google Meet sessions and reject unsafe or invalid entries", () => {
  const session = {
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:00",
    googleMeetLink: "https://meet.google.com/abc-defg-hij",
  };
  assert.equal(updateClassTimetableSchema.safeParse({ timetable: [session] }).success, true);
  assert.equal(updateClassTimetableSchema.safeParse({ timetable: [] }).success, true);
  assert.equal(updateClassTimetableSchema.safeParse({
    timetable: [{ ...session, googleMeetLink: "https://example.com/meeting" }],
  }).success, false);
  assert.equal(updateClassTimetableSchema.safeParse({
    timetable: [{ ...session, googleMeetLink: "http://meet.google.com/abc-defg-hij" }],
  }).success, false);
  assert.equal(updateClassTimetableSchema.safeParse({
    timetable: [{ ...session, googleMeetLink: "https://meet.google.com" }],
  }).success, false);
  assert.equal(updateClassTimetableSchema.safeParse({
    timetable: [{ ...session, googleMeetLink: "https://user:pass@meet.google.com/abc-defg-hij" }],
  }).success, false);
  assert.equal(updateClassTimetableSchema.safeParse({
    timetable: [{ ...session, startTime: "10:00", endTime: "09:00" }],
  }).success, false);
  assert.equal(updateClassTimetableSchema.safeParse({
    timetable: [{ ...session, dayOfWeek: 7 }],
  }).success, false);
});

test("class timetable updates require an authenticated school member", async () => {
  const agent = request.agent(makeApp());
  const csrfResponse = await agent.get("/api/v1/auth/csrf").expect(200);
  await agent
    .patch("/api/v1/classes/507f1f77bcf86cd799439011/timetable")
    .set("X-CSRF-Token", csrfResponse.body.data.csrfToken)
    .send({ timetable: [] })
    .expect(401);
  await agent.get("/api/v1/classes/attendance").expect(401);
  await agent
    .post("/api/v1/classes/507f1f77bcf86cd799439011/timetable-requests")
    .set("X-CSRF-Token", csrfResponse.body.data.csrfToken)
    .send({ timetable: [] })
    .expect(401);
});

test("class attendance validates session outcomes, reschedules, and date/time values", () => {
  const session = {
    sessionDate: "2026-10-19",
    startTime: "09:00",
    endTime: "10:00",
  };
  assert.equal(recordAttendanceSchema.safeParse({ ...session, action: "completed" }).success, true);
  assert.equal(recordAttendanceSchema.safeParse({ ...session, action: "missed", note: "Teacher unavailable" }).success, true);
  assert.equal(recordAttendanceSchema.safeParse({
    ...session,
    action: "rescheduled",
    rescheduledDate: "2026-10-20",
    rescheduledStartTime: "11:00",
    rescheduledEndTime: "12:00",
  }).success, true);
  assert.equal(recordAttendanceSchema.safeParse({
    ...session,
    action: "rescheduled",
    rescheduledDate: "2026-02-30",
    rescheduledStartTime: "11:00",
    rescheduledEndTime: "12:00",
  }).success, false);
  assert.equal(recordAttendanceSchema.safeParse({
    ...session,
    action: "rescheduled",
    rescheduledDate: "2026-10-20",
    rescheduledStartTime: "12:00",
    rescheduledEndTime: "11:00",
  }).success, false);
  assert.equal(recordAttendanceSchema.safeParse({
    ...session,
    action: "completed",
    endTime: "08:00",
  }).success, false);
  assert.equal(recordAttendanceSchema.safeParse({
    ...session,
    action: "cancelled",
  }).success, false);
  assert.equal(listAttendanceQuerySchema.safeParse({ limit: "200" }).success, true);
  assert.equal(listAttendanceQuerySchema.safeParse({ classId: "invalid" }).success, false);
});

test("class attendance reports require an authenticated school member", async () => {
  await request(makeApp()).get("/api/v1/classes/attendance").expect(401);
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

test("platform school management validates filters, lifecycle states, and membership actions", () => {
  assert.equal(listOrganizationsQuerySchema.safeParse({ status: "suspended", page: "2" }).success, true);
  assert.equal(listOrganizationsQuerySchema.safeParse({ status: "deleted" }).success, false);
  assert.equal(listOrganizationMembershipsQuerySchema.safeParse({
    role: "admin",
    status: "suspended",
    limit: "50",
  }).success, true);
  assert.equal(updateOrganizationSchema.safeParse({ name: "Updated school", status: "suspended" }).success, true);
  assert.equal(updateOrganizationSchema.safeParse({}).success, false);
  assert.equal(updatePlatformMembershipStatusSchema.safeParse({ status: "active" }).success, true);
  assert.equal(updatePlatformMembershipStatusSchema.safeParse({ status: "deleted" }).success, false);
});

test("platform school and membership management requires platform authentication", async () => {
  const agent = request.agent(makeApp());
  const { body } = await agent.get("/api/v1/auth/csrf").expect(200);
  const csrf = body.data.csrfToken;
  const base = "/api/v1/platform/organizations/507f1f77bcf86cd799439011";

  await agent.get("/api/v1/platform/organizations").expect(401);
  await agent.get(base).expect(401);
  await agent.get(`${base}/memberships`).expect(401);
  await agent
    .patch(base)
    .set("X-CSRF-Token", csrf)
    .send({ status: "suspended" })
    .expect(401);
  await agent
    .patch(`${base}/memberships/507f1f77bcf86cd799439012/status`)
    .set("X-CSRF-Token", csrf)
    .send({ status: "suspended" })
    .expect(401);
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
