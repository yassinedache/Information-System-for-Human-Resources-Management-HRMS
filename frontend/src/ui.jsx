/* Small shared components: data loading, modals, toasts, form fields, badges, avatars. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "./i18n.jsx";

/* ------------------------------------------------------------------ data loading */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const load = useCallback(() => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve()
      .then(fn)
      .then((data) => { if (n === seq.current) setState({ data, error: null, loading: false }); return data; })
      .catch((error) => { if (n === seq.current) setState((s) => ({ data: s.data, error, loading: false })); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === "function" ? d(s.data) : d })) };
}

export function Loading({ label }) {
  const { t } = useI18n();
  return <div className="loading"><Loader2 size={20} className="spin" /> {label || t("common.loading")}</div>;
}

export function ErrorBox({ error, onRetry }) {
  const i = useI18n();
  if (!error) return null;
  return (
    <div className="alert error" role="alert">
      <AlertCircle size={18} />
      <div className="grow">{i.error(error)}</div>
      {onRetry && <button className="btn sm" onClick={onRetry}>{i.t("common.retry")}</button>}
    </div>
  );
}

/** loading / error / content */
export function Async({ q, children }) {
  if (q.error && !q.data) return <ErrorBox error={q.error} onRetry={q.reload} />;
  if (!q.data) return <Loading />;
  return children(q.data);
}

export function Empty({ icon: Icon = Info, children }) {
  return <div className="empty"><Icon size={28} />{children}</div>;
}

