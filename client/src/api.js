const API_URL = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
const CSRF_KEY = "afterschool.csrf";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body, organizationId, csrfToken } = {}) {
  const headers = new Headers({ Accept: "application/json" });
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers.set("Content-Type", "application/json");
  if (organizationId) headers.set("X-Organization-Id", organizationId);
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError("The request took too long. Check the server connection and try again.");
    }
    throw new ApiError("Can’t reach the school server. Check that the API is running, then try again.");
  } finally {
    window.clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;
  if (!payload) {
    const message = response.status >= 500
      ? `The server couldn't complete this request (${response.status}). Please try again.`
      : "The server returned an unexpected response.";
    throw new ApiError(message, response.status);
  }
  if (!response.ok) {
    if (
      response.status === 401 &&
      !["/auth/login", "/auth/platform/login", "/auth/csrf"].includes(path)
    ) {
      window.dispatchEvent(new Event("afterschool:unauthorized"));
    }
    throw new ApiError(payload.message || "Something went wrong. Please try again.", response.status);
  }
  return payload;
}

export async function getCsrfToken() {
  const payload = await request("/auth/csrf");
  const token = payload.data.csrfToken;
  sessionStorage.setItem(CSRF_KEY, token);
  return token;
}

function csrfToken() {
  const token = sessionStorage.getItem(CSRF_KEY);
  if (!token) throw new ApiError("Your session has expired. Please sign in again.", 401);
  return token;
}

export async function login({ mode, email, password, organizationSlug }) {
  const token = await getCsrfToken();
  const path = mode === "platform" ? "/auth/platform/login" : "/auth/login";
  const body = mode === "platform"
    ? { email, password }
    : { email, password, organizationSlug };
  const payload = await request(path, { method: "POST", body, csrfToken: token });
  sessionStorage.setItem(CSRF_KEY, payload.data.csrfToken);
  return payload.data;
}

export function getSchoolSession(organizationId) {
  return request("/auth/me", { organizationId });
}

export function getPlatformSession() {
  return request("/auth/platform/me");
}

export function logout() {
  return request("/auth/logout", { method: "POST", csrfToken: csrfToken() })
    .finally(() => sessionStorage.removeItem(CSRF_KEY));
}

export function apiGet(path, organizationId) {
  return request(path, { organizationId });
}

export function apiPost(path, body, organizationId) {
  return request(path, { method: "POST", body, organizationId, csrfToken: csrfToken() });
}

export function apiPostForm(path, body, organizationId) {
  return request(path, { method: "POST", body, organizationId, csrfToken: csrfToken() });
}

export function assignmentFileUrl(assignmentId, organizationId, submissionId) {
  const path = submissionId
    ? `/assignments/${assignmentId}/submissions/${submissionId}/file`
    : `/assignments/${assignmentId}/file`;
  return `${API_URL}${path}?organizationId=${encodeURIComponent(organizationId)}`;
}

export function apiPatch(path, body, organizationId) {
  return request(path, { method: "PATCH", body, organizationId, csrfToken: csrfToken() });
}

export function apiDelete(path, organizationId) {
  return request(path, { method: "DELETE", organizationId, csrfToken: csrfToken() });
}
