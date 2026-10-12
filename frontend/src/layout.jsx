/* Page frames: the public site (careers), the HR / employee application shell, the demo banner and boot screen. */
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Briefcase, Building2, CalendarCheck, CalendarDays, CheckCircle2, Circle, Clock, FileSignature, FileText, Home,
  KeyRound, LayoutDashboard, Loader2, LogOut, Menu, Moon, Sun, UserRound, Users, Wallet,
} from "lucide-react";
import { api } from "./api.js";
import { useAuth } from "./auth.jsx";
import { onDemoProgress, resetDemo } from "./demo/bridge.js";
import { useI18n } from "./i18n.jsx";
import { Avatar, useConfirm, useToast } from "./ui.jsx";

export const GITHUB_URL = "https://github.com/yassinedache/Information-System-for-Human-Resources-Management-HRMS";

export function Brand({ to = "/" }) {
  const { t } = useI18n();
  return (
    <Link to={to} className="brand" style={{ textDecoration: "none" }}>
      <span className="logo"><Users size={19} /></span>
      <span>HRMS<small>{t("brand.tagline")}</small></span>
    </Link>
  );
}

export function LangTheme() {
  const i = useI18n();
  const { theme, toggleTheme } = useAuth();
  return (
    <>
      <button className="btn ghost sm" onClick={i.toggleLang} aria-label={i.t("common.language")} title={i.t("common.language")}>
        {i.lang === "fr" ? "EN" : "FR"}
      </button>
      <button className="btn ghost icon" onClick={toggleTheme} aria-label={i.t("common.theme")} title={i.t("common.theme")}>
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ demo */
export function DemoBanner() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const [busy, setBusy] = useState(false);
  if (!__DEMO__) return null;
  const reset = async () => {
    if (!(await confirm(t("demo.reset_confirm"), { label: t("demo.reset") }))) return;
    setBusy(true);
    try {
      await resetDemo();
      await refresh();
      navigate("/login");
      toast(t("demo.reset_done"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="demo-banner">
      <span>{t("demo.banner")}</span>
      <button onClick={reset} disabled={busy}>{busy ? t("common.loading") : t("demo.reset")}</button>
      {confirmNode}
    </div>
  );
}

const STEPS = ["runtime", "bundle", "django", "database", "ready"];

export function BootScreen() {
  const { t } = useI18n();
  const [p, setP] = useState({ step: "start" });
  useEffect(() => onDemoProgress(setP), []);
  const failed = p.step === "failed";
  const idx = STEPS.indexOf(p.step);
  return (
    <div className="boot">
      <div className="card box">
        <Brand />
        <div>
          <h2>{t("boot.title")}</h2>
          <p className="muted small" style={{ marginTop: 4 }}>{t("boot.text")}</p>
        </div>
        <div className="bar"><i style={{ width: `${Math.max(6, ((idx + 1) / STEPS.length) * 100)}%` }} /></div>
        <ol>
          {STEPS.slice(0, 4).map((s, k) => {
            const state = idx > k ? "done" : idx === k ? "now" : "";
            return (
              <li key={s} className={state}>
                {state === "done" ? <CheckCircle2 size={18} /> : state === "now" && !failed ? <Loader2 size={18} className="spin" /> : <Circle size={18} />}
                {s === "database" && p.detail === "restore" ? t("boot.restore") : t("boot." + s)}
              </li>
            );
          })}
        </ol>
        {failed && (
          <div className="alert error">
            <div>
              {t("boot.failed")}
              <div className="small" style={{ marginTop: 4, opacity: 0.8 }}>{p.detail}</div>
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => window.location.reload()}>{t("common.retry")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ public site */
export function PublicLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <div className="public">
      <DemoBanner />
      <header className="pub-nav">
        <Brand />
        <nav>
          <Link className="btn ghost sm hide-sm" to="/#jobs">{t("nav.jobs")}</Link>
          <LangTheme />
          {user ? (
            <Link className="btn primary sm" to={user.role === "hr" ? "/hr" : "/me"}>{t("nav.my_space")}</Link>
          ) : (
            <Link className="btn primary sm" to="/login">{t("nav.login")}</Link>
          )}
        </nav>
      </header>
      <Outlet />
      <footer className="footer">
        <div className="wrap">
          <div>
            <b>HRMS</b> · {t("footer.project")}<br />
            {t("footer.team")}
          </div>
          <div>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">{t("footer.source")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ application shell */
function useCounts(isHR, pathname) {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    if (!isHR) return;
    let alive = true;
    Promise.all([api.get("/leaves/", { status: "pending" }), api.get("/applications/", { status: "received" })])
      .then(([l, a]) => alive && setCounts({ leaves: l.length, applications: a.length }))
      .catch(() => {});
    return () => { alive = false; };
  }, [isHR, pathname]);
  return counts;
}

export function AppShell() {
  const { t } = useI18n();
  const { user, isHR, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const counts = useCounts(isHR, loc.pathname);
  useEffect(() => setOpen(false), [loc.pathname]);

  const hrNav = [
    ["group", t("nav.g_overview")],
    ["/hr", t("nav.dashboard"), LayoutDashboard, true],
    ["group", t("nav.g_people")],
    ["/hr/employees", t("nav.employees"), Users],
    ["/hr/services", t("nav.services"), Building2],
    ["/hr/contracts", t("nav.contracts"), FileSignature],
    ["group", t("nav.g_time")],
    ["/hr/leaves", t("nav.leaves"), CalendarDays, false, counts.leaves],
    ["/hr/attendance", t("nav.attendance"), CalendarCheck],
    ["group", t("nav.g_pay")],
    ["/hr/payroll", t("nav.payroll"), Wallet],
    ["/hr/recruitment", t("nav.recruitment"), Briefcase, false, counts.applications],
  ];
  const meNav = [
    ["group", t("nav.g_me")],
    ["/me", t("nav.me_home"), Home, true],
    ["/me/leaves", t("nav.me_leaves"), CalendarDays],
    ["/me/attendance", t("nav.me_attendance"), Clock],
    ["/me/payslips", t("nav.me_payslips"), FileText],
    ["/password", t("nav.password"), KeyRound],
  ];
  const items = isHR ? [...hrNav, ...(user.employee ? meNav : [["group", t("nav.g_me")], ["/password", t("nav.password"), KeyRound]])] : meNav;
  const current = [...items].filter((x) => x[0] !== "group").sort((a, b) => b[0].length - a[0].length)
    .find(([p]) => loc.pathname === p || loc.pathname.startsWith(p + "/"));

  return (
    <div className={"shell" + (open ? " open" : "")}>
      <aside className="sidebar">
        <Brand to={isHR ? "/hr" : "/me"} />
        <nav className="nav">
          {items.map((it, k) => it[0] === "group" ? <div key={k} className="group">{it[1]}</div> : (
            <NavLink key={it[0]} to={it[0]} end={!!it[3]}>
              {(() => { const Icon = it[2]; return <Icon size={18} />; })()}
              <span>{it[1]}</span>
              {it[4] ? <span className="count">{it[4]}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Avatar first={user.first_name} last={user.last_name} />
          <div className="who">
            <div><b>{user.first_name} {user.last_name}</b></div>
            <div className="muted">{isHR ? t("role.hr") : (user.employee && user.employee.position) || t("role.employee")}</div>
          </div>
          <button className="btn ghost icon" title={t("nav.logout")} aria-label={t("nav.logout")}
            onClick={async () => { await logout(); navigate("/login"); }}><LogOut size={18} /></button>
        </div>
      </aside>
      <div className="backdrop" onClick={() => setOpen(false)} />
      <div className="main">
        <DemoBanner />
        <header className="topbar">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label={t("nav.menu")}><Menu size={20} /></button>
          <div className="title">{current ? current[1] : ""}</div>
          <Link to="/" className="btn ghost sm hide-sm" title={t("nav.careers")}><Briefcase size={16} /><span className="hide-sm">{t("nav.careers")}</span></Link>
          <LangTheme />
          <Link to={isHR && user.employee ? "/me" : "/password"} className="btn ghost icon" title={t("nav.my_account")} aria-label={t("nav.my_account")}><UserRound size={18} /></Link>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
