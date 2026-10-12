/* Web Worker (module) of the online demo: runs the real Django backend in the browser.

   1. load Pyodide (CPython compiled to WebAssembly) from a CDN;
   2. unpack backend.zip (Django, Django REST framework and the HRMS code) into Pyodide's file system;
   3. restore the visitor's previous database from IndexedDB, or migrate and seed a fresh fictional company;
   4. answer every API request through Django's WSGI handler (demo/demo_server.py).
   After each change (before answering), the SQLite file, uploaded CVs and cookies are saved to IndexedDB. */

const PYODIDE_VERSION = "314.0.7";
const PYODIDE_BASES = [
  `https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}/`,
  `https://unpkg.com/pyodide@${PYODIDE_VERSION}/`,
];
const DB_PATH = "/tmp/hrms.sqlite3";
const MEDIA = "/tmp/media";
const STORE = "hrms-demo";
const MAX_AGE_DAYS = 7;          // older snapshots are replaced by a fresh company (dates relative to today)

let py = null;
let server = null;
let bundleVersion = "";

const progress = (step, detail) => self.postMessage({ type: "progress", step, detail });

/* ---------------------------------------------------------------- IndexedDB snapshot */
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(STORE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const q = db.transaction("kv").objectStore("kv").get(key);
      q.onsuccess = () => resolve(q.result || null);
      q.onerror = () => resolve(null);
    });
  } catch { return null; }
}
async function idbPut(key, value) {
  try {
    const db = await idb();
    await new Promise((resolve) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch { /* private browsing: the demo still works, without persistence */ }
}

function listFiles(dir) {
  const out = [];
  let names = [];
  try { names = py.FS.readdir(dir); } catch { return out; }
  for (const n of names) {
    if (n === "." || n === "..") continue;
    const p = dir + "/" + n;
    const st = py.FS.stat(p);
    if (py.FS.isDir(st.mode)) out.push(...listFiles(p));
    else out.push({ path: p, bytes: py.FS.readFile(p) });
  }
  return out;
}
function mkdirs(path) {
  let cur = "";
  for (const part of path.split("/").slice(1, -1)) {
    cur += "/" + part;
    try { py.FS.mkdir(cur); } catch { /* exists */ }
  }
}

async function saveSnapshot() {
  try {
    const jarProxy = server.get_jar();
    const jar = jarProxy.toJs({ dict_converter: Object.fromEntries });
    jarProxy.destroy();
    await idbPut("snapshot", {
      version: bundleVersion, savedAt: Date.now(), secret: self.__secret,
      db: py.FS.readFile(DB_PATH), media: listFiles(MEDIA), jar,
    });
  } catch (e) { /* persistence is best effort */ }
}

/* ---------------------------------------------------------------- boot */
async function loadRuntime() {
  // Pyodide 314 only runs in module workers: the ES module is imported from the CDN (jsDelivr, then unpkg)
  const errors = [];
  for (const base of PYODIDE_BASES) {
    try {
      const { loadPyodide } = await import(/* @vite-ignore */ base + "pyodide.mjs");
      return await loadPyodide({ indexURL: base });
    } catch (e) {
      errors.push(`${new URL(base).host}: ${e && e.message ? e.message : e}`);
    }
  }
  throw new Error("Pyodide could not be loaded (" + errors.join(" | ") + ")");
}

async function boot(bundleUrl) {
  const t0 = performance.now();
  bundleVersion = (bundleUrl.split("v=")[1] || "1");
  progress("runtime");
  const bundleP = fetch(bundleUrl).then((r) => { if (!r.ok) throw new Error("backend.zip: " + r.status); return r.arrayBuffer(); });
  py = await loadRuntime();
  progress("bundle");
  py.unpackArchive(new Uint8Array(await bundleP), "zip", { extractDir: "/hrms" });
  const snap = await idbGet("snapshot");
  const fresh = !(snap && snap.version === bundleVersion && Date.now() - snap.savedAt < MAX_AGE_DAYS * 864e5);
  self.__secret = fresh || !snap.secret ? crypto.getRandomValues(new Uint32Array(8)).join("-") : snap.secret;
  if (!fresh) {
    py.FS.writeFile(DB_PATH, snap.db);
    for (const f of snap.media || []) { mkdirs(f.path); py.FS.writeFile(f.path, f.bytes); }
  }
  progress("django");
  py.runPython(`
import os, sys
sys.path[:0] = ["/hrms/site", "/hrms/app"]
os.environ["DJANGO_SECRET_KEY"] = ${JSON.stringify(self.__secret)}
import demo_server
`);
  server = py.globals.get("demo_server");
  progress("database", fresh ? "seed" : "restore");
  server.boot(fresh);
  if (!fresh && snap.jar) server.set_jar(py.toPy(snap.jar));
  if (fresh) await saveSnapshot();
  progress("ready", Math.round(performance.now() - t0));
}

function handle(m) {
  const res = server.handle(m.method, m.path, m.query || "", py.toPy(m.headers || {}), m.body ? new Uint8Array(m.body) : new Uint8Array());
  const [status, headers, body] = res.toJs();
  res.destroy && res.destroy();
  const h = {};
  for (const [k, v] of headers) h[String(k).toLowerCase()] = String(v);
  const buf = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
  return { status, headers: h, body: buf };
}

let bootPromise = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "boot") {
      bootPromise = bootPromise || boot(m.bundle);
      await bootPromise;
      self.postMessage({ type: "response", id: m.id, status: 200, headers: {}, body: new ArrayBuffer(0) });
    } else if (m.type === "request") {
      await bootPromise;
      const r = handle(m);
      // saved before answering: once the page shows a change, it survives a reload
      if (m.method !== "GET") await saveSnapshot();
      self.postMessage({ type: "response", id: m.id, ...r }, [r.body]);
    } else if (m.type === "reset") {
      await bootPromise;
      progress("database", "seed");
      py.runPython(`
import shutil
from django.core.management import call_command
import demo_server
shutil.rmtree("${MEDIA}", ignore_errors=True)
call_command("seed_demo", reset=True, verbosity=0)
demo_server.set_jar({})
`);
      await saveSnapshot();
      progress("ready", 0);
      self.postMessage({ type: "reset-done", id: m.id });
    }
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (m.type === "boot") progress("failed", message.slice(0, 400));
    self.postMessage({ type: "error", id: m.id, message });
  }
};