/* ------------------------------------------------------------------ toasts */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = "ok") => {
    const id = Math.random();
    setItems((l) => [...l, { id, text, kind }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((x) => (
          <div key={x.id} className={"toast " + (x.kind === "error" ? "error" : "")}>{x.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ------------------------------------------------------------------ modal */
export function Modal({ title, onClose, children, footer, wide, className = "" }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className={"modal-bg " + className} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label={t("common.close")}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Form in a modal: submit() may throw an ApiError; field errors show under their fields, the rest below the form. */
export function FormModal({ title, onClose, submit, children, submitLabel, wide, danger }) {
  const i = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const names = useRef(new Set());
  const register = useCallback((n) => { names.current.add(n); return () => names.current.delete(n); }, []);
  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submit(new FormData(e.currentTarget), e.currentTarget);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const errors = i.fieldErrors(error);
  const keys = Object.keys(errors);
  const showBox = error && (!keys.length || keys.some((k) => !names.current.has(k)));
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={onSubmit} className="stack">
        <FieldErrors.Provider value={{ errors, register }}>{children}</FieldErrors.Provider>
        {showBox && <ErrorBox error={error} />}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>{i.t("common.cancel")}</button>
          <button type="submit" className={"btn " + (danger ? "danger" : "primary")} disabled={busy}>
            {busy && <Loader2 size={16} className="spin" />}{submitLabel || i.t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const FieldErrors = createContext({ errors: {}, register: null });

export function Field({ label, name, hint, full, children, error }) {
  const { errors, register } = useContext(FieldErrors);
  useEffect(() => (name && register ? register(name) : undefined), [name, register]);
  const err = error || (name && errors[name]);
  return (
    <label className={"field" + (full ? " full" : "")}>
      <span>{label}</span>
      {children}
      {hint && !err && <small className="hint">{hint}</small>}
      {err && <small className="err">{err}</small>}
    </label>
  );
}

export function Input({ name, ...props }) {
  const { errors } = useContext(FieldErrors);
  return <input className={"input" + (name && errors[name] ? " invalid" : "")} name={name} {...props} />;
}

export function Select({ name, options, placeholder, ...props }) {
  const { errors } = useContext(FieldErrors);
  return (
    // remounted when the options arrive, so that defaultValue applies to options loaded after the first render
    <select key={options.length} className={"input" + (name && errors[name] ? " invalid" : "")} name={name} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

export function Textarea({ name, ...props }) {
  const { errors } = useContext(FieldErrors);
  return <textarea className={"input" + (name && errors[name] ? " invalid" : "")} name={name} {...props} />;
}

/** FormData -> object, empty strings become null for the listed keys */
export function formObject(fd, nullable = []) {
  const o = Object.fromEntries(fd.entries());
  nullable.forEach((k) => { if (o[k] === "") o[k] = null; });
  return o;
}

/* ------------------------------------------------------------------ confirm */
export function useConfirm() {
  const [state, setState] = useState(null);
  const i = useI18n();
  const confirm = (message, { danger = true, label } = {}) => new Promise((resolve) => setState({ message, danger, label, resolve }));
  const close = (v) => { state && state.resolve(v); setState(null); };
  const node = state && (
    <Modal title={i.t("common.confirm")} onClose={() => close(false)} footer={<>
      <button className="btn" onClick={() => close(false)}>{i.t("common.cancel")}</button>
      <button className={"btn " + (state.danger ? "danger" : "primary")} onClick={() => close(true)} autoFocus>{state.label || i.t("common.confirm")}</button>
    </>}>
      <p>{state.message}</p>
    </Modal>
  );
  return [confirm, node];
}

/* ------------------------------------------------------------------ badges, avatars */
const COLORS = ["#4169e1", "#0891b2", "#7c3aed", "#db2777", "#059669", "#d97706", "#dc2626", "#4f46e5", "#0d9488", "#9333ea"];
export function Avatar({ first = "", last = "", size }) {
  const n = (first + last).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span className={"avatar" + (size === "lg" ? " lg" : "")} style={{ background: COLORS[n % COLORS.length] }} aria-hidden="true">
      {(first[0] || "") + (last[0] || "")}
    </span>
  );
}

export function Person({ first, last, sub, name }) {
  const [f, ...rest] = (name || `${first || ""} ${last || ""}`).trim().split(" ");
  return (
    <div className="person">
      <Avatar first={f} last={rest.join(" ")} />
      <div className="meta">
        <div><b>{name || `${first} ${last}`}</b></div>
        {sub && <div className="muted small">{sub}</div>}
      </div>
    </div>
  );
}

const TONES = {
  active: "green", on_leave: "cyan", inactive: "", present: "green", absent: "red", not_recorded: "",
  pending: "orange", approved: "green", rejected: "red", cancelled: "",
  upcoming: "blue", ended: "", archived: "",
  draft: "orange", validated: "green",
  open: "green", closed: "",
  received: "blue", shortlisted: "cyan", interview: "orange", hired: "green",
};
export function StatusBadge({ value, group }) {
  const { t } = useI18n();
  return <span className={"badge " + (TONES[value] || "")}><span className="dot" />{t(`${group}.${value}`)}</span>;
}

export function Stat({ icon: Icon, label, value, sub, tone = "", to, onClick }) {
  const inner = (
    <>
      <div className={"ico " + tone}><Icon size={24} /></div>
      <div>
        <h3>{label}</h3>
        <div className="value">{value}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </>
  );
  if (to) return <Link className="card stat" to={to} onClick={onClick}>{inner}</Link>;
  return <div className="card stat">{inner}</div>;
}

export function Notice({ kind = "info", children }) {
  const Icon = kind === "error" ? AlertCircle : kind === "success" ? CheckCircle2 : Info;
  return <div className={"alert " + (kind === "info" ? "" : kind)}><Icon size={18} /><div>{children}</div></div>;
}

/** Shows a temporary password once, with a copy button. */
export function PasswordReveal({ name, password, onClose }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Modal title={t("acct.title")} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>{t("common.done")}</button>}>
      <p>{t("acct.text", { name })}</p>
      <div className="secret">{password}</div>
      <button className="btn" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(password).then(() => setCopied(true)).catch(() => {}); }}>
        {copied ? t("common.copied") : t("common.copy")}
      </button>
      <Notice>{t("acct.hint")}</Notice>
    </Modal>
  );
}

/** Working days between two ISO dates (Friday and Saturday off), as the backend counts them. */
export function workingDays(start, end, weekend = [4, 5]) {
  if (!start || !end || end < start) return 0;
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1);
  const b = new Date(y2, m2 - 1, d2);
  let n = 0;
  for (let d = a; d <= b; d.setDate(d.getDate() + 1)) {
    const py = (d.getDay() + 6) % 7;          // Python weekday: Monday = 0
    if (!weekend.includes(py)) n += 1;
    if (n > 400) break;
  }
  return n;
}

export function monthInput(iso) {
  return iso ? iso.slice(0, 7) : "";
}
