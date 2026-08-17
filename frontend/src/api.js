const API_BASE = "http://localhost:8000";

// App wires this once. Called with a new access token after a successful
// silent refresh, or with null when refresh failed / we've lost auth.
let onAuthChange = null;
export function setOnAuthChange(cb) { onAuthChange = cb; }

// Single-flight refresh: if multiple 401s land in parallel, they all await
// the same POST /auth/refresh instead of stampeding.
let refreshInFlight = null;
function attemptRefresh() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
      const data = await res.json();
      const newToken = data.access_token;
      localStorage.setItem("ll_token", newToken);
      if (onAuthChange) onAuthChange(newToken);
      return newToken;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function request(path, { method = "GET", token, body, _isRetry = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[api] network error on ${method} ${path}`, err);
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  // 401 interceptor: try one silent refresh, then retry once with the new token.
  // Skip for /auth/* endpoints (login/signup/refresh/logout own their own auth
  // semantics) and for the retry itself (prevents infinite loops).
  if (
    res.status === 401 &&
    token &&
    !_isRetry &&
    !path.startsWith("/auth/")
  ) {
    try {
      const newToken = await attemptRefresh();
      return request(path, { method, token: newToken, body, _isRetry: true });
    } catch {
      if (onAuthChange) onAuthChange(null);
      // fall through — the original 401 propagates below
    }
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    // The rate limiter (slowapi) answers with {"error": "..."} instead of FastAPI's
    // {"detail": ...}, so without its own branch this fell through to a bare status code.
    if (res.status === 429) {
      console.error(`[api] ${method} ${path} → 429`, data);
      throw new Error("Too many attempts. Please wait a minute and try again.");
    }

    const detail =
      (data && (data.detail || data.message || data.error)) ||
      (typeof data === "string" && data) ||
      `Request failed (${res.status})`;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ")
      : String(detail);
    console.error(`[api] ${method} ${path} → ${res.status}`, data);
    throw new Error(message);
  }

  return data;
}

export function login(email, password) {
  return request("/auth/login", { method: "POST", body: { email, password } });
}

export function signup(email, password) {
  return request("/auth/signup", { method: "POST", body: { email, password } });
}

export function logout() {
  return request("/auth/logout", { method: "POST" });
}

export function refreshToken() {
  return request("/auth/refresh", { method: "POST" });
}

export function getMe(token) {
  return request("/auth/me", { token });
}

export function getTransactions(token) {
  return request("/transactions", { token });
}

export function getSummary(token) {
  return request("/transactions/summary", { token });
}

export function getCategories(token) {
  return request("/categories", { token });
}

export function createTransaction(token, data) {
  return request("/transactions", { method: "POST", token, body: data });
}

export function updateTransaction(token, id, data) {
  return request(`/transactions/${id}`, { method: "PUT", token, body: data });
}

export function deleteTransaction(token, id) {
  return request(`/transactions/${id}`, { method: "DELETE", token });
}
