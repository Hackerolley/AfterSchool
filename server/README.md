# AfterSchool API

Node.js, Express, and MongoDB backend for the online school platform. This implementation targets the blueprint's working milestone after Phase 4: a school administrator can create teachers and students, define courses and classes, assign teachers, and enroll students.

## Requirements and setup

- Node.js 20+
- MongoDB 6+

From this directory:

```sh
npm install
copy .env.example .env
npm run dev
```

Configuration is loaded from `server/.env` or the workspace-root `.env` (the server-local file takes precedence). Set `MONGODB_URI` and replace `SESSION_SECRET` with a randomly generated value of at least 32 characters before starting. Add the deployed browser application's exact origin to `CLIENT_ORIGINS` (comma-separated when there is more than one). In production, serve the API over HTTPS and configure `TRUST_PROXY` for the actual reverse proxy.

The API listens on port 4000 by default. `GET /api/v1/health` reports application and MongoDB connectivity.

Assignment documents and library ebooks require a Cloudinary account. Add these variables to `server/.env` (or the workspace-root `.env`, which the server also loads):

```text
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Find the values in your Cloudinary account dashboard. Keep the API secret server-side and out of source control; `.env` files are ignored by Git. Restart the API after adding the values. Documents are uploaded as authenticated Cloudinary assets; authorized users receive a short-lived download URL. Assignment documents accept PDF, DOC, DOCX, and TXT files up to 10 MB; library ebooks accept PDF files up to 25 MB. Text and web/YouTube link assignments do not require Cloudinary.

If startup reports a MongoDB TLS/SSL handshake error, confirm the Atlas cluster is running and its Network Access IP access list includes your current public IP. Then check whether a VPN, proxy, firewall, or managed network is interrupting TLS; retry from a trusted network if necessary. Keep TLS verification enabled.

## Initial organization administrator

There is deliberately no public route that can create an administrator. Provision each organization and its first administrator through the one-time bootstrap script. Set `MONGODB_URI` and the following variables in the process environment; do not put real credentials in source control:

```text
BOOTSTRAP_ORG_NAME=Example School
BOOTSTRAP_ORG_SLUG=example-school
BOOTSTRAP_ADMIN_FIRST_NAME=School
BOOTSTRAP_ADMIN_LAST_NAME=Administrator
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=<unique password of at least 12 characters>
```

Then run `npm run bootstrap`. The script refuses an existing organization slug or email and never prints the supplied password. Clear the bootstrap environment variables after provisioning.

## Platform administrator and school creation

Platform administrators are global accounts, separate from organization-scoped school admins. They have no public registration endpoint and must be provisioned by an operator. Set these temporary values in the environment (or `.env`) and run `npm run bootstrap:platform-admin`:

```text
PLATFORM_ADMIN_FIRST_NAME=Platform
PLATFORM_ADMIN_LAST_NAME=Administrator
PLATFORM_ADMIN_EMAIL=platform-admin@example.com
PLATFORM_ADMIN_PASSWORD=<unique password of at least 12 characters>
```

Remove the temporary variables after successful provisioning. A platform admin signs in at `POST /api/v1/auth/platform/login` with email and password, then can create and manage schools and memberships through `/api/v1/platform/organizations`. The platform login endpoint uses the same CSRF/session-cookie flow as school login, but does not require an organization header.

Platform operators can search and paginate schools, view membership counts, edit a school's display name or sign-in slug, suspend/reactivate school access, and archive/restore a school. Memberships can be searched by member name or email and filtered by role or status; suspending or reactivating a membership changes access only in that school, not the member's global account. A school must retain at least one active administrator. School deletion is intentionally not offered: archiving blocks sign-in while preserving academic records.

Example create-school JSON:

```json
{
  "name": "Example School",
  "slug": "example-school",
  "admin": {
    "firstName": "School",
    "lastName": "Administrator",
    "email": "admin@example.com",
    "password": "<unique password of at least 12 characters>"
  }
}
```

Organization, first admin account, and school-admin membership are created in one MongoDB transaction. The admin email must not already be registered. The API never returns the supplied password or its hash.

## Authentication and tenant context

1. `GET /api/v1/auth/csrf` obtains a CSRF token and establishes the pre-authentication session cookie.
2. Send that token in `X-CSRF-Token` with `POST /api/v1/auth/login`. The JSON body contains `email`, `password`, and exactly one of `organizationId` or `organizationSlug`.
3. Login replaces the pre-authentication session, stores only the user identity in a server-managed MongoDB session, and returns the active membership's role and a rotated CSRF token.
4. Send the session cookie, the current `X-CSRF-Token` on every state-changing request, and `X-Organization-Id` on all authenticated requests.
5. `GET /api/v1/auth/me` returns the active user's organization membership. `POST /api/v1/auth/logout` destroys the session.
6. Platform operators use `POST /api/v1/auth/platform/login` and `GET /api/v1/auth/platform/me`; these routes do not use an organization context.

The account is global, while school roles and active/suspended/inactive status are specific to an organization's membership. Every academic record and query is scoped by organization. A user must have an active membership in the requested organization. School roles are `admin`, `teacher`, and `student`; a separate global `platform_admin` role is assigned only by the protected CLI bootstrap.

## API endpoints and purpose

All routes are under `/api/v1`. Authenticated school routes require the session cookie and `X-Organization-Id`; all state-changing requests require `X-CSRF-Token`. The two assignment file-download routes also accept `organizationId` as a query parameter for normal browser links, and still validate the signed-in user's membership. Platform-admin routes use the same session and CSRF protections but do not use a school organization header.

Paginated list routes accept `page` (default `1`) and `limit` (default `20`, maximum `100`) and return pagination metadata. Routes marked as searchable also accept `search`.

### Health and authentication

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/health` | Check API health and whether MongoDB is connected. Returns `503` when the database is disconnected. | Public |
| GET | `/auth/csrf` | Create or retrieve the session's CSRF token before login or another state-changing request. | Public |
| POST | `/auth/login` | Sign in to a school using email, password, and exactly one of `organizationId` or `organizationSlug`; returns the active school membership and CSRF token. | Public; rate-limited |
| POST | `/auth/platform/login` | Sign in a platform administrator without selecting a school; returns a platform session and CSRF token. | Public; rate-limited |
| GET | `/auth/me` | Get the signed-in user's profile and role in the selected school. | Active member of selected school |
| GET | `/auth/platform/me` | Get the signed-in platform administrator's profile. | Platform admin |
| POST | `/auth/logout` | Destroy the current session and clear its cookie. | Authenticated |

