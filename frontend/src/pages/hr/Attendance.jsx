import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, UserCheck, UserX } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { addDays, useI18n } from "../../i18n.jsx";
import { Async, Empty, Field, FormModal, Input, Notice, Person, StatusBadge, formObject, useApi, useToast } from "../../ui.jsx";

function PresentModal({ row, date, onClose, onDone }) {
  const { t } = useI18n();
  const a = row.attendance || {};
  return (
    <FormModal title={t("att.mark_present_title", { name: row.employee_name })} onClose={onClose}
      submit={async (fd) => onDone(await api.post("/attendance/mark/", { ...formObject(fd, ["check_out"]), employee: row.employee, date, status: "present" }))}>
      <div className="form-grid">
        <Field label={t("att.check_in")} name="check_in"><Input name="check_in" type="time" required defaultValue={(a.check_in || "08:00").slice(0, 5)} /></Field>
        <Field label={t("att.check_out")} name="check_out"><Input name="check_out" type="time" defaultValue={(a.check_out || "").slice(0, 5)} /></Field>
        <Field label={t("field.note")} name="note" full><Input name="note" defaultValue={a.note} /></Field>
      </div>
    </FormModal>
  );
}

export default function Attendance() {
  const i = useI18n();
  const { t } = i;
  const { today } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const q = useApi(() => api.get("/attendance/day/", { date }), [date]);

  const absent = async (row) => {
    try {
      await api.post("/attendance/mark/", { employee: row.employee, date, status: "absent", note: "" });
      toast(t("att.marked_absent", { name: row.employee_name }));
      q.reload();
    } catch (err) {
      toast(i.error(err), "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>{t("att.title")}</h1><p>{t("att.sub")}</p></div>
        <div className="row">
          <button className="btn icon" onClick={() => setDate(addDays(date, -1))} aria-label={t("att.prev")}><ChevronLeft size={18} /></button>
          <input className="input" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: "auto" }} aria-label={t("field.date")} />
          <button className="btn icon" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label={t("att.next")}><ChevronRight size={18} /></button>
          {date !== today && <button className="btn" onClick={() => setDate(today)}>{t("att.today")}</button>}
        </div>
      </div>
      <Async q={q}>
        {(d) => {
          const rows = d.rows.filter((r) => !filter || r.state === filter);
          return (
            <div className="card">
              <div className="card-head">
                <div>
                  <h3 style={{ textTransform: "capitalize" }}>{i.day(d.date)}</h3>
                  {!d.working_day && <span className="badge orange">{t("att.weekend")}</span>}
                </div>
                <div className="seg" role="group">
                  {["", "present", "absent", "on_leave", "not_recorded"].map((s) => (
                    <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>
                      {s ? t("att." + s) : t("common.all")} <span className="muted">{s ? d.counts[s] || 0 : d.rows.length}</span>
                    </button>
                  ))}
                </div>
              </div>
              {!d.working_day && <div className="card-body"><Notice>{t("att.weekend_text")}</Notice></div>}
              {rows.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr>
                      <th>{t("field.employee")}</th><th>{t("field.state")}</th><th>{t("att.check_in")}</th><th>{t("att.check_out")}</th>
                      <th className="right hide-sm">{t("att.hours")}</th><th />
                    </tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.employee}>
                          <td><Person name={r.employee_name} sub={r.service_name} /></td>
                          <td><StatusBadge group="att" value={r.state} /></td>
                          <td className="nowrap">{i.time(r.attendance && r.attendance.check_in)}</td>
                          <td className="nowrap">{i.time(r.attendance && r.attendance.check_out)}</td>
                          <td className="num hide-sm">{r.attendance && r.attendance.hours ? i.num(r.attendance.hours) + " h" : "—"}</td>
                          <td>
                            {r.state !== "on_leave" && (
                              <div className="actions">
                                <button className="btn success sm" onClick={() => setEditing(r)}><UserCheck size={15} /><span className="hide-sm">{t("att.present")}</span></button>
                                {r.state !== "absent" && <button className="btn danger sm" onClick={() => absent(r)}><UserX size={15} /><span className="hide-sm">{t("att.absent")}</span></button>}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty icon={Clock}>{t("att.none")}</Empty>}
            </div>
          );
        }}
      </Async>
      {editing && <PresentModal row={editing} date={date} onClose={() => setEditing(null)} onDone={() => {
        toast(t("att.marked_present", { name: editing.employee_name }));
        setEditing(null);
        q.reload();
      }} />}
    </>
  );
}
