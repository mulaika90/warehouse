const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers
    }
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || (response.status >= 500
      ? "The warehouse API returned a server error. Check that the backend is running and connected to MongoDB."
      : `Request failed (${response.status}).`);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function sendJson(method, data) {
  return { method, body: JSON.stringify(data) };
}
