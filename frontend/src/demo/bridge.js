/* Online demo: the page talks to the Django backend running in a Web Worker (public-demo/demo-worker.js),
   which boots Pyodide (Python compiled to WebAssembly), unpacks backend.zip and serves the API. */

let worker = null;
let readyPromise = null;
let seq = 0;
const pending = new Map();
const progressListeners = new Set();
let lastProgress = { step: "start" };

function ensureWorker() {
  if (worker) return;
  worker = new Worker("./demo-worker.js", { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "progress") {
      lastProgress = m;
      progressListeners.forEach((f) => f(m));
    } else if (m.type === "response" || m.type === "error" || m.type === "reset-done") {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.type === "error") p.reject(new Error(m.message));
      else p.resolve(m);
    }
  };
  worker.onerror = (e) => {
    lastProgress = { step: "failed", detail: e.message || "worker error" };
    progressListeners.forEach((f) => f(lastProgress));
  };
}

function call(message, transfer = []) {
  ensureWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...message, id }, transfer);
  });
}

export function startDemo() {
  if (!readyPromise) {
    ensureWorker();
    readyPromise = call({ type: "boot", bundle: "./backend.zip?v=" + __BUNDLE_VERSION__ }).then((m) => {
      if (m.status !== 200) throw new Error("boot failed");
      return m;
    });
  }
  return readyPromise;
}

export function onDemoProgress(fn) {
  progressListeners.add(fn);
  fn(lastProgress);
  return () => progressListeners.delete(fn);
}

export async function demoRequest(req) {
  await startDemo();
  const transfer = req.body ? [req.body] : [];
  const m = await call({ type: "request", ...req }, transfer);
  return { status: m.status, headers: m.headers, body: m.body };
}

export async function resetDemo() {
  await startDemo();
  await call({ type: "reset" });
}