### Platform school management

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/platform/organizations` | Create a school and its first school-admin account and membership in one database transaction. The request body contains `name`, `slug`, and an `admin` object with `firstName`, `lastName`, `email`, and a password of at least 12 characters. | Platform admin |
| GET | `/platform/organizations` | Search schools by name or slug; paginate and optionally filter by `active`, `suspended`, or `inactive` status. Includes active-member/admin counts and overall status totals. | Platform admin |
| GET | `/platform/organizations/:organizationId` | Get school details and membership counts by status. | Platform admin |
| PATCH | `/platform/organizations/:organizationId` | Update the school `name`, sign-in `slug`, or lifecycle `status` (`active`, `suspended`, or `inactive`). `inactive` archives the school without deleting its records. | Platform admin |
| GET | `/platform/organizations/:organizationId/memberships` | Search members by name/email; paginate and filter by `role` or membership `status` (`active`, `suspended`, or `inactive`). | Platform admin |
| PATCH | `/platform/organizations/:organizationId/memberships/:membershipId/status` | Activate, suspend, or deactivate a membership in this school. The last active school administrator cannot be deactivated. | Platform admin |

### Users, students, and teachers

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/users` | List school memberships with user profiles; supports pagination, search, and `role`/`status` filters. | School admin |
| POST | `/users` | Create a teacher or student account and its school membership/profile. Cannot create school admins. | School admin |
| GET | `/users/:membershipId` | Get a user's membership and account profile in this school. | School admin |
| PATCH | `/users/:membershipId/status` | Activate, suspend, or deactivate this user's membership in this school; does not change the global account status. | School admin |
| GET | `/students` | List active students with their profiles; supports pagination and search. Teachers see only students enrolled in their assigned classes. | School admin or teacher |
| POST | `/students` | Create a student account and school-specific profile. Optional profile fields: `dateOfBirth` (`YYYY-MM-DD`), `gender` (`female`, `male`, `non_binary`, `self_described`, or `prefer_not_to_say`), `genderDescription` (required for `self_described`), `countryOfResidence` and `homeCountry` (two-letter ISO 3166-1 alpha-2 codes), `phoneNumber`, `studentNumber`, and guardian contact details. | School admin |
| GET | `/students/:membershipId` | Get a student's profile. Teachers must be assigned to a class containing the student; students can retrieve only their own profile. | School admin, assigned teacher, or that student |
| GET | `/teachers` | List active teachers with their profiles; supports pagination and search. | School admin |
| POST | `/teachers` | Create a teacher account and teacher profile in this school. | School admin |
| GET | `/teachers/:membershipId` | Get a teacher's profile. | School admin |
| GET | `/teachers/:membershipId/classes` | List the classes assigned to a teacher; supports pagination. | School admin or that teacher |

