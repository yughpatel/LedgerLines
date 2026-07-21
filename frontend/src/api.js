const API_BASE = "http://localhost:8000";

async function request(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[api] network error on ${method} ${path}`, err);
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
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

export function getTransactions(token) {
  return request("/transactions", { token });
}

export function getSummary(token) {
  return request("/transactions/summary", { token });
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
