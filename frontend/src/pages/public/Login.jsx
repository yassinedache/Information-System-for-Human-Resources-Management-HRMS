import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, LogIn, UserCog, UserRound } from "lucide-react";
import { homeFor, useAuth } from "../../auth.jsx";
import { useI18n } from "../../i18n.jsx";
import { ErrorBox, Field, Input } from "../../ui.jsx";

// fictional accounts of the online demo (created by `manage.py seed_demo`)
const DEMO_ACCOUNTS = [
  { email: "hr@demo.dz", icon: UserCog, who: "Leila Hamidi", role: "role.hr" },
  { email: "employe@demo.dz", icon: UserRound, who: "Yasmine Kaci", role: "role.employee" },
];
const DEMO_PASSWORD = "demo1234";

export default function Login() {
  const { t } = useI18n();
  const { user, login, settings } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (user) return <Navigate to={homeFor(user)} replace />;

  const go = async (email, password) => {
    setBusy(true);
    setError(null);
    try {
      const me = await login(email, password);
      const from = loc.state && loc.state.from;
      const ok = from && !me.must_change_password && (me.role === "hr" || !from.startsWith("/hr"));
      navigate(ok ? from : homeFor(me), { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const demo = __DEMO__ || (settings && settings.demo);
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div>
          <h1>{t("login.title")}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{t("login.sub")}</p>
        </div>
        {demo && (
          <>
            <div className="demo-logins">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} type="button" disabled={busy} onClick={() => go(a.email, DEMO_PASSWORD)}>
                  <a.icon size={20} color="var(--primary)" />
                  <b>{t(a.role)}</b>
                  <span>{a.who}</span>
                  <span>{a.email}</span>
                </button>
              ))}
            </div>
            <div className="divider">{t("login.or")}</div>
          </>
        )}
        <form className="stack" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); go(f.get("email"), f.get("password")); }}>
          <Field label={t("field.email")}><Input name="email" type="email" required autoComplete="username" autoFocus={!demo} /></Field>
          <Field label={t("field.password")}><Input name="password" type="password" required autoComplete="current-password" /></Field>
          <ErrorBox error={error} />
          <button className="btn primary lg" disabled={busy}>{busy ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}{t("login.submit")}</button>
        </form>
        {demo && <p className="muted small">{t("login.demo_hint", { password: DEMO_PASSWORD })}</p>}
      </div>
    </div>
  );
}
