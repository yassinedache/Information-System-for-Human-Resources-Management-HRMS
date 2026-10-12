import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, FileText, LogIn, LogOut, Pencil, Plane } from "lucide-react";
import { api } from "../../api.js";
import { useI18n } from "../../i18n.jsx";
import { Async, Field, FormModal, Input, Textarea, formObject, useApi, useToast } from "../../ui.jsx";
import { BalanceCard } from "../hr/EmployeeDetail.jsx";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const h = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(h); }, []);
  return now;
}

export function ClockCard({ onChange }) {
  const i = useI18n();
  const { t } = i;
  const toast = useToast();
  const now = useNow();
  const q = useApi(() => api.get("/me/attendance/"));
  const [busy, setBusy] = useState(false);
  const clock = async () => {
    setBusy(true);
    try {
      const a = await api.post("/me/attendance/clock/", {});
      toast(a.check_out ? t("clock.out_done", { time: i.time(a.check_out) }) : t("clock.in_done", { time: i.time(a.check_in) }));
      q.reload();
      onChange && onChange();
    } catch (err) {
      toast(i.error(err), "error");
    } finally {
      setBusy(false);
    }
  };
  // the company clock: times are recorded in Algiers time (Africa/Algiers), whatever the visitor's time zone
  const timeFmt = new Intl.DateTimeFormat(i.locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Algiers" });
  return (
    <div className="card clock-card">
      <div className="muted small" style={{ textTransform: "capitalize" }}>{new Intl.DateTimeFormat(i.locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Algiers" }).format(now)}</div>
      <div className="clock-time">{timeFmt.format(now)}</div>
      <div className="muted small" style={{ marginTop: -8 }}>{t("clock.tz")}</div>
      <Async q={q}>
        {(d) => {
          const today = d.today;
          if (d.state === "on_leave") return <span className="badge cyan"><Plane size={14} />{t("clock.on_leave")}</span>;
          if (today && today.check_out) {
            return <><span className="badge green">{t("clock.day_done", { a: i.time(today.check_in), b: i.time(today.check_out), h: i.num(today.hours) })}</span></>;
          }
          const arrived = today && today.status === "present" && today.check_in;
          return (
            <>
              <button className={"btn lg clock-btn " + (arrived ? "danger" : "primary")} onClick={clock} disabled={busy}>
                {arrived ? <LogOut size={18} /> : <LogIn size={18} />}{arrived ? t("clock.out") : t("clock.in")}
              </button>
              <div className="muted small">{arrived ? t("clock.arrived", { time: i.time(today.check_in) }) : t("clock.not_yet")}</div>
            </>
          );
        }}
      </Async>
    </div>
  );
}

export default function MyHome() {
  const i = useI18n();
  const { t } = i;
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const q = useApi(() => api.get("/me/profile/"));
  return (
    <Async q={q}>
      {(me) => (
        <>
          <div className="page-head">
            <div><h1>{t("me.hello", { name: me.first_name })}</h1><p>{me.position || "—"} · {me.service_name}</p></div>
            <div className="row">
              <Link className="btn" to="/me/leaves"><CalendarDays size={16} />{t("leaves.request")}</Link>
              <Link className="btn" to="/me/payslips"><FileText size={16} />{t("nav.me_payslips")}</Link>
            </div>
          </div>
          <div className="grid three">
            <ClockCard />
            <BalanceCard balance={me.balance} title={t("me.my_balance", { year: me.balance.year })} />
            <div className="card">
              <div className="card-head"><h3>{t("me.contract")}</h3></div>
              <div className="card-body">
                {me.contract_detail ? (
                  <dl className="kv">
                    <dt>{t("field.type")}</dt><dd>{t("contract." + me.contract_detail.type + "_long")}</dd>
                    <dt>{t("field.start_date")}</dt><dd>{i.date(me.contract_detail.start_date)}</dd>
                    <dt>{t("field.end_date")}</dt><dd>{me.contract_detail.end_date ? i.date(me.contract_detail.end_date) : t("contracts.open_ended")}</dd>
                    <dt>{t("field.monthly_salary")}</dt><dd>{i.money(me.contract_detail.monthly_salary)}</dd>
                    <dt>{t("field.hire_date")}</dt><dd>{i.date(me.hire_date)}</dd>
                  </dl>
                ) : <p className="muted">{t("me.no_contract")}</p>}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>{t("me.profile")}</h3>
              <button className="btn sm" onClick={() => setEditing(true)}><Pencil size={15} />{t("me.edit_contact")}</button>
            </div>
            <div className="card-body">
              <dl className="kv">
                <dt>{t("field.email")}</dt><dd>{me.email}</dd>
                <dt>{t("field.phone")}</dt><dd>{me.phone || "—"}</dd>
                <dt>{t("field.address")}</dt><dd>{me.address || "—"}</dd>
                <dt>{t("field.birth_date")}</dt><dd>{i.date(me.birth_date)}</dd>
                <dt>{t("field.skills")}</dt><dd>{me.skills || "—"}</dd>
              </dl>
              <p className="muted small" style={{ marginTop: 12 }}><Clock size={13} style={{ verticalAlign: -2 }} /> {t("me.contact_hint")}</p>
            </div>
          </div>
          {editing && (
            <FormModal title={t("me.edit_contact")} onClose={() => setEditing(false)} submit={async (fd) => {
              const data = await api.patch("/me/profile/", formObject(fd));
              q.setData(data);
              setEditing(false);
              toast(t("me.saved"));
            }}>
              <Field label={t("field.phone")} name="phone"><Input name="phone" type="tel" defaultValue={me.phone} /></Field>
              <Field label={t("field.address")} name="address"><Textarea name="address" rows={2} defaultValue={me.address} /></Field>
            </FormModal>
          )}
        </>
      )}
    </Async>
  );
}
