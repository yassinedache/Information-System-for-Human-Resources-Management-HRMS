import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { api } from "../api.js";
import { homeFor, useAuth } from "../auth.jsx";
import { useI18n } from "../i18n.jsx";
import { ErrorBox, Field, Input, Notice, useToast } from "../ui.jsx";

export default function ChangePassword() {
  const i = useI18n();
  const { t } = i;
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [mismatch, setMismatch] = useState(false);
  const forced = user.must_change_password;

  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("new_password") !== f.get("confirm")) return setMismatch(true);
    setMismatch(false);
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/password/", { old_password: f.get("old_password"), new_password: f.get("new_password") });
      const me = { ...user, must_change_password: false };
      setUser(me);
      toast(t("password.done"));
      navigate(homeFor(me), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const fe = i.fieldErrors(error);
  return (
    <>
      <div className="page-head"><div><h1>{t("password.title")}</h1><p>{t("password.sub")}</p></div></div>
      <form className="card pad stack" style={{ maxWidth: 520 }} onSubmit={submit}>
        {forced && <Notice kind="warn">{t("password.forced")}</Notice>}
        <Field label={forced ? t("password.temporary") : t("password.old")} error={fe.old_password}>
          <Input name="old_password" type="password" required autoComplete="current-password" />
        </Field>
        <Field label={t("password.new")} hint={t("password.rules")} error={fe.new_password}>
          <Input name="new_password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label={t("password.confirm")} error={mismatch ? t("password.mismatch") : null}>
          <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        {error && !Object.keys(fe).length && <ErrorBox error={error} />}
        <div><button className="btn primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />}{t("password.submit")}</button></div>
      </form>
    </>
  );
}
