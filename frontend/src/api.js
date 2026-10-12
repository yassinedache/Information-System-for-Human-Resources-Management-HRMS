/* API client. The same calls go either to the Django server (fetch) or, in the online demo,
   to the Django backend running in a Web Worker with Pyodide (see src/demo/bridge.js). */
import { demoRequest } from "./demo/bridge.js";

let csrfToken = null;
let language = "fr";

/** API messages (validation errors) follow the interface language. */
export function setApiLanguage(lang) { language = lang; }

export class ApiError extends Error {
  constructor(status, data) {
    super((data && data.detail) || `HTTP ${status}`);
    this.status = status;
    this.data = data || {};
    this.code = this.data.code || null;
    this.params = this.data.params || {};
  }
  /** field -> first message, for DRF validation errors ({"email": ["..."]}) */
  get fields() {
    const out = {};
    Object.entries(this.data).forEach(([k, v]) => {
      if (Array.isArray(v)) out[k] = String(v[0]);
      else if (typeof v === "string" && !["detail", "code", "field"].includes(k)) out[k] = v;
    });
    if (this.data.field && this.data.detail) out[this.data.field] = this.data.detail;
    return out;
  }
}

async function httpTransport({ method, path, query, headers, body }) {
  const res = await fetch("/api" + path + (query ? "?" + query : ""), { method, headers, body, credentials: "same-origin" });
  const h = {};
  res.headers.forEach((v, k) => { h[k.toLowerCase()] = v; });
  return { status: res.status, headers: h, body: await res.arrayBuffer() };
}

async function encodeForm(form) {
  // serialise a FormData into a multipart body (the demo has no real network stack)
  const req = new Request("http://local/", { method: "POST", body: form });
  return { contentType: req.headers.get("content-type"), bytes: await req.arrayBuffer() };
}

export async function request(method, path, { json, form, query, blob } = {}) {
  const headers = { "Accept-Language": language };
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  if (form) body = form;
  if (method !== "GET" && csrfToken) headers["X-CSRFToken"] = csrfToken;
  const q = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString() : "";
  let res;
  if (__DEMO__) {
    let bytes = null;
    if (form) {
      const enc = await encodeForm(form);
      headers["Content-Type"] = enc.contentType;
      bytes = enc.bytes;
    } else if (body !== undefined) bytes = new TextEncoder().encode(body).buffer;
    res = await demoRequest({ method, path: "/api" + path, query: q, headers, body: bytes });
  } else {
    res = await httpTransport({ method, path, query: q, headers, body });
  }
  if (blob && res.status < 400) return new Blob([res.body], { type: res.headers["content-type"] || "application/octet-stream" });
  const text = res.body && res.body.byteLength ? new TextDecoder().decode(res.body) : "";
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text.slice(0, 200) }; }
  if (data && data.csrfToken) csrfToken = data.csrfToken;
  if (res.status >= 400) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (path, query) => request("GET", path, { query }),
  post: (path, json = {}) => request("POST", path, { json }),
  patch: (path, json) => request("PATCH", path, { json }),
  put: (path, json) => request("PUT", path, { json }),
  del: (path) => request("DELETE", path),
  upload: (path, form) => request("POST", path, { form }),
  blob: (path) => request("GET", path, { blob: true }),
  async csrf() { const d = await request("GET", "/auth/csrf/"); csrfToken = d.csrfToken; return d; },
};
