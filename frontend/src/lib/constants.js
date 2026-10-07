// A typed VITE_API_URL is fine with or without "https://" — a value that lacks
// a scheme used to be treated as a relative URL and silently hit the SPA itself.
const resolveApiBaseUrl = (value) => {
  const base = String(value || "https://esetu-production.up.railway.app").trim();
  const clean = base.replace(/\/+$/, "");
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
};

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
