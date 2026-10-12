import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useI18n } from "../../i18n.jsx";
import { Async, useApi } from "../../ui.jsx";
import { ClockCard } from "./MyHome.jsx";

function shiftMonth(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MyAttendance() {
  const i = useI18n();
  const { t } = i;
  const { today, settings } = useAuth();
  const weekend = (settings && settings.weekend) || [4, 5];
  const [month, setMonth] = useState(today.slice(0, 7));
  const q = useApi(() => api.get("/me/attendance/", { month }), [month]);
  const leaves = useApi(() => api.get("/me/leaves/"));

  const dayNames = [...Array(7)].map((_, k) => new Intl.DateTimeFormat(i.locale, { weekday: "short" }).format(new Date(2024, 0, 1 + k)));  // Monday first

  return (
    <>
      <div className="page-head">
        <div><h1>{t("me.att_title")}</h1><p>{t("me.att_sub")}</p></div>
        <div className="row">
          <button className="btn icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("payroll.prev")}><ChevronLeft size={18} /></button>
          <input className="input" type="month" value={month} max={today.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} style={{ width: "auto" }} aria-label={t("payroll.period")} />
          <button className="btn icon" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= today.slice(0, 7)} aria-label={t("payroll.next")}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="grid att-layout">
        <div className="stack">
          <ClockCard onChange={q.reload} />
          <Async q={q}>
            {(d) => (
              <div className="card">
                <div className="card-body">
                  <dl className="kv">
                    <dt>{t("att.present")}</dt><dd><b>{t("common.days_n", { n: d.present })}</b></dd>
                    <dt>{t("att.absent")}</dt><dd><b>{t("common.days_n", { n: d.absent })}</b></dd>
                    <dt>{t("att.hours")}</dt><dd><b>{i.num(d.total_hours)} h</b></dd>
                  </dl>
                </div>
              </div>
            )}
          </Async>
        </div>
        <div className="card">
          <div className="card-head"><h3 style={{ textTransform: "capitalize" }}>{i.month(month + "-01")}</h3></div>
          <div className="card-body stack">
            <Async q={q}>
              {(d) => {
                const [y, m] = month.split("-").map(Number);
                const first = new Date(y, m - 1, 1);
                const n = new Date(y, m, 0).getDate();
                const offset = (first.getDay() + 6) % 7;
                const recs = Object.fromEntries(d.records.map((r) => [r.date, r]));
                const approved = ((leaves.data && leaves.data.leaves) || []).filter((l) => l.status === "approved");
                const cells = [];
                for (let k = 0; k < offset; k++) cells.push(<div key={"e" + k} />);
                for (let day = 1; day <= n; day++) {
                  const iso = `${month}-${String(day).padStart(2, "0")}`;
                  const wd = (new Date(y, m - 1, day).getDay() + 6) % 7;
                  const r = recs[iso];
                  const onLeave = approved.some((l) => l.start_date <= iso && iso <= l.end_date);
                  let cls = weekend.includes(wd) ? "off" : "";
                  let label = "";
                  if (onLeave && !weekend.includes(wd)) { cls = "leave"; label = t("att.on_leave"); }
                  if (r) { cls = r.status; label = r.status === "present" ? `${i.time(r.check_in)}${r.check_out ? "–" + i.time(r.check_out) : ""}` : t("att.absent"); }
                  cells.push(
                    <div key={iso} className={`d ${cls}${iso === today ? " today" : ""}`} title={label}>
                      <b>{day}</b><small>{label}</small>
                    </div>,
                  );
                }
                return (
                  <>
                    <div className="cal">
                      {dayNames.map((x) => <div key={x} className="h">{x}</div>)}
                      {cells}
                    </div>
                    <div className="legend">
                      <span><i style={{ background: "var(--success-soft)" }} />{t("att.present")}</span>
                      <span><i style={{ background: "var(--danger-soft)" }} />{t("att.absent")}</span>
                      <span><i style={{ background: "var(--info-soft)" }} />{t("att.on_leave")}</span>
                      <span><i style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }} />{t("me.weekend")}</span>
                    </div>
                  </>
                );
              }}
            </Async>
          </div>
        </div>
      </div>
    </>
  );
}
