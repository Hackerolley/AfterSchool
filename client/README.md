# AfterSchool client

React + Vite web client for the AfterSchool API. It includes school and platform-admin sign-in, cookie-backed sessions with CSRF protection, role-specific school dashboards, and the management flows currently available in the API.

## Run locally

1. Start the backend by following [server setup](../server/README.md). The API defaults to `http://localhost:4000`.
2. In this directory, run:

   ```sh
   npm install
   copy .env.example .env
   npm run dev
   ```

3. Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

The Vite development server proxies `/api` to `http://localhost:4000` by default. This keeps browser API requests same-origin, including when opening the frontend at `localhost` or `127.0.0.1`, and lets the server-managed HTTP-only session cookie work without a development CORS mismatch. Set `VITE_API_URL` if the API is hosted somewhere else; when using a direct cross-origin URL, the backend's `CLIENT_ORIGINS` must allow the exact frontend origin. Browser requests include credentials so the HTTP-only session cookie is sent automatically.

## Included screens

- **School sign-in:** school slug, email, and password.
- **Platform-admin sign-in:** email and password.
- **School workspace:** role-specific overview, class and course directories, teacher/student assignment dashboards, and school-admin people management.
- **School-admin actions:** add students and teachers, create courses and classes, and enroll students. Student creation includes the available student/guardian profile fields.
- **Assignments:** teachers can publish text, document, link, or YouTube assignments to their classes and review submissions. Students can view class assignments and submit text, a document, or a link. Document uploads require the backend's Cloudinary credentials.
- **Platform console:** create an organization and its first school administrator.

The client does not store passwords or authentication tokens. The HTTP-only session cookie remains server-managed; the CSRF token is held in session storage for state-changing API requests. The backend remains responsible for authorization and tenant isolation.