### Courses and classes

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/courses` | List courses in the school; supports pagination, search, and status filters. Teachers see courses for their assigned classes; students see courses for their active enrollments. | Active school member |
| POST | `/courses` | Create a course with a name, code, and optional description. Course codes must be unique within the school. | School admin |
| GET | `/courses/:courseId` | Get a course. Teachers must be assigned to one of its classes; students must be enrolled in one of its classes. | School admin, assigned teacher, or enrolled student |
| GET | `/classes` | List classes with course and teacher information; supports pagination, search, and status filters. Teachers see their assigned classes; students see their active enrollments. | Active school member |
| POST | `/classes` | Create a class for an active course and assign an active teacher from this same school; accepts an optional capacity and weekly timetable. | School admin |
| PATCH | `/classes/:classId/timetable` | Replace a class's weekly timetable. Each session has `dayOfWeek` (`0` Sunday through `6` Saturday), 24-hour `startTime` and `endTime`, and an HTTPS `googleMeetLink` on `meet.google.com`. | School admin |
| POST | `/classes/:classId/timetable-requests` | Submit a proposed replacement timetable. The approved schedule remains active until an admin reviews it. | Teacher assigned to class |
| POST | `/classes/:classId/timetable-requests/approve` | Publish the class's pending teacher timetable proposal. | School admin |
| POST | `/classes/:classId/timetable-requests/reject` | Reject and clear the class's pending teacher timetable proposal. | School admin |
| GET | `/classes/attendance` | List recent class-session attendance records; teachers see assigned classes, students see actively enrolled classes, and admins see the school. Supports pagination and an optional `classId`. | School admin, teacher, or student |
| POST | `/classes/:classId/attendance` | Record a session as `completed`, `missed`, or `rescheduled`. Each record is keyed to one class occurrence by its date and start time. Reschedules also record the replacement date and time without changing the recurring timetable. | School admin or assigned teacher |
| GET | `/classes/:classId` | Get class details. Teachers must be assigned to the class; students must be actively enrolled in it. | School admin, assigned teacher, or enrolled student |
| GET | `/classes/:classId/students` | List active enrollments and student profiles in a class; supports pagination. A student can retrieve only their own enrollment. | School admin, assigned teacher, or that class's student |
| POST | `/classes/:classId/enrollments` | Enroll an active student in an active class. Reserves capacity atomically and rejects a full class or duplicate enrollment. | School admin |
| DELETE | `/classes/:classId/enrollments/:enrollmentId` | Withdraw an active student enrollment while keeping the enrollment record as history and releasing class capacity. | School admin |

Class capacity is reserved atomically when enrolling; withdrawn enrollments remain as history and cannot be re-created for the same student/class pair. User and list responses do not include password hashes or passwords.

Class timetables are recurring weekly sessions and are included in class list/detail responses. Teachers see schedules and pending proposals for classes assigned to them, and students see only the approved schedules for classes they are actively enrolled in.

Attendance is recorded per scheduled class occurrence, not per student. Each occurrence keeps its date, time, outcome, recording staff member, timestamp, and optional note; rescheduled sessions additionally retain their replacement date and time. Teachers can update attendance for their assigned classes, school admins can update any class in their organization, and students can read reports only for classes in which they are actively enrolled.

### Assignments and submissions

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/assignments` | List published assignments for the signed-in role: teachers' classes, students' active enrollments, or all school assignments for admins. Student entries include their own submission state. | Active school member |
| POST | `/assignments` | Create an assignment for a class taught by the current teacher. Supports text, a Cloudinary document upload, an HTTP(S) link, or a YouTube video URL, with optional instructions and due date. Multipart form data is used for documents. | Teacher assigned to class |
| GET | `/assignments/:assignmentId` | Get an assignment visible to the current teacher, enrolled student, or school admin. Students receive only their own submission. | Authorized class member |
| GET | `/assignments/:assignmentId/file` | Redirect to a short-lived, signed download for the assignment document. | Authorized class member |
| POST | `/assignments/:assignmentId/submissions` | Submit or update a response as text, a PDF/Word/TXT document, or an HTTP(S) link. Late work is accepted and marked as late. Multipart form data is used for file submissions. | Student actively enrolled in the assignment's class |
| GET | `/assignments/:assignmentId/submissions` | List student submissions for the assignment, including student names and submission details. | Teacher who created the assignment |
| GET | `/assignments/:assignmentId/submissions/:submissionId/file` | Redirect to a short-lived, signed download for a student's submitted document. | School admin, assigned teacher, or that student |

### School library

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/library` | List published ebooks and YouTube videos shared with the school. | Active school member |
| POST | `/library` | Add an ebook PDF (multipart form with `file`) or a YouTube video (`youtubeUrl`), with a title and optional description. | School admin |
| PATCH | `/library/:itemId` | Update a resource; ebook uploads can replace the current PDF. | School admin |
| DELETE | `/library/:itemId` | Remove a resource and its stored ebook file. | School admin |
| GET | `/library/:itemId/file` | Redirect to a short-lived, authenticated ebook download. Browser requests pass the school ID as the `organizationId` query parameter; membership is still checked. | Active school member |

Library PDFs are stored as private authenticated Cloudinary assets. YouTube links are validated and embedded using YouTube's privacy-enhanced player. Library items and downloads are scoped to the selected school.

Assignment and submission documents are stored in Cloudinary using authenticated delivery. For YouTube assignments, the client accepts YouTube video URLs and embeds them with YouTube's privacy-enhanced `youtube-nocookie.com` player; no separate embed provider is needed.

An admin creating a new account supplies a password of at least 12 characters. When adding an account that already exists in another organization, omit `password`; the existing credentials are retained, and the new membership receives its own organization-specific role and profile.

## Validation

Run `npm test` for the backend test suite. The database-backed application requires a reachable MongoDB instance for normal startup and bootstrap.
