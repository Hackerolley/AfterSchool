import { HttpError } from "../../utils/http-error.js";

const tokenCache = new Map();
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;

function apiHosts(environment) {
  return environment === "prelive"
    ? {
      auth: "https://prelive-oauth2.quran.foundation",
      api: "https://apis-prelive.quran.foundation",
    }
    : {
      auth: "https://oauth2.quran.foundation",
      api: "https://apis.quran.foundation",
    };
}

async function fetchJson(url, options, failureMessage) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, failureMessage);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new HttpError(502, failureMessage);
  }
  return { response, payload };
}

async function getAccessToken(config) {
  const clientId = config.QURAN_CLIENT_ID;
  const clientSecret = config.QURAN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new HttpError(503, "Quran.com is not configured yet. Ask your administrator to add the Quran API credentials.");
  }

  const environment = config.QURAN_API_ENV || "production";
  const cacheKey = `${environment}:${clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now()) return cached.value;

  const hosts = apiHosts(environment);
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const form = new URLSearchParams({ grant_type: "client_credentials", scope: "content" });
  const { response, payload } = await fetchJson(
    `${hosts.auth}/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form,
    },
    "Quran.com authentication is temporarily unavailable.",
  );
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new HttpError(502, "Quran.com authentication failed. Check the server-side client credentials and API environment.");
  }

  tokenCache.set(cacheKey, {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 3600) * 1000,
  });
  return payload.access_token;
}

export async function fetchQuranContent(config, path, query = new URLSearchParams()) {
  const hosts = apiHosts(config.QURAN_API_ENV || "production");
  const url = `${hosts.api}/content/api/v4${path}${query.size ? `?${query}` : ""}`;
  let token = await getAccessToken(config);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { response, payload } = await fetchJson(
      url,
      {
        headers: {
          Accept: "application/json",
          "x-auth-token": token,
          "x-client-id": config.QURAN_CLIENT_ID,
        },
      },
      "Quran.com content is temporarily unavailable. Please try again.",
    );
    if (response.status === 401 && attempt === 0) {
      tokenCache.delete(`${config.QURAN_API_ENV || "production"}:${config.QURAN_CLIENT_ID}`);
      token = await getAccessToken(config);
      continue;
    }
    if (!response.ok) {
      if (response.status === 403) {
        throw new HttpError(502, "Quran.com denied access. Check that this client has Content API permission.");
      }
      const status = response.status === 429 ? 503 : 502;
      throw new HttpError(status, "Quran.com could not complete this request. Please try again later.");
    }
    if (!payload || typeof payload !== "object") {
      throw new HttpError(502, "Quran.com returned an invalid response.");
    }
    return payload;
  }

  throw new HttpError(502, "Quran.com authentication expired. Please try again.");
}

export function clearQuranTokenCache() {
  tokenCache.clear();
}
